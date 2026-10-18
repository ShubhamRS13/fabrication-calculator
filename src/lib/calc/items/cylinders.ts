import { CalcError, type FieldDef, type ItemInputs, type ItemType, type Pt } from "../types";
import { diaRef, f, meanDia, num, pos } from "../helpers";
import { devResult } from "../dev/result";

// Right cylinders (Plate'n'Sheets "Cylinders" group). The mean circumference
// π·Dm unrolls to the strip length; the top edge follows the cut. A point at
// angle φ around the axis sits at x = R·cos φ across the elevation.

const THK: FieldDef = { key: "thk", label: "THK", kind: "number", unit: "mm" };
const DIA: FieldDef = { key: "dia", label: "Diameter D", kind: "number", unit: "mm" };
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
const FAMILY = "Cylinders";
const SAMPLES = 360;
const MARK_LINES = 24;
const deg = (d: number) => (d * Math.PI) / 180;

/**
 * Unroll a cylinder whose top height at elevation position x is topZ(x).
 * The seam is at `seamPhi` (usually the shortest side).
 */
function developCylinder(
  inp: ItemInputs,
  density: number,
  topZ: (x: number, R: number) => number,
  opts: { steps: (R: number, Dm: number) => string[]; seamPhi: number; exactArea?: (R: number, P: number) => number; extra?: Record<string, number> },
) {
  const t = pos(inp, "thk", "THK");
  const D = pos(inp, "dia", "Diameter D");
  const Dm = meanDia(D, diaRef(inp), t);
  if (Dm <= 0) throw new CalcError("THK is too large for this diameter");
  const R = Dm / 2;
  const P = Math.PI * Dm;
  const heightAt = (s: number) => {
    const z = topZ(R * Math.cos(opts.seamPhi + s / R), R);
    if (!(z > 0)) throw new CalcError("The cut goes below the base — increase the height");
    return z;
  };
  const top: Pt[] = [];
  for (let i = SAMPLES; i >= 0; i--) {
    const s = (P * i) / SAMPLES;
    top.push([s, heightAt(s)]);
  }
  const outline: Pt[] = [[0, 0], [P, 0], ...top];
  const marks: [Pt, Pt][] = [];
  const rows: number[][] = [];
  for (let i = 0; i <= MARK_LINES; i++) {
    const s = (P * i) / MARK_LINES;
    const z = heightAt(s);
    if (i > 0 && i < MARK_LINES) marks.push([[s, 0], [s, z]]);
    rows.push([i, s, z]);
  }
  const heights = rows.map((r) => r[2]);
  return devResult(
    {
      pieces: [
        {
          name: "Cylinder",
          count: 1,
          outline,
          marks,
          dims: [{ kind: "text", label: `girth π × Dm = ${f(P, 1)}`, at: [P / 2, -0.06 * Math.max(...heights)] }],
          exactArea: opts.exactArea?.(R, P),
        },
      ],
    },
    t,
    density,
    {
      steps: [`Dm = ${f(Dm)} mm, girth π × Dm = ${f(P)} mm`, ...opts.steps(R, Dm)],
      development: { Dm, girth: P, shortest: Math.min(...heights), longest: Math.max(...heights), ...opts.extra },
      markTable: { title: "Marking heights along the girth", columns: ["Line", "Girth position mm", "Height mm"], rows },
    },
  );
}

/** Kept as "shell" so saved items keep working. */
export const cylinderFull: ItemType = {
  id: "shell",
  category: "fabricated",
  family: FAMILY,
  label: "Right cylinder – full",
  description: "A simple right cylinder (shell). The ends are cut square to the axis.",
  formulaText: ["Dm = D − t (OD) or D + t (ID)", "Development = π × Dm × H", "Area = π × Dm × H"],
  fields: [DIA, DIA_REF, { key: "height", label: "Height H", kind: "number", unit: "mm" }, THK],
  compute(inp, { density }) {
    const H = pos(inp, "height", "Height H");
    return developCylinder(inp, density, () => H, {
      seamPhi: 0,
      steps: () => [`Height H = ${f(H)} mm`],
      exactArea: (_R, P) => P * H,
      extra: { height: H },
    });
  },
};

const CUT_ANGLE: FieldDef = { key: "cutAngle", label: "Cut angle β", kind: "number", unit: "deg" };

export const cylinderTruncCentre: ItemType = {
  id: "cyl-trunc",
  category: "fabricated",
  family: FAMILY,
  label: "Right cylinder – top truncated",
  description: "A right cylinder with the top cut at an angle. The height is measured at the centre-line.",
  formulaText: ["R = Dm/2", "Height at girth position s: z = H + R × tan β × cos(π + s/R)", "Area = π × Dm × H"],
  fields: [DIA, DIA_REF, { key: "height", label: "Height at centre H", kind: "number", unit: "mm" }, CUT_ANGLE, THK],
  compute(inp, { density }) {
    const H = pos(inp, "height", "Height H");
    const k = Math.tan(deg(checkAngle(num(inp, "cutAngle", "Cut angle β"))));
    return developCylinder(inp, density, (x) => H + k * x, {
      seamPhi: Math.PI,
      steps: (R) => [`Top: z = ${f(H)} + ${f(R)} × tan β × cos φ (seam at the short side)`],
      exactArea: (_R, P) => P * H,
    });
  },
};

