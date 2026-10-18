import { CalcError, type FieldDef, type ItemResult, type ItemType } from "../types";
import { f, optNum, pos, str } from "../helpers";
import { MS_DENSITY, SERIES_INFO } from "../data/sections";
import { BUILT_IN_LIBRARY, bySize, type SectionLibrary } from "../sections-lib";

// Pipes, tubes, bars and rolled sections. All are cut to length:
// process = finish = kg/m × L / 1000, scrap 0. Table sizes come from the section
// library (Settings → Section tables), so added sizes appear here.

const LENGTH: FieldDef = { key: "length", label: "Cut length L", kind: "number", unit: "mm" };
const PIPES = "Pipes";
const BARS = "Tubes & bars";
const ROLLED = "Rolled sections";

const libOf = (ctx: { lib?: SectionLibrary }) => ctx.lib ?? BUILT_IN_LIBRARY;
const opts = (keys: string[], label = (k: string) => k) => [...keys].sort(bySize).map((k) => ({ value: k, label: label(k) }));

/** Sections are cut to length: process = finish = kg/m × L / 1000, scrap 0. */
function lengthResult(kgPerM: number, L: number, how: string): ItemResult {
  const wt = (kgPerM * L) / 1000;
  return {
    finishWt: wt,
    processWt: wt,
    scrap: 0,
    kgPerM,
    cutLength: L,
    fixedCost: 0,
    costedByWeight: true,
    formula: `${how}\nWeight = ${f(kgPerM)} kg/m × ${f(L)} / 1000 = ${f(wt)} kg`,
  };
}

/** kg/m of a round tube: π × t × (OD − t) × ρ / 1000 (same as the workbook PIPE()). */
const tubeKgPerM = (od: number, t: number, density: number) => (Math.PI * t * (od - t) * density) / 1000;
const TUBE_FORMULA = ["kg/m = π × t × (OD − t) × ρ / 1000", "Weight = kg/m × L / 1000"];

// ---------- pipes ----------

const SCH_LABEL = (s: string) => `SCH ${s}`;

export const pipeSch: ItemType = {
  id: "pipe-sch",
  category: "section",
  family: PIPES,
  label: "Pipe (NB + schedule)",
  description: "Seamless / welded pipe by nominal bore and schedule (5S, 10S, 40, 80).",
  formulaText: TUBE_FORMULA,
  sizeLabel: (i) => `Pipe ${str(i, "nb")} NB SCH ${str(i, "sch")}`,
  fields: [
    { key: "sch", label: "Schedule", kind: "select", dependentOptions: (_i, lib) => opts(Object.keys(lib.pipeSch), SCH_LABEL) },
    { key: "nb", label: "NB", kind: "select", dependentOptions: (inp, lib) => opts(Object.keys(lib.pipeSch[str(inp, "sch")] ?? {}), (k) => `${k} NB`) },
    LENGTH,
  ],
  compute(inp, ctx) {
    const nb = str(inp, "nb");
    const sch = str(inp, "sch");
    const p = libOf(ctx).pipeSch[sch]?.[nb];
    if (!p) throw new CalcError(`No table entry for ${nb} NB SCH ${sch}`);
    const L = pos(inp, "length", "Cut length");
    const kpm = tubeKgPerM(p.od, p.wall, ctx.density);
    return lengthResult(kpm, L, `${nb} NB SCH ${sch}: OD ${f(p.od)}, wall ${f(p.wall)}\nkg/m = π × ${f(p.wall)} × (${f(p.od)} − ${f(p.wall)}) × ${f(ctx.density)} / 1000 = ${f(kpm)}`);
  },
};

const IS1239_CLASS: Record<string, string> = { L: "Light (A)", M: "Medium (B)", H: "Heavy (C)" };

