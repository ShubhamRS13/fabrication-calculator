import { CalcError, type ItemResult, type ItemType } from "../types";
import { f, optNum, pos, str } from "../helpers";
import { IS1239_OD, IS1239_WALL, MS_DENSITY, PIPE_OD, PIPE_WALL, STRUCTURAL, SWG } from "../data/sections";

const LENGTH = { key: "length", label: "Cut length", kind: "number", unit: "mm" } as const;

/** Sections are cut to length: process = finish = kg/m × L / 1000, scrap 0. */
function lengthResult(kgPerM: number, L: number, how: string): ItemResult {
  const wt = (kgPerM * L) / 1000;
  return {
    finishWt: wt,
    processWt: wt,
    scrap: 0,
    kgPerM,
    fixedCost: 0,
    costedByWeight: true,
    formula: `${how}\nWeight = ${f(kgPerM)} kg/m × ${f(L)} / 1000 = ${f(wt)} kg`,
  };
}

/** kg/m of a round tube: π × t × (OD − t) × ρ / 1000 (same as the workbook PIPE()). */
const tubeKgPerM = (od: number, t: number, density: number) =>
  (Math.PI * t * (od - t) * density) / 1000;

export const pipeSch: ItemType = {
  id: "pipe-sch",
  category: "section",
  label: "Pipe (NB + schedule)",
  fields: [
    { key: "nb", label: "NB", kind: "select", unit: "mm", options: Object.keys(PIPE_OD).map((v) => ({ value: v, label: `${v} NB` })) },
    { key: "sch", label: "Schedule", kind: "select", options: Object.keys(PIPE_WALL).map((v) => ({ value: v, label: `SCH ${v}` })) },
    LENGTH,
  ],
  compute(inp, { density }) {
    const nb = Number(str(inp, "nb"));
    const sch = str(inp, "sch");
    const od = PIPE_OD[nb];
    const t = PIPE_WALL[sch]?.[nb];
    if (!od || !t) throw new CalcError(`No table entry for ${nb} NB SCH ${sch}`);
    const L = pos(inp, "length", "Cut length");
    const kpm = tubeKgPerM(od, t, density);
    return lengthResult(kpm, L, `${nb} NB SCH ${sch}: OD ${f(od)}, wall ${f(t)}\nkg/m = π × ${f(t)} × (${f(od)} − ${f(t)}) × ${f(density)} / 1000 = ${f(kpm)}`);
  },
};

const IS1239_CLASS: Record<string, string> = { L: "Light (A)", M: "Medium (B)", H: "Heavy (C)" };

export const pipeIs1239: ItemType = {
  id: "pipe-is1239",
  category: "section",
  label: "Pipe IS 1239 (Light / Medium / Heavy)",
  fields: [
    { key: "nb", label: "NB", kind: "select", unit: "mm", options: Object.keys(IS1239_OD).map((v) => ({ value: v, label: `${v} NB` })) },
    { key: "cls", label: "Class", kind: "select", options: Object.entries(IS1239_CLASS).map(([value, label]) => ({ value, label })) },
    LENGTH,
  ],
  compute(inp, { density }) {
    const nb = Number(str(inp, "nb"));
    const cls = str(inp, "cls");
    const od = IS1239_OD[nb];
    const t = IS1239_WALL[cls]?.[nb];
    if (!od || !t) throw new CalcError(`No IS 1239 entry for ${nb} NB class ${cls}`);
    const L = pos(inp, "length", "Cut length");
    const kpm = tubeKgPerM(od, t, density);
    return lengthResult(kpm, L, `${nb} NB IS 1239 ${IS1239_CLASS[cls]}: OD ${f(od)}, wall ${f(t)}
kg/m = π × ${f(t)} × (${f(od)} − ${f(t)}) × ${f(density)} / 1000 = ${f(kpm)}`);
  },
};

export const pipeSwg: ItemType = {
  id: "pipe-swg",
  category: "section",
  label: "Pipe / tube (OD + SWG)",
  fields: [
    { key: "od", label: "OD", kind: "number", unit: "mm" },
    { key: "swg", label: "SWG", kind: "select", options: Object.keys(SWG).map((v) => ({ value: v, label: `${v} SWG` })) },
    LENGTH,
  ],
  compute(inp, { density }) {
    const od = pos(inp, "od", "OD");
    const g = Number(str(inp, "swg"));
    const t = SWG[g];
    if (!t) throw new CalcError(`Unknown gauge ${g} SWG`);
    const L = pos(inp, "length", "Cut length");
    const kpm = tubeKgPerM(od, t, density);
    return lengthResult(kpm, L, `${f(od)} OD ${g} SWG (${f(t)} mm)\nkg/m = π × ${f(t)} × (${f(od)} − ${f(t)}) × ${f(density)} / 1000 = ${f(kpm)}`);
  },
};

export const pipeCustom: ItemType = {
  id: "pipe-custom",
  category: "section",
  label: "Pipe / tube custom",
  fields: [
    { key: "od", label: "OD", kind: "number", unit: "mm" },
    { key: "thk", label: "THK", kind: "number", unit: "mm" },
    LENGTH,
  ],
  compute(inp, { density }) {
    const od = pos(inp, "od", "OD");
    const t = pos(inp, "thk", "THK");
    if (2 * t >= od) throw new CalcError("THK is too large for this OD");
    const L = pos(inp, "length", "Cut length");
    const kpm = tubeKgPerM(od, t, density);
    return lengthResult(kpm, L, `kg/m = π × ${f(t)} × (${f(od)} − ${f(t)}) × ${f(density)} / 1000 = ${f(kpm)}`);
  },
};

