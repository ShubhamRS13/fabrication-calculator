import type { CostingInput, CostingOutput, ItemOutput } from "./costing";
import { findKind, type Template } from "./bought-catalogue";
import { buildRegistry } from "./registry";
import { BUILT_IN_LIBRARY, type SectionLibrary } from "./sections-lib";
import { itemSize } from "./size";
import type { ItemType, PriceUnit } from "./types";

// Raw material list: what to buy for a costing, grouped the way it is ordered.
// Built from the costing engine's output, so it always matches the costing:
// sheets by material + thickness (kg), pipes / flats / sections by size (metres),
// hardware and bought-outs by catalogue name (qty), job work by piece.

export type RmGroup = "sheet" | "pipe" | "flat" | "section" | "other" | "hardware" | "bought" | "jobwork";

export const RM_GROUP_ORDER: RmGroup[] = ["sheet", "pipe", "flat", "section", "other", "hardware", "bought", "jobwork"];

export const RM_GROUP_LABEL: Record<RmGroup, string> = {
  sheet: "Sheets / plates",
  pipe: "Pipes & tubes",
  flat: "Flats",
  section: "Sections & bars",
  other: "Other material",
  hardware: "Hardware",
  bought: "Bought-outs",
  jobwork: "Job work",
};

/** One use of a row: an item (or one flat piece of it) on a drawing. */
export interface RmLine {
  drawingId: string;
  drawingNo: string;
  itemId: string;
  itemNo?: string;
  itemName: string;
  /** Assembly name, when the item sits in one. */
  assembly?: string;
  /** Total pieces (item qty × assembly qty × pieces per item). */
  qty: number;
  /** Sheets: ideal sheet rectangle of one piece, mm (w ≤ l). */
  w?: number;
  l?: number;
  /** Cut length of one piece, mm (pipes, flats, sections). */
  lengthMm?: number;
  /** Process kg of these pieces (bought-outs: their weight, when entered). */
  kg: number;
}

export interface RmRow {
  key: string;
  group: RmGroup;
  material: string;
  /** "3 mm", "4 mm chequered", "Pipe 50 NB SCH 10S", "Flat 50 × 6", "Hex bolt M12 × 50"… */
  label: string;
  /** Sheets: nominal thickness, mm. */
  thk?: number;
  /** Process kg (weighed groups). */
  processKg: number;
  burningKg: number;
  /** What to buy: process + burning. */
  buyKg: number;
  finishKg: number;
  /** Total cut length, m (pipes, flats, sections; bought-outs priced by metre). */
  lengthM: number;
  /** Pieces (sheets: flat pieces; bought-outs: qty in `unit`). */
  pieces: number;
  /** Longest single piece, mm (pipes, flats, sections). */
  longestMm: number;
  /** Largest sheet piece, mm (sheets). */
  largest?: { w: number; l: number };
  /** Bought-outs / hardware / job work: unit the qty is counted in. */
  unit?: PriceUnit;
  drawings: string[];
  lines: RmLine[];
}

export interface RmSkipped {
  drawingId: string;
  drawingNo: string;
  itemId: string;
  itemNo?: string;
  itemName: string;
  error: string;
}

export interface RawMaterialList {
  rows: RmRow[];
  /** Items with an error (bad sizes, unknown type): not in the list. */
  skipped: RmSkipped[];
}

const PIPE_TYPES = new Set(["pipe-sch", "pipe-is1239", "pipe-swg", "pipe-custom", "rect-tube"]);
const FLAT_TYPES = new Set(["flat", "ring-flange"]);
const HARDWARE: Template[] = ["bolt", "nut", "washer", "set"];
/** "Other" and older bought items carry free text; these words mark them as hardware. */
const HARDWARE_WORDS = /\b(BOLTS?|NUTS?|WASHERS?|STUDS?|SCREWS?|RIVETS?|SPLIT PINS?|THREADED RODS?)\b/i;

const num = (v: unknown) => Number(v) || 0;

