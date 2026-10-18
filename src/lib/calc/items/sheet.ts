import { CalcError, type FieldDef, type ItemInputs, type ItemType, type Pt } from "../types";
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

/**
 * A flat bar cut to length. Listed with plates so flats are easy to tell apart
 * from plate and sheet; still cut to length, so process = finish (no scrap).
 */
export const flat: ItemType = {
  id: "flat",
  category: "fabricated",
  family: FAMILY,
  label: "Flat",
  description: "A flat bar cut to length (e.g. 50 × 10). No scrap: process weight = finish weight.",
  formulaText: ["kg/m = W × t × ρ / 1000", "Weight = kg/m × L / 1000"],
  sizeLabel: (i) => `Flat ${String(i.width ?? "")} × ${String(i.thk ?? "")}`,
  fields: [
    { key: "width", label: "Width W", kind: "number", unit: "mm" },
    THK,
    { key: "length", label: "Cut length L", kind: "number", unit: "mm" },
  ],
  compute(inp, { density }) {
    const w = pos(inp, "width", "Width");
    const t = pos(inp, "thk", "THK");
    const L = pos(inp, "length", "Cut length");
    const kpm = (w * t * density) / 1000;
    return {
      ...devResult({ pieces: [{ name: "Flat", count: 1, outline: rect(0, 0, L, w) }] }, t, density, {
        steps: [`Flat ${f(w)} × ${f(t)}, kg/m = ${f(w)} × ${f(t)} × ${f(density)} / 1000 = ${f(kpm)}`],
      }),
      kgPerM: kpm,
      cutLength: L,
    };
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

const fromFlat = (inp: ItemInputs) => inp.madeFrom === "flat";

export const ringFlange: ItemType = {
  id: "ring-flange",
  category: "fabricated",
  family: FAMILY,
  label: "Ring / circular flange",
  description: "A ring with optional bolt holes on a PCD. Cut from sheet, or rolled from a flat (with a rolling allowance).",
  formulaText: [
    "Finish = (π (OD² − ID²) / 4 − n × π h² / 4) × t × ρ / 1e6",
    "From sheet: Process = OD × OD × t × ρ / 1e6",
    "From flat: W = (OD − ID) / 2,  L = π × (OD + ID) / 2",
    "From flat: Process = W × (L + allowance) × t × ρ / 1e6",
  ],
  fields: [
    {
      key: "madeFrom",
      label: "Made from",
      kind: "select",
      options: [
        { value: "sheet", label: "Sheet / plate (cut ring)" },
        { value: "flat", label: "Flat (rolled ring)" },
      ],
      default: "sheet",
    },
    { key: "od", label: "OD", kind: "number", unit: "mm" },
    { key: "id", label: "ID", kind: "number", unit: "mm" },
    THK,
    {
      key: "allowance",
      label: "Rolling allowance",
      kind: "number",
      unit: "mm",
      default: 100,
      help: "Usually 100–150 mm; added to process weight",
      showIf: fromFlat,
    },
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
    const pcd = pcdIn || (OD + ID) / 2;
    if (n && hd && (pcd + hd > OD || pcd - hd < ID)) throw new CalcError("Bolt holes do not fit between ID and OD");
    const area = (Math.PI * (OD * OD - ID * ID)) / 4 - (n * Math.PI * hd * hd) / 4;
    const holeText = n && hd ? `, ${n} holes Ø${f(hd)}` : "";

    if (fromFlat(inp)) {
      if (ID <= 0) throw new CalcError("A ring rolled from flat needs an ID");
      const allowance = optNum(inp, "allowance");
      if (allowance < 0) throw new CalcError("Rolling allowance cannot be negative");
      const W = (OD - ID) / 2;
      const Dm = (OD + ID) / 2;
      const L = Math.PI * Dm;
      const total = L + allowance;
      // Strip includes the allowance; the actual ring is the finish weight.
      const outline: Pt[] = rect(0, 0, total, W);
      const marks: [Pt, Pt][] = [];
      if (allowance > 0) {
        marks.push([[allowance / 2, 0], [allowance / 2, W]]);
        marks.push([[allowance / 2 + L, 0], [allowance / 2 + L, W]]);
      }
      return devResult(
        {
          pieces: [
            {
              name: "Flat for ring",
              count: 1,
              outline,
              marks,
              dims: [
                {
                  kind: "linear",
                  label: `π × Dm = ${f(L, 1)}${allowance > 0 ? ` (+ ${f(allowance, 0)} allowance)` : ""}`,
                  from: [allowance / 2, 0],
                  to: [allowance / 2 + L, 0],
                  offset: -Math.max(W * 1.5, total * 0.05),
                },
              ],
              exactArea: area,
              exactPerimeter: 2 * (L + W),
            },
          ],
        },
        t,
        density,
        {
          steps: [
            `Rolled from flat: W = (${f(OD)} − ${f(ID)}) / 2 = ${f(W)} mm, Dm = ${f(Dm)} mm`,
            `Flat length L = π × ${f(Dm)} = ${f(L)} mm, + allowance ${f(allowance)} = ${f(total)} mm${holeText}`,
          ],
          development: { flatWidth: W, flatLength: L, cutLength: total, OD, ID, ...(pcdIn ? { PCD: pcdIn } : {}) },
        },
      );
    }

    const c: Pt = [OD / 2, OD / 2];
    const holes = [...(ID > 0 ? [circle(c, ID / 2)] : [])];
    if (n && hd) for (let i = 0; i < n; i++) holes.push(circle(polar(c, pcd / 2, (2 * Math.PI * (i + 0.5)) / n), hd / 2, 48));
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
        steps: [`Cut from sheet: ring Ø${f(OD)} / Ø${f(ID)}${holeText}`],
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