export const rectTube: ItemType = {
  id: "rect-tube",
  category: "section",
  label: "Square / rectangular tube",
  fields: [
    { key: "a", label: "Side A", kind: "number", unit: "mm" },
    { key: "b", label: "Side B", kind: "number", unit: "mm" },
    { key: "thk", label: "THK", kind: "number", unit: "mm" },
    { key: "kgPerM", label: "Std kg/m (overrides)", kind: "number", unit: "kg/m", optional: true },
    LENGTH,
  ],
  compute(inp, { density }) {
    const L = pos(inp, "length", "Cut length");
    const override = optNum(inp, "kgPerM");
    if (override > 0) return lengthResult(override, L, `Std kg/m = ${f(override)} (entered)`);
    const a = pos(inp, "a", "Side A");
    const b = pos(inp, "b", "Side B");
    const t = pos(inp, "thk", "THK");
    if (2 * t >= Math.min(a, b)) throw new CalcError("THK is too large for this tube");
    const kpm = (2 * t * (a + b - 2 * t) * density) / 1000;
    return lengthResult(kpm, L, `kg/m = 2 × ${f(t)} × (${f(a)} + ${f(b)} − 2 × ${f(t)}) × ${f(density)} / 1000 = ${f(kpm)} (corners ignored)`);
  },
};

export const flat: ItemType = {
  id: "flat",
  category: "section",
  label: "Flat",
  fields: [
    { key: "width", label: "Width", kind: "number", unit: "mm" },
    { key: "thk", label: "THK", kind: "number", unit: "mm" },
    LENGTH,
  ],
  compute(inp, { density }) {
    const w = pos(inp, "width", "Width");
    const t = pos(inp, "thk", "THK");
    const L = pos(inp, "length", "Cut length");
    const kpm = (w * t * density) / 1000;
    return lengthResult(kpm, L, `kg/m = ${f(w)} × ${f(t)} × ${f(density)} / 1000 = ${f(kpm)}`);
  },
};

export const roundBar: ItemType = {
  id: "round-bar",
  category: "section",
  label: "Round bar",
  fields: [{ key: "dia", label: "Diameter", kind: "number", unit: "mm" }, LENGTH],
  compute(inp, { density }) {
    const d = pos(inp, "dia", "Diameter");
    const L = pos(inp, "length", "Cut length");
    const kpm = ((Math.PI * d * d) / 4) * density / 1000;
    return lengthResult(kpm, L, `kg/m = π × ${f(d)}² / 4 × ${f(density)} / 1000 = ${f(kpm)}`);
  },
};

export const squareBar: ItemType = {
  id: "square-bar",
  category: "section",
  label: "Square bar",
  fields: [{ key: "side", label: "Side", kind: "number", unit: "mm" }, LENGTH],
  compute(inp, { density }) {
    const a = pos(inp, "side", "Side");
    const L = pos(inp, "length", "Cut length");
    const kpm = (a * a * density) / 1000;
    return lengthResult(kpm, L, `kg/m = ${f(a)}² × ${f(density)} / 1000 = ${f(kpm)}`);
  },
};

export const structural: ItemType = {
  id: "structural",
  category: "section",
  label: "Angle / channel / beam (ISA / ISMC / ISMB)",
  fields: [
    { key: "series", label: "Series", kind: "select", options: Object.keys(STRUCTURAL).map((v) => ({ value: v, label: v })) },
    { key: "size", label: "Size", kind: "select", help: "Options depend on series" },
    LENGTH,
  ],
  compute(inp, { density }) {
    const series = str(inp, "series") as keyof typeof STRUCTURAL;
    const size = str(inp, "size");
    const msKpm = STRUCTURAL[series]?.[size];
    if (!msKpm) throw new CalcError(`No table entry for ${series} ${size}`);
    const L = pos(inp, "length", "Cut length");
    const kpm = (msKpm * density) / MS_DENSITY;
    const how =
      density === MS_DENSITY
        ? `${series} ${size}: ${f(msKpm)} kg/m`
        : `${series} ${size}: ${f(msKpm)} kg/m (MS) × ${f(density)} / ${MS_DENSITY} = ${f(kpm)} kg/m`;
    return lengthResult(kpm, L, how);
  },
};

/** Equal angle by the workbook's ANGLE() formula (2 × width × L × t). */
export const angleCustom: ItemType = {
  id: "angle-custom",
  category: "section",
  label: "Angle custom (workbook formula)",
  fields: [
    { key: "width", label: "Leg width", kind: "number", unit: "mm" },
    { key: "thk", label: "THK", kind: "number", unit: "mm" },
    LENGTH,
  ],
  compute(inp, { density }) {
    const w = pos(inp, "width", "Leg width");
    const t = pos(inp, "thk", "THK");
    const L = pos(inp, "length", "Cut length");
    const kpm = (2 * w * t * density) / 1000;
    return lengthResult(kpm, L, `kg/m = 2 × ${f(w)} × ${f(t)} × ${f(density)} / 1000 = ${f(kpm)}`);
  },
};