export function rawMaterialList(c: CostingInput, out: CostingOutput): RawMaterialList {
  const registry = buildRegistry(c.customShapes);
  const lib = c.sections ?? BUILT_IN_LIBRARY;
  const rows = new Map<string, RmRow>();
  const skipped: RmSkipped[] = [];

  const row = (group: RmGroup, material: string, label: string, drawingNo: string, init?: Partial<RmRow>): RmRow => {
    const key = `${group}|${material}|${label}`;
    let r = rows.get(key);
    if (!r) {
      r = {
        key, group, material, label,
        processKg: 0, burningKg: 0, buyKg: 0, finishKg: 0, lengthM: 0, pieces: 0, longestMm: 0,
        drawings: [], lines: [], ...init,
      };
      rows.set(key, r);
    }
    if (!r.drawings.includes(drawingNo)) r.drawings.push(drawingNo);
    return r;
  };
  const addWeights = (r: RmRow, it: ItemOutput) => {
    r.processKg += it.processWt;
    r.burningKg += it.burning;
    r.buyKg += it.processWt + it.burning;
    r.finishKg += it.finishWt;
  };

  for (const d of out.drawings) {
    const drawingNo = d.drawing.drawingNo;
    const assemblies = new Map((d.drawing.assemblies ?? []).map((a) => [a.id, a.name]));
    for (const it of d.items) {
      const base = {
        drawingId: d.drawing.id,
        drawingNo,
        itemId: it.item.id,
        itemNo: it.item.itemNo,
        itemName: it.item.name,
        assembly: it.item.assemblyId ? assemblies.get(it.item.assemblyId) : undefined,
      };
      if (it.error || !it.unit) {
        skipped.push({ ...base, error: it.error ?? "No result" });
        continue;
      }
      const type = registry.get(it.item.type);
      const unit = it.unit;
      const n = it.multiplier;
      const group = groupOf(it, type, lib);

      if (group === "sheet") {
        const thk = num(it.item.inputs.thk);
        const chequered = it.item.type === "plate" && num(it.item.inputs.thkAllowance) > 0;
        const label = it.price?.group === "plate" ? it.price.label : `${thk} mm`;
        const r = row("sheet", it.material, chequered ? `${label} chequered` : label, drawingNo, { thk });
        addWeights(r, it);
        const pieces = unit.mass?.pieces ?? [];
        const perUnitKg = pieces.reduce((a, p) => a + p.frame.mass, 0) || 1;
        for (const p of pieces) {
          const w = Math.min(p.frameW, p.frameH);
          const l = Math.max(p.frameW, p.frameH);
          const qty = p.count * n;
          r.pieces += qty;
          r.lines.push({ ...base, qty, w, l, kg: (it.processWt * p.frame.mass) / perUnitKg });
          if (!r.largest || l > r.largest.l || (l === r.largest.l && w > r.largest.w)) r.largest = { w, l };
        }
      } else if (group === "pipe" || group === "flat" || group === "section") {
        const r = row(group, it.material, it.price!.label, drawingNo);
        addWeights(r, it);
        // Rings rolled from flat carry their strip length (with allowance) in the development.
        const lengthMm = unit.cutLength ?? unit.development?.cutLength ?? 0;
        r.lengthM += (lengthMm * n) / 1000;
        r.pieces += n;
        r.longestMm = Math.max(r.longestMm, lengthMm);
        r.lines.push({ ...base, qty: n, lengthMm, kg: it.processWt });
      } else if (group === "other") {
        const r = row("other", it.material, type?.label ?? it.item.type, drawingNo);
        addWeights(r, it);
        r.pieces += n;
        r.lines.push({ ...base, qty: n, kg: it.processWt });
      } else {
        // Hardware / bought-out: catalogue name, or the older items' own text.
        const label = it.price?.label ?? ([it.item.name, itemSize(type, it.item.inputs, lib)].filter(Boolean).join(" ") || it.item.type);
        const kind = findKind(lib.boughtKinds, String(it.item.inputs.kind ?? ""));
        const unitOf = (it.price ? c.prices?.[it.price.key]?.unit : undefined) ?? kind?.unit ?? "piece";
        const r = row(group, it.material, label, drawingNo, { unit: unitOf });
        r.pieces += n;
        r.lengthM += it.lengthM ?? 0;
        r.finishKg += it.finishWt;
        const pieceLength = num(it.item.inputs.pieceLength);
        r.lines.push({ ...base, qty: n, kg: it.finishWt, ...(pieceLength ? { lengthMm: pieceLength } : {}) });
      }

      // Third-party work on top (dish forming): its own row, the blank stays under Sheets.
      if (it.job) {
        const r = row("jobwork", it.material, it.job.label, drawingNo, { unit: "piece" });
        r.pieces += n;
        r.lines.push({ ...base, qty: n, kg: 0 });
      }
    }
  }

  const sorted = [...rows.values()].sort(
    (a, b) =>
      RM_GROUP_ORDER.indexOf(a.group) - RM_GROUP_ORDER.indexOf(b.group) ||
      a.material.localeCompare(b.material) ||
      (a.thk ?? 0) - (b.thk ?? 0) ||
      a.label.localeCompare(b.label, undefined, { numeric: true }),
  );
  for (const r of sorted) {
    r.lines.sort((a, b) => (b.l ?? b.lengthMm ?? 0) - (a.l ?? a.lengthMm ?? 0) || (b.w ?? 0) - (a.w ?? 0));
  }
  return { rows: sorted, skipped };
}

function groupOf(it: ItemOutput, type: ItemType | undefined, lib: SectionLibrary): RmGroup {
  const unit = it.unit!;
  if (!unit.costedByWeight) {
    const kind = it.item.type === "bought" ? findKind(lib.boughtKinds, String(it.item.inputs.kind ?? "")) : undefined;
    if (kind && kind.template !== "other") return HARDWARE.includes(kind.template) ? "hardware" : "bought";
    return HARDWARE_WORDS.test(`${it.price?.label ?? ""} ${it.item.name}`) ? "hardware" : "bought";
  }
  if (it.price?.group === "size") {
    if (PIPE_TYPES.has(it.item.type)) return "pipe";
    if (FLAT_TYPES.has(it.item.type)) return "flat";
    return "section";
  }
  if (it.price?.group === "plate") return "sheet";
  // Weighed items cut from sheet without a plate price (e.g. dished-end blank by factor).
  if (unit.dev && num(it.item.inputs.thk) > 0 && type?.category !== "custom") return "sheet";
  return "other";
}