export const pipeIs1239: ItemType = {
  id: "pipe-is1239",
  category: "section",
  family: PIPES,
  label: "Pipe IS 1239 (Light / Medium / Heavy)",
  description: "ERW / GI pipe to IS 1239, class A (light), B (medium) or C (heavy).",
  formulaText: TUBE_FORMULA,
  sizeLabel: (i) => `Pipe ${str(i, "nb")} NB IS 1239 ${IS1239_CLASS[str(i, "cls")] ?? str(i, "cls")}`,
  fields: [
    { key: "cls", label: "Class", kind: "select", dependentOptions: (_i, lib) => opts(Object.keys(lib.is1239), (k) => IS1239_CLASS[k] ?? k) },
    { key: "nb", label: "NB", kind: "select", dependentOptions: (inp, lib) => opts(Object.keys(lib.is1239[str(inp, "cls")] ?? {}), (k) => `${k} NB`) },
    LENGTH,
  ],
  compute(inp, ctx) {
    const nb = str(inp, "nb");
    const cls = str(inp, "cls");
    const p = libOf(ctx).is1239[cls]?.[nb];
    if (!p) throw new CalcError(`No IS 1239 entry for ${nb} NB class ${cls}`);
    const L = pos(inp, "length", "Cut length");
    const kpm = tubeKgPerM(p.od, p.wall, ctx.density);
    return lengthResult(kpm, L, `${nb} NB IS 1239 ${IS1239_CLASS[cls] ?? cls}: OD ${f(p.od)}, wall ${f(p.wall)}\nkg/m = π × ${f(p.wall)} × (${f(p.od)} − ${f(p.wall)}) × ${f(ctx.density)} / 1000 = ${f(kpm)}`);
  },
};

export const pipeSwg: ItemType = {
  id: "pipe-swg",
  category: "section",
  family: PIPES,
  label: "Pipe / tube (OD + SWG)",
  description: "Tube given by outside diameter and wire gauge, e.g. 101.6 OD 10 SWG.",
  formulaText: TUBE_FORMULA,
  sizeLabel: (i) => `Tube ${str(i, "od")} OD ${str(i, "swg")} SWG`,
  fields: [
    { key: "od", label: "OD", kind: "number", unit: "mm" },
    { key: "swg", label: "SWG", kind: "select", dependentOptions: (_i, lib) => opts(Object.keys(lib.swg), (k) => `${k} SWG`) },
    LENGTH,
  ],
  compute(inp, ctx) {
    const od = pos(inp, "od", "OD");
    const g = str(inp, "swg");
    const t = libOf(ctx).swg[g];
    if (!t) throw new CalcError(`Unknown gauge ${g} SWG`);
    const L = pos(inp, "length", "Cut length");
    const kpm = tubeKgPerM(od, t, ctx.density);
    return lengthResult(kpm, L, `${f(od)} OD ${g} SWG (${f(t)} mm)\nkg/m = π × ${f(t)} × (${f(od)} − ${f(t)}) × ${f(ctx.density)} / 1000 = ${f(kpm)}`);
  },
};

export const pipeCustom: ItemType = {
  id: "pipe-custom",
  category: "section",
  family: PIPES,
  label: "Pipe / tube custom",
  description: "Any round tube from its outside diameter and wall thickness.",
  formulaText: TUBE_FORMULA,
  sizeLabel: (i) => `Tube ${str(i, "od")} OD × ${str(i, "thk")}`,
  fields: [{ key: "od", label: "OD", kind: "number", unit: "mm" }, { key: "thk", label: "THK t", kind: "number", unit: "mm" }, LENGTH],
  compute(inp, { density }) {
    const od = pos(inp, "od", "OD");
    const t = pos(inp, "thk", "THK");
    if (2 * t >= od) throw new CalcError("THK is too large for this OD");
    const L = pos(inp, "length", "Cut length");
    const kpm = tubeKgPerM(od, t, density);
    return lengthResult(kpm, L, `kg/m = π × ${f(t)} × (${f(od)} − ${f(t)}) × ${f(density)} / 1000 = ${f(kpm)}`);
  },
};

