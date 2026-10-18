import { CalcError, type FieldDef, type ItemType, type Pt } from "../types";
import { f, optNum, pos } from "../helpers";
import { circle, polar, rect } from "../dev/geometry";
import { devResult } from "../dev/result";

const THK: FieldDef = { key: "thk", label: "THK", kind: "number", unit: "mm" };
const FAMILY = "Plates & flanges";

export const plate: ItemType = {
  id: "plate",
  category: "fabricated",
  family: FAMILY,
  label: "Plate / sheet (rectangular)",
  description: "A flat rectangle cut from sheet or plate.",
  formulaText: ["Weight = L × W × (t + allowance) × ρ / 1e6"],
  fields: [
    { key: "length", label: "Length L", kind: "number", unit: "mm" },
    { key: "width", label: "Width W", kind: "number", unit: "mm" },
    THK,
    {
      key: "thkAllowance",
      label: "THK allowance",
      kind: "number",
      unit: "mm",
      optional: true,
      help: "Added to THK for weight, e.g. 0.5 for chequered plate",
    },
  ],
  compute(inp, { density }) {
    const L = pos(inp, "length", "Length");
    const W = pos(inp, "width", "Width");
    const t = pos(inp, "thk", "THK");
    const allowance = optNum(inp, "thkAllowance");
    return devResult({ pieces: [{ name: "Plate", count: 1, outline: rect(0, 0, L, W) }] }, t + allowance, density, {
      steps: [allowance ? `Weight thickness = ${f(t)} + ${f(allowance)} = ${f(t + allowance)} mm` : `${f(L)} × ${f(W)} × ${f(t)} mm`],
    });
  },
};

export const disc: ItemType = {
  id: "disc",
  category: "fabricated",
  family: FAMILY,
  label: "Circular disc / blank",
  description: "A full circle cut from a square of plate.",
  formulaText: ["Finish = π D² / 4 × t × ρ / 1e6", "Process = D × D × t × ρ / 1e6"],
  fields: [{ key: "dia", label: "Diameter D", kind: "number", unit: "mm" }, THK],
  compute(inp, { density }) {
    const D = pos(inp, "dia", "Diameter");
    const t = pos(inp, "thk", "THK");
    const c: Pt = [D / 2, D / 2];
    return devResult(
      {
        pieces: [
          {
            name: "Disc",
            count: 1,
            outline: circle(c, D / 2),
            dims: [{ kind: "radius", label: `Ø${f(D, 1)}`, center: c, to: polar(c, D / 2, Math.PI / 4) }],
            exactArea: (Math.PI * D * D) / 4,
            exactPerimeter: Math.PI * D,
          },
        ],
      },
      t,
      density,
      { steps: [`Disc Ø${f(D)} in a ${f(D)} × ${f(D)} square`] },
    );
  },
};

