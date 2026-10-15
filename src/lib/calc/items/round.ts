import { CalcError, type FieldDef, type ItemType } from "../types";
import { diaRef, f, kg, meanDia, pos, weightResult } from "../helpers";

const THK: FieldDef = { key: "thk", label: "THK", kind: "number", unit: "mm" };
const DIA_REF: FieldDef = {
  key: "diaRef",
  label: "Diameter given as",
  kind: "diaRef",
  options: [
    { value: "OD", label: "OD" },
    { value: "ID", label: "ID" },
  ],
  default: "OD",
};

export const shell: ItemType = {
  id: "shell",
  category: "fabricated",
  label: "Cylinder / shell",
  fields: [
    { key: "dia", label: "Diameter", kind: "number", unit: "mm" },
    DIA_REF,
    { key: "height", label: "Height", kind: "number", unit: "mm" },
    THK,
  ],
  compute(inp, { density }) {
    const D = pos(inp, "dia", "Diameter");
    const H = pos(inp, "height", "Height");
    const t = pos(inp, "thk", "THK");
    const ref = diaRef(inp);
    const Dm = meanDia(D, ref, t);
    if (Dm <= 0) throw new CalcError("THK is too large for this diameter");
    const devL = Math.PI * Dm;
    const wt = kg(devL * H * t, density);
    return weightResult({
      finishWt: wt,
      processWt: wt,
      sheetL: devL,
      sheetW: H,
      development: { Dm, length: devL, height: H },
      formula:
        `Dm = ${f(D)} ${ref === "OD" ? "−" : "+"} ${f(t)} = ${f(Dm)} mm\n` +
        `Development = π × ${f(Dm)} × ${f(H)} = ${f(devL)} × ${f(H)} mm\n` +
        `Weight = ${f(devL)} × ${f(H)} × ${f(t)} × ${f(density)} / 1e6 = ${f(wt)} kg`,
    });
  },
};

/**
 * Bounding box of an annular sector (fan) with radii R1 > R2 and angle θ,
 * laid out symmetric about the vertical axis.
 */
export function fanBoundingBox(R1: number, R2: number, thetaDeg: number) {
  const half = (thetaDeg * Math.PI) / 360;
  const pts: [number, number][] = [];
  for (const R of [R1, R2]) {
    pts.push([R * Math.sin(-half), R * Math.cos(-half)]);
    pts.push([R * Math.sin(half), R * Math.cos(half)]);
  }
  // Extreme points of the outer arc that fall inside the sector.
  for (const a of [0, Math.PI / 2, -Math.PI / 2, Math.PI, -Math.PI]) {
    if (Math.abs(a) <= half + 1e-12) pts.push([R1 * Math.sin(a), R1 * Math.cos(a)]);
  }
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

export const cone: ItemType = {
  id: "cone",
  category: "fabricated",
  label: "Concentric cone",
  fields: [
    { key: "d1", label: "Large dia D1", kind: "number", unit: "mm" },
    { key: "d2", label: "Small dia D2", kind: "number", unit: "mm" },
    DIA_REF,
    { key: "height", label: "Height", kind: "number", unit: "mm" },
    THK,
  ],
  compute(inp, { density }) {
    let D1 = pos(inp, "d1", "D1");
    let D2 = pos(inp, "d2", "D2");
    if (D2 > D1) [D1, D2] = [D2, D1];
    const H = pos(inp, "height", "Height");
    const t = pos(inp, "thk", "THK");
    const ref = diaRef(inp);
    const Dm1 = meanDia(D1, ref, t);
    const Dm2 = Math.max(0, meanDia(D2, ref, t));
    if (Dm1 - Dm2 <= 1e-9) throw new CalcError("D1 and D2 are equal — use Cylinder / shell");
    const s = Math.hypot(H, (Dm1 - Dm2) / 2);
    const R1 = (s * Dm1) / (Dm1 - Dm2);
    const R2 = R1 - s;
    const theta = (360 * (Dm1 / 2)) / R1;
    const chord = theta >= 180 ? 2 * R1 : 2 * R1 * Math.sin((theta * Math.PI) / 360);
    const box = fanBoundingBox(R1, R2, theta);
    const finish = kg((Math.PI * theta) / 360 * (R1 * R1 - R2 * R2) * t, density);
    const process = kg(box.width * box.height * t, density);
    return weightResult({
      finishWt: finish,
      processWt: process,
      sheetL: box.width,
      sheetW: box.height,
      development: { Dm1, Dm2, slant: s, R1, R2, theta, chord },
      formula:
        `Dm1 = ${f(Dm1)}, Dm2 = ${f(Dm2)} mm\n` +
        `Slant s = √(${f(H)}² + ((${f(Dm1)} − ${f(Dm2)}) / 2)²) = ${f(s)} mm\n` +
        `R1 = s × Dm1 / (Dm1 − Dm2) = ${f(R1)} mm, R2 = R1 − s = ${f(R2)} mm\n` +
        `θ = 360 × (Dm1 / 2) / R1 = ${f(theta)}°\n` +
        `Finish = π × ${f(theta)} / 360 × (${f(R1)}² − ${f(R2)}²) × ${f(t)} × ${f(density)} / 1e6 = ${f(finish)} kg\n` +
        `Sheet = ${f(box.width)} × ${f(box.height)} mm → Process = ${f(process)} kg`,
    });
  },
};