// ---------- tubes & bars ----------

export const rectTube: ItemType = {
  id: "rect-tube",
  category: "section",
  family: BARS,
  label: "Square / rectangular tube",
  description: "Hollow section A × B × t. Enter the supplier's std kg/m to override.",
  formulaText: ["kg/m = 2 × t × (A + B − 2t) × ρ / 1000 (corners ignored)", "Weight = kg/m × L / 1000"],
  sizeLabel: (i) => `Tube ${str(i, "a")} × ${str(i, "b")} × ${str(i, "thk")}`,
  fields: [
    { key: "a", label: "Side A", kind: "number", unit: "mm" },
    { key: "b", label: "Side B", kind: "number", unit: "mm" },
    { key: "thk", label: "THK t", kind: "number", unit: "mm" },
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

export const roundBar: ItemType = {
  id: "round-bar",
  category: "section",
  family: BARS,
  label: "Round bar",
  description: "Solid round bar of diameter d.",
  formulaText: ["kg/m = π × d² / 4 × ρ / 1000", "Weight = kg/m × L / 1000"],
  sizeLabel: (i) => `Round bar Ø${str(i, "dia")}`,
  fields: [{ key: "dia", label: "Diameter d", kind: "number", unit: "mm" }, LENGTH],
  compute(inp, { density }) {
    const d = pos(inp, "dia", "Diameter");
    const L = pos(inp, "length", "Cut length");
    const kpm = (((Math.PI * d * d) / 4) * density) / 1000;
    return lengthResult(kpm, L, `kg/m = π × ${f(d)}² / 4 × ${f(density)} / 1000 = ${f(kpm)}`);
  },
};

export const squareBar: ItemType = {
  id: "square-bar",
  category: "section",
  family: BARS,
  label: "Square bar",
  description: "Solid square bar of side a.",
  formulaText: ["kg/m = a² × ρ / 1000", "Weight = kg/m × L / 1000"],
  sizeLabel: (i) => `Square bar ${str(i, "side")}`,
  fields: [{ key: "side", label: "Side a", kind: "number", unit: "mm" }, LENGTH],
  compute(inp, { density }) {
    const a = pos(inp, "side", "Side");
    const L = pos(inp, "length", "Cut length");
    const kpm = (a * a * density) / 1000;
    return lengthResult(kpm, L, `kg/m = ${f(a)}² × ${f(density)} / 1000 = ${f(kpm)}`);
  },
};

export const hexBar: ItemType = {
  id: "hex-bar",
  category: "section",
  family: BARS,
  label: "Hex bar",
  description: "Solid hexagon bar, sized across flats (A/F).",
  formulaText: ["Area = √3 / 2 × s²  (s = across flats)", "kg/m = Area × ρ / 1000"],
  sizeLabel: (i) => `Hex bar ${str(i, "af")} A/F`,
  fields: [{ key: "af", label: "Across flats s", kind: "number", unit: "mm" }, LENGTH],
  compute(inp, { density }) {
    const s = pos(inp, "af", "Across flats");
    const L = pos(inp, "length", "Cut length");
    const area = (Math.sqrt(3) / 2) * s * s;
    const kpm = (area * density) / 1000;
    return lengthResult(kpm, L, `Area = √3 / 2 × ${f(s)}² = ${f(area)} mm²\nkg/m = ${f(area)} × ${f(density)} / 1000 = ${f(kpm)}`);
  },
};

// ---------- rolled sections (IS 808) ----------

type Group = "angle" | "channel" | "beam" | "hbeam";

/** Series that belong to a picker group; user-added series appear under "Any series". */
const seriesIn = (lib: SectionLibrary, group?: Group) =>
  Object.keys(lib.kgPerM).filter((s) => (group ? SERIES_INFO[s]?.group === group : true));

function rolledSection(id: string, label: string, description: string, group?: Group): ItemType {
  return {
    id,
    category: "section",
    family: ROLLED,
    label,
    description,
    formulaText: ["kg/m from the IS 808 table (MS)", "kg/m for other materials = table × ρ / 7.85", "Weight = kg/m × L / 1000"],
    sizeLabel: (i) => `${str(i, "series")} ${str(i, "size")}`,
    fields: [
      {
        key: "series",
        label: "Series",
        kind: "select",
        dependentOptions: (_i, lib) => seriesIn(lib, group).map((s) => ({ value: s, label: SERIES_INFO[s]?.name ?? s })),
      },
      {
        key: "size",
        label: "Size",
        kind: "select",
        dependentOptions: (inp, lib) => opts(Object.keys(lib.kgPerM[str(inp, "series")] ?? {})),
      },
      LENGTH,
    ],
    compute(inp, ctx) {
      const series = str(inp, "series");
      const size = str(inp, "size");
      const msKpm = libOf(ctx).kgPerM[series]?.[size];
      if (!msKpm) throw new CalcError(`No table entry for ${series} ${size}`);
      const L = pos(inp, "length", "Cut length");
      const kpm = (msKpm * ctx.density) / MS_DENSITY;
      const how =
        ctx.density === MS_DENSITY
          ? `${series} ${size}: ${f(msKpm)} kg/m`
          : `${series} ${size}: ${f(msKpm)} kg/m (MS) × ${f(ctx.density)} / ${MS_DENSITY} = ${f(kpm)} kg/m`;
      return lengthResult(kpm, L, how);
    },
  };
}

export const angleStd = rolledSection("angle-std", "Angle – ISA (equal / unequal)", "Rolled angle from the IS 808 table, e.g. ISA 50 × 50 × 6 or 75 × 50 × 6.", "angle");
export const channelStd = rolledSection("channel-std", "Channel – C (ISMC / ISLC / ISJC)", "Rolled C channel from the IS 808 table.", "channel");
export const beamI = rolledSection("beam-i", "Beam – I (ISMB / ISLB / ISJB / ISWB)", "Rolled I beam from the IS 808 table.", "beam");
export const beamH = rolledSection("beam-h", "H beam (ISHB)", "Rolled H beam from the IS 808 table; heavier variants listed by kg/m.", "hbeam");
/** Kept as "structural" so saved items keep working; lists every series, including ones added in Settings. */
export const structural = rolledSection("structural", "Rolled section – any series", "Any series in the section tables, including the ones you add in Settings.");

const SHAPES = [
  { value: "I", label: "I beam" },
  { value: "H", label: "H beam" },
  { value: "C", label: "C channel" },
];

export const sectionCustom: ItemType = {
  id: "section-custom",
  category: "section",
  family: ROLLED,
  label: "I / H / C section – custom size",
  description: "A section not in the tables, from its depth, flange width and thicknesses (root radii ignored).",
  formulaText: ["Area = 2 × B × tf + (D − 2 tf) × tw", "kg/m = Area × ρ / 1000", "Weight = kg/m × L / 1000"],
  sizeLabel: (i) => `${str(i, "shape", "I")} section ${str(i, "depth")} × ${str(i, "flange")} (tw ${str(i, "web")}, tf ${str(i, "flangeThk")})`,
  fields: [
    { key: "shape", label: "Shape", kind: "select", options: SHAPES, default: "I" },
    { key: "depth", label: "Depth D", kind: "number", unit: "mm" },
    { key: "flange", label: "Flange width B", kind: "number", unit: "mm" },
    { key: "web", label: "Web thickness tw", kind: "number", unit: "mm" },
    { key: "flangeThk", label: "Flange thickness tf", kind: "number", unit: "mm" },
    LENGTH,
  ],
  compute(inp, { density }) {
    const D = pos(inp, "depth", "Depth D");
    const B = pos(inp, "flange", "Flange width B");
    const tw = pos(inp, "web", "Web thickness tw");
    const tf = pos(inp, "flangeThk", "Flange thickness tf");
    if (2 * tf >= D) throw new CalcError("Flanges are thicker than the depth");
    if (tw > B) throw new CalcError("Web is thicker than the flange width");
    const L = pos(inp, "length", "Cut length");
    const area = 2 * B * tf + (D - 2 * tf) * tw;
    const kpm = (area * density) / 1000;
    const shape = SHAPES.find((s) => s.value === str(inp, "shape", "I"))?.label ?? "Section";
    return lengthResult(kpm, L, `${shape} ${f(D)} × ${f(B)} (tw ${f(tw)}, tf ${f(tf)})\nArea = 2 × ${f(B)} × ${f(tf)} + (${f(D)} − 2 × ${f(tf)}) × ${f(tw)} = ${f(area)} mm²\nkg/m = ${f(area)} × ${f(density)} / 1000 = ${f(kpm)}`);
  },
};

export const angleTrue: ItemType = {
  id: "angle-true",
  category: "section",
  family: ROLLED,
  label: "Angle – custom size (true area)",
  description: "Equal or unequal angle A × B × t not in the table (root radius ignored).",
  formulaText: ["Area = (A + B − t) × t", "kg/m = Area × ρ / 1000"],
  sizeLabel: (i) => `Angle ${str(i, "a")} × ${str(i, "b")} × ${str(i, "thk")}`,
  fields: [
    { key: "a", label: "Leg A", kind: "number", unit: "mm" },
    { key: "b", label: "Leg B", kind: "number", unit: "mm" },
    { key: "thk", label: "THK t", kind: "number", unit: "mm" },
    LENGTH,
  ],
  compute(inp, { density }) {
    const a = pos(inp, "a", "Leg A");
    const b = pos(inp, "b", "Leg B");
    const t = pos(inp, "thk", "THK");
    if (t >= Math.min(a, b)) throw new CalcError("THK is too large for these legs");
    const L = pos(inp, "length", "Cut length");
    const area = (a + b - t) * t;
    const kpm = (area * density) / 1000;
    return lengthResult(kpm, L, `Area = (${f(a)} + ${f(b)} − ${f(t)}) × ${f(t)} = ${f(area)} mm²\nkg/m = ${f(area)} × ${f(density)} / 1000 = ${f(kpm)}`);
  },
};

/** Equal angle by the workbook's ANGLE() formula (2 × width × L × t). */
export const angleCustom: ItemType = {
  id: "angle-custom",
  category: "section",
  family: ROLLED,
  label: "Angle – workbook formula (2 × W × t)",
  description: "The old workbook's ANGLE() formula; slightly heavier than the true area. Kept for matching old costings.",
  formulaText: ["kg/m = 2 × W × t × ρ / 1000"],
  sizeLabel: (i) => `Angle ${str(i, "width")} × ${str(i, "width")} × ${str(i, "thk")}`,
  fields: [{ key: "width", label: "Leg width W", kind: "number", unit: "mm" }, { key: "thk", label: "THK t", kind: "number", unit: "mm" }, LENGTH],
  compute(inp, { density }) {
    const w = pos(inp, "width", "Leg width");
    const t = pos(inp, "thk", "THK");
    const L = pos(inp, "length", "Cut length");
    const kpm = (2 * w * t * density) / 1000;
    return lengthResult(kpm, L, `kg/m = 2 × ${f(w)} × ${f(t)} × ${f(density)} / 1000 = ${f(kpm)}`);
  },
};

export const SECTION_TYPES: ItemType[] = [
  pipeSch, pipeIs1239, pipeSwg, pipeCustom,
  rectTube, roundBar, squareBar, hexBar,
  angleStd, channelStd, beamI, beamH, sectionCustom, angleTrue, structural, angleCustom,
];