export const ringFlange: ItemType = {
  id: "ring-flange",
  category: "fabricated",
  family: FAMILY,
  label: "Ring / circular flange",
  description: "A ring cut from plate, with optional bolt holes on a PCD.",
  formulaText: ["Finish = (π (OD² − ID²) / 4 − n × π h² / 4) × t × ρ / 1e6", "Process = OD × OD × t × ρ / 1e6"],
  fields: [
    { key: "od", label: "OD", kind: "number", unit: "mm" },
    { key: "id", label: "ID", kind: "number", unit: "mm" },
    THK,
    { key: "pcd", label: "PCD", kind: "number", unit: "mm", optional: true },
    { key: "holes", label: "No. of holes n", kind: "number", unit: "nos", optional: true },
    { key: "holeDia", label: "Hole dia h", kind: "number", unit: "mm", optional: true },
  ],
  compute(inp, { density }) {
    const OD = pos(inp, "od", "OD");
    const ID = optNum(inp, "id");
    const t = pos(inp, "thk", "THK");
    if (ID < 0 || ID >= OD) throw new CalcError("ID must be smaller than OD");
    const n = Math.max(0, Math.round(optNum(inp, "holes")));
    const hd = optNum(inp, "holeDia");
    const pcdIn = optNum(inp, "pcd");
    // Without a PCD the holes still count in the weight; draw them mid-ring.
    const pcd = pcdIn || (OD + ID) / 2;
    if (n && hd && (pcd + hd > OD || pcd - hd < ID)) throw new CalcError("Bolt holes do not fit between ID and OD");
    const c: Pt = [OD / 2, OD / 2];
    const holes = [...(ID > 0 ? [circle(c, ID / 2)] : [])];
    if (n && hd) for (let i = 0; i < n; i++) holes.push(circle(polar(c, pcd / 2, (2 * Math.PI * (i + 0.5)) / n), hd / 2, 48));
    const area = (Math.PI * (OD * OD - ID * ID)) / 4 - (n * Math.PI * hd * hd) / 4;
    return devResult(
      {
        pieces: [
          {
            name: "Flange",
            count: 1,
            outline: circle(c, OD / 2),
            holes,
            dims: [
              { kind: "radius", label: `OD ${f(OD, 1)}`, center: c, to: polar(c, OD / 2, Math.PI / 4) },
              ...(ID > 0 ? [{ kind: "radius" as const, label: `ID ${f(ID, 1)}`, center: c, to: polar(c, ID / 2, -Math.PI / 4) }] : []),
              ...(pcdIn ? [{ kind: "text" as const, label: `PCD ${f(pcdIn, 1)}, ${n} × Ø${f(hd, 1)}`, at: [OD / 2, -OD * 0.06] as Pt }] : []),
            ],
            exactArea: area,
            exactPerimeter: Math.PI * (OD + ID + n * hd),
          },
        ],
      },
      t,
      density,
      {
        steps: [`Ring Ø${f(OD)} / Ø${f(ID)}${n && hd ? `, ${n} holes Ø${f(hd)}` : ""}`],
        development: { OD, ID, ...(pcdIn ? { PCD: pcdIn } : {}) },
      },
    );
  },
};

export const rectFlange: ItemType = {
  id: "rect-flange",
  category: "fabricated",
  family: FAMILY,
  label: "Rectangular flange / frame",
  description: "A rectangular frame: outer rectangle with a centred rectangular opening.",
  formulaText: ["Finish = (L × W − l × w) × t × ρ / 1e6", "Process = L × W × t × ρ / 1e6"],
  fields: [
    { key: "length", label: "Outer L", kind: "number", unit: "mm" },
    { key: "width", label: "Outer W", kind: "number", unit: "mm" },
    { key: "innerL", label: "Inner l", kind: "number", unit: "mm" },
    { key: "innerW", label: "Inner w", kind: "number", unit: "mm" },
    THK,
  ],
  compute(inp, { density }) {
    const L = pos(inp, "length", "Outer L");
    const W = pos(inp, "width", "Outer W");
    const l = optNum(inp, "innerL");
    const w = optNum(inp, "innerW");
    const t = pos(inp, "thk", "THK");
    if (l >= L || w >= W) throw new CalcError("Inner size must be smaller than outer size");
    return devResult(
      {
        pieces: [
          {
            name: "Frame",
            count: 1,
            outline: rect(0, 0, L, W),
            holes: l > 0 && w > 0 ? [rect((L - l) / 2, (W - w) / 2, l, w)] : [],
            dims: l > 0 && w > 0 ? [{ kind: "text", label: `${f(l, 1)} × ${f(w, 1)}`, at: [L / 2, W / 2] }] : [],
          },
        ],
      },
      t,
      density,
      { steps: [`Outer ${f(L)} × ${f(W)}, inner ${f(l)} × ${f(w)}`] },
    );
  },
};

export const bentPlate: ItemType = {
  id: "bent-plate",
  category: "fabricated",
  family: FAMILY,
  label: "Bent plate / formed channel",
  description: "A plate bent to shape; the flat width is the girth (sum of the legs).",
  formulaText: ["Weight = girth × L × t × ρ / 1e6"],
  fields: [
    { key: "girth", label: "Girth (sum of legs)", kind: "number", unit: "mm" },
    { key: "length", label: "Length L", kind: "number", unit: "mm" },
    THK,
  ],
  compute(inp, { density }) {
    const g = pos(inp, "girth", "Girth");
    const L = pos(inp, "length", "Length");
    const t = pos(inp, "thk", "THK");
    return devResult({ pieces: [{ name: "Bent plate", count: 1, outline: rect(0, 0, L, g) }] }, t, density, {
      steps: [`Flat ${f(L)} × girth ${f(g)} mm`],
    });
  },
};