export const cylinderTruncSide: ItemType = {
  id: "cyl-trunc-side",
  category: "fabricated",
  family: FAMILY,
  label: "Right cylinder – top truncated (angle and side)",
  description: "A right cylinder with the top cut at an angle. The height is measured at the short side.",
  formulaText: ["R = Dm/2,  H = h + R × tan β", "z = H + R × tan β × cos φ", "Area = π × Dm × H"],
  fields: [DIA, DIA_REF, { key: "sideHeight", label: "Short side height h", kind: "number", unit: "mm" }, CUT_ANGLE, THK],
  compute(inp, { density }) {
    const h = pos(inp, "sideHeight", "Short side height h");
    const k = Math.tan(deg(checkAngle(num(inp, "cutAngle", "Cut angle β"))));
    const kk = Math.abs(k);
    return developCylinder(inp, density, (x, R) => h + R * kk + kk * x, {
      seamPhi: Math.PI,
      steps: (R) => [`Height at centre H = ${f(h)} + ${f(R)} × tan β = ${f(h + R * kk)} mm`],
      exactArea: (R, P) => P * (h + R * kk),
    });
  },
};

export const cylinderTruncHeights: ItemType = {
  id: "cyl-trunc-heights",
  category: "fabricated",
  family: FAMILY,
  label: "Right cylinder – top truncated (heights)",
  description: "A right cylinder with the top cut at an angle, defined by the height at each side.",
  formulaText: ["R = Dm/2,  H = (h1 + h2)/2,  tan β = (h1 − h2) / (2R)", "z = H + (h1 − h2)/2 × cos φ", "Area = π × Dm × H"],
  fields: [
    DIA,
    DIA_REF,
    { key: "h1", label: "Long side height h1", kind: "number", unit: "mm" },
    { key: "h2", label: "Short side height h2", kind: "number", unit: "mm" },
    THK,
  ],
  compute(inp, { density }) {
    const h1 = pos(inp, "h1", "Long side height h1");
    const h2 = pos(inp, "h2", "Short side height h2");
    const H = (h1 + h2) / 2;
    return developCylinder(inp, density, (x, R) => H + ((h1 - h2) / 2) * (x / R), {
      seamPhi: Math.PI,
      steps: () => [`H = (${f(h1)} + ${f(h2)}) / 2 = ${f(H)} mm`],
      exactArea: (_R, P) => P * H,
    });
  },
};

export const cylinderTruncRadius: ItemType = {
  id: "cyl-trunc-radius",
  category: "fabricated",
  family: FAMILY,
  label: "Right cylinder – top truncated by a radius",
  description: "A right cylinder with the top cut by a radius, making a convex (rounded) top.",
  formulaText: ["R = Dm/2", "z = H − Rc + √(Rc² − (R cos φ)²)", "Rc ≥ R"],
  fields: [
    DIA,
    DIA_REF,
    { key: "height", label: "Height at centre H", kind: "number", unit: "mm" },
    { key: "radius", label: "Cut radius Rc", kind: "number", unit: "mm" },
    THK,
  ],
  compute(inp, { density }) {
    const H = pos(inp, "height", "Height H");
    const Rc = pos(inp, "radius", "Cut radius Rc");
    return developCylinder(
      inp,
      density,
      (x, R) => {
        if (Rc < R) throw new CalcError("Cut radius Rc must be at least the cylinder radius");
        return H - Rc + Math.sqrt(Rc * Rc - x * x);
      },
      { seamPhi: 0, steps: () => [`Top: z = ${f(H)} − ${f(Rc)} + √(${f(Rc)}² − x²)`], extra: { cutRadius: Rc } },
    );
  },
};

export const cylinderGable: ItemType = {
  id: "cyl-gable",
  category: "fabricated",
  family: FAMILY,
  label: "Right cylinder – gable vent",
  description: "A right cylinder with a gable (two-sided roof) top, ridge across the centre.",
  formulaText: ["R = Dm/2", "z = H − tan β × |R cos φ|"],
  fields: [
    DIA,
    DIA_REF,
    { key: "height", label: "Ridge height H", kind: "number", unit: "mm" },
    { key: "cutAngle", label: "Roof angle β", kind: "number", unit: "deg" },
    THK,
  ],
  compute(inp, { density }) {
    const H = pos(inp, "height", "Ridge height H");
    const k = Math.tan(deg(checkAngle(num(inp, "cutAngle", "Roof angle β"))));
    return developCylinder(inp, density, (x) => H - Math.abs(k) * Math.abs(x), {
      seamPhi: 0,
      steps: () => [`Top: z = ${f(H)} − tan β × |x|`],
    });
  },
};

function checkAngle(b: number) {
  if (Math.abs(b) >= 89) throw new CalcError("Angle must be between −89° and 89°");
  return b;
}

export const CYLINDER_TYPES = [cylinderFull, cylinderTruncCentre, cylinderTruncSide, cylinderTruncHeights, cylinderTruncRadius, cylinderGable];
