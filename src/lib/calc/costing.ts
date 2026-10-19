import type { ItemInputs, ItemResult, ItemType, Material, PriceGroup, PriceRef, PriceUnit } from "./types";
import { familyOf, findMaterial } from "./materials";
import { buildRegistry } from "./registry";
import type { CustomShapeDef } from "./custom";
import { BUILT_IN_LIBRARY, type SectionLibrary } from "./sections-lib";
import { findKind } from "./bought-catalogue";

// ---------- Inputs ----------

/** "ALL", a family ("SS" / "MS"), or one material ("MAT:SS304"). */
export type AppliesTo = "ALL" | "SS" | "MS" | `MAT:${string}`;

export interface ChargeLine {
  id: string;
  name: string;
  /** ₹/kg; blank (null) counts as 0. */
  rate: number | null;
  basis: "process" | "finish";
  appliesTo: AppliesTo;
}

export interface MaterialRate {
  rate: number | null;
  scrapRate: number | null;
}

/** A rate on the Pricing page. Blank (null) = missing; 0 = deliberately free. */
export interface Price {
  rate: number | null;
  unit: PriceUnit;
}

/** Price key: group + material + label, e.g. "size|SS304|Pipe 50 NB SCH 40". */
export const priceKey = (group: PriceGroup, material: string, label: string) => `${group}|${material}|${label}`;

/** Units each group can be priced in; the first is the default. */
export const UNITS_BY_GROUP: Record<PriceGroup, PriceUnit[]> = {
  plate: ["kg"],
  size: ["kg", "m", "piece"],
  bought: ["piece", "set", "kg", "m"],
  jobwork: ["piece"],
};

export interface ItemInput {
  id: string;
  /** Balloon / Sr. no. on the drawing, e.g. "19A". */
  itemNo?: string;
  type: string;
  name: string;
  dwgSheet?: string;
  qty: number;
  material?: string;
  burningPct?: number;
  assemblyId?: string;
  inputs: ItemInputs;
}

export interface AssemblyInput {
  id: string;
  name: string;
  qty: number;
  material?: string;
  burningPct?: number;
}

export interface DrawingInput {
  id: string;
  drawingNo: string;
  title: string;
  material?: string;
  burningPct?: number;
  assemblies?: AssemblyInput[];
  items: ItemInput[];
}

export interface CostingInput {
  defaultMaterial: string;
  /** Percent, e.g. 3 for 3%. */
  burningPct: number;
  profitPct: number;
  materials: Material[];
  rates: Record<string, MaterialRate>;
  chargeLines: ChargeLine[];
  drawings: DrawingInput[];
  customShapes?: CustomShapeDef[];
  /** Section & pipe tables (from Settings); built-in tables when absent. */
  sections?: SectionLibrary;
  /** Rates from the Pricing page, by price key. */
  prices?: Record<string, Price>;
}

// ---------- Outputs ----------

export interface ItemOutput {
  item: ItemInput;
  material: string;
  burningPct: number;
  /** item qty × assembly qty */
  multiplier: number;
  unit: ItemResult | null;
  error?: string;
  /** Totals for all pieces. */
  finishWt: number;
  processWt: number;
  scrap: number;
  burning: number;
  /** (process + burning) × rate — 0 for bought items */
  materialAmount: number;
  scrapCredit: number;
  /** bought price / job work × multiplier */
  fixedAmount: number;
  /** What the item is priced as on the Pricing page. */
  price?: { key: string; group: PriceGroup; label: string };
  /** Third-party job work (e.g. dish forming). */
  job?: { key: string; label: string };
  /** How the amount was worked out. */
  pricedBy?: "material" | PriceUnit | "item rate";
  /** A rate this item needs is blank. */
  missing?: boolean;
  /** Total cut length, m (sections, or bought ₹/m items). */
  lengthM?: number;
}

export interface MaterialTotals {
  material: string;
  process: number;
  finish: number;
  scrap: number;
  burning: number;
  amount: number;
  scrapCredit: number;
  /** amount − scrapCredit */
  net: number;
}

export interface ChargeOutput {
  line: ChargeLine;
  weight: number;
  amount: number;
}

export interface DrawingOutput {
  drawing: DrawingInput;
  items: ItemOutput[];
  byMaterial: MaterialTotals[];
  materialTotal: number;
  charges: ChargeOutput[];
  chargesTotal: number;
  boughtTotal: number;
  /** Weight of bought items (shown only, not costed by weight). */
  boughtWt: number;
  total: number;
}

export interface CostingOutput {
  drawings: DrawingOutput[];
  byMaterial: MaterialTotals[];
  subtotal: number;
  profit: number;
  grandTotal: number;
  /** Every rate the costing needs, for the Pricing page. */
  prices: PriceRow[];
  /** Rates still blank (material, price rows, charge lines). */
  missing: MissingRate[];
}

export interface PriceRow {
  key: string;
  group: PriceGroup;
  label: string;
  material: string;
  /** Process kg, metres and pieces across every drawing and assembly. */
  kg: number;
  m: number;
  pieces: number;
  amount: number;
  drawings: string[];
  rate: number | null;
  unit: PriceUnit;
  /** Blank rate and nothing to fall back on. */
  missing: boolean;
}

export interface MissingRate {
  kind: "material" | "price" | "charge";
  label: string;
}


// ---------- Engine ----------

export function chargeApplies(appliesTo: AppliesTo, material: string): boolean {
  if (appliesTo === "ALL") return true;
  if (appliesTo.startsWith("MAT:")) return appliesTo.slice(4).toUpperCase() === material.toUpperCase();
  return familyOf(material) === appliesTo;
}

function emptyTotals(material: string): MaterialTotals {
  return { material, process: 0, finish: 0, scrap: 0, burning: 0, amount: 0, scrapCredit: 0, net: 0 };
}

function addTotals(into: MaterialTotals, t: MaterialTotals) {
  into.process += t.process;
  into.finish += t.finish;
  into.scrap += t.scrap;
  into.burning += t.burning;
  into.amount += t.amount;
  into.scrapCredit += t.scrapCredit;
  into.net += t.net;
}

export function computeItem(
  item: ItemInput,
  ctx: {
    type?: ItemType;
    material: string;
    materials: Material[];
    burningPct: number;
    multiplier: number;
    rate: MaterialRate | undefined;
    sections?: SectionLibrary;
    prices?: Record<string, Price>;
  },
): ItemOutput {
  const out: ItemOutput = {
    item, material: ctx.material, burningPct: ctx.burningPct, multiplier: ctx.multiplier, unit: null,
    finishWt: 0, processWt: 0, scrap: 0, burning: 0, materialAmount: 0, scrapCredit: 0, fixedAmount: 0,
  };
  const mat = findMaterial(ctx.materials, ctx.material);
  if (!ctx.type) return { ...out, error: `Unknown item type "${item.type}"` };
  if (!mat && ctx.type.category !== "bought") return { ...out, error: `Unknown material "${ctx.material}"` };
  const lib = ctx.sections ?? BUILT_IN_LIBRARY;
  let unit: ItemResult;
  try {
    unit = ctx.type.compute(item.inputs, { density: mat?.density ?? 0, lib });
  } catch (err) {
    return { ...out, error: (err as Error).message };
  }
  const n = ctx.multiplier;
  out.unit = unit;
  out.finishWt = unit.finishWt * n;
  out.processWt = unit.processWt * n;
  out.scrap = unit.scrap * n;
  if (unit.cutLength !== undefined) out.lengthM = (unit.cutLength * n) / 1000;

  // What this item is priced as. Sheet items without their own are priced by thickness.
  let ref: PriceRef | null = ctx.type.priceRef?.(item.inputs, lib) ?? null;
  if (!ref && ctx.type.category === "fabricated" && unit.costedByWeight && Number(item.inputs.thk) > 0) {
    ref = { group: "plate", label: `${Number(item.inputs.thk)} mm` };
  }
  if (ref) out.price = { key: priceKey(ref.group, ctx.material, ref.label), group: ref.group, label: ref.label };
  const p = out.price ? ctx.prices?.[out.price.key] : undefined;
  const has = (x: Price | undefined): x is Price & { rate: number } => !!x && x.rate !== null;

  if (unit.costedByWeight) {
    out.burning = (out.processWt * ctx.burningPct) / 100;
    out.scrapCredit = out.scrap * (ctx.rate?.scrapRate ?? 0);
    if (has(p)) {
      // ₹/kg works like the material rate (burning included); ₹/m and ₹/piece price
      // the cut lengths / pieces directly.
      out.pricedBy = p.unit;
      out.materialAmount =
        p.unit === "kg" ? (out.processWt + out.burning) * p.rate : p.unit === "m" ? (out.lengthM ?? 0) * p.rate : n * p.rate;
    } else {
      out.pricedBy = "material";
      out.materialAmount = (out.processWt + out.burning) * (ctx.rate?.rate ?? 0);
      if (ctx.rate?.rate === null || ctx.rate?.rate === undefined) out.missing = true;
    }
  } else if (out.price?.group === "bought") {
    // Bought-out: quantity × rate in its unit. Weight never counts in material or labour.
    const perKg = Number(item.inputs.weight) || 0;
    const perM = (Number(item.inputs.pieceLength) || 0) / 1000;
    if (perM) out.lengthM = perM * n;
    if (has(p)) {
      out.pricedBy = p.unit;
      out.fixedAmount = p.unit === "kg" ? n * perKg * p.rate : p.unit === "m" ? n * perM * p.rate : n * p.rate;
      if ((p.unit === "kg" && !perKg) || (p.unit === "m" && !perM)) out.missing = true;
    } else {
      out.missing = true;
    }
  } else {
    // Older bought items carry their own rate.
    out.fixedAmount = unit.fixedCost * n;
    out.pricedBy = "item rate";
  }

  // Third-party job work (dish forming): Pricing page first, older per-item charge as fallback.
  const jobLabel = ctx.type.jobWorkRef?.(item.inputs);
  if (jobLabel) {
    out.job = { key: priceKey("jobwork", ctx.material, jobLabel), label: jobLabel };
    const j = ctx.prices?.[out.job.key];
    if (has(j)) out.fixedAmount += n * j.rate;
    else if (unit.fixedCost > 0) out.fixedAmount += unit.fixedCost * n;
    else out.missing = true;
  }
  return out;
}

export function computeDrawing(d: DrawingInput, c: CostingInput, registry: Map<string, ItemType>): DrawingOutput {
  const assemblies = new Map((d.assemblies ?? []).map((a) => [a.id, a]));
  const items = d.items.map((item) => {
    const asm = item.assemblyId ? assemblies.get(item.assemblyId) : undefined;
    const material = item.material || asm?.material || d.material || c.defaultMaterial;
    const burningPct = item.burningPct ?? asm?.burningPct ?? d.burningPct ?? c.burningPct;
    return computeItem(item, {
      type: registry.get(item.type),
      material,
      materials: c.materials,
      burningPct,
      multiplier: item.qty * (asm?.qty ?? 1),
      rate: c.rates[material],
      sections: c.sections,
      prices: c.prices,
    });
  });

  const byMat = new Map<string, MaterialTotals>();
  let boughtTotal = 0;
  let boughtWt = 0;
  for (const it of items) {
    boughtTotal += it.fixedAmount;
    if (!it.unit) continue;
    if (!it.unit.costedByWeight) {
      boughtWt += it.finishWt;
      continue;
    }
    const t = byMat.get(it.material) ?? emptyTotals(it.material);
    t.process += it.processWt;
    t.finish += it.finishWt;
    t.scrap += it.scrap;
    t.burning += it.burning;
    t.amount += it.materialAmount;
    t.scrapCredit += it.scrapCredit;
    t.net = t.amount - t.scrapCredit;
    byMat.set(it.material, t);
  }
  const byMaterial = [...byMat.values()];
  const materialTotal = byMaterial.reduce((a, t) => a + t.net, 0);

  const charges = c.chargeLines.map((line) => {
    const weight = byMaterial
      .filter((t) => chargeApplies(line.appliesTo, t.material))
      .reduce((a, t) => a + (line.basis === "process" ? t.process : t.finish), 0);
    return { line, weight, amount: weight * (line.rate ?? 0) };
  });
  const chargesTotal = charges.reduce((a, ch) => a + ch.amount, 0);

  return {
    drawing: d, items, byMaterial, materialTotal, charges, chargesTotal, boughtTotal, boughtWt,
    total: materialTotal + chargesTotal + boughtTotal,
  };
}

export function computeCosting(c: CostingInput): CostingOutput {
  const registry = buildRegistry(c.customShapes);
  const drawings = c.drawings.map((d) => computeDrawing(d, c, registry));
  const all = new Map<string, MaterialTotals>();
  for (const d of drawings) {
    for (const t of d.byMaterial) {
      const into = all.get(t.material) ?? emptyTotals(t.material);
      addTotals(into, t);
      all.set(t.material, into);
    }
  }
  const subtotal = drawings.reduce((a, d) => a + d.total, 0);
  const profit = (subtotal * c.profitPct) / 100;
  const prices = priceRows(drawings, c);
  return {
    drawings,
    byMaterial: [...all.values()],
    subtotal,
    profit,
    grandTotal: subtotal + profit,
    prices,
    missing: missingRates(drawings, prices, c),
  };
}

function jobAmount(it: ItemOutput, c: CostingInput): number {
  if (!it.job) return 0;
  const j = c.prices?.[it.job.key];
  if (j && j.rate !== null) return it.multiplier * j.rate;
  return (it.unit?.fixedCost ?? 0) * it.multiplier;
}

function defaultUnit(group: PriceGroup, it: ItemOutput, c: CostingInput): PriceUnit {
  if (group === "bought") {
    const kind = findKind((c.sections ?? BUILT_IN_LIBRARY).boughtKinds, String(it.item.inputs.kind ?? ""));
    if (kind) return kind.unit;
  }
  return UNITS_BY_GROUP[group][0];
}

/** Every distinct price key in the costing, with quantities and the amount it currently gives. */
function priceRows(drawings: DrawingOutput[], c: CostingInput): PriceRow[] {
  const rows = new Map<string, PriceRow>();
  const add = (key: string, group: PriceGroup, label: string, it: ItemOutput, drawingNo: string, amount: number, kg: number) => {
    const stored = c.prices?.[key];
    const r: PriceRow = rows.get(key) ?? {
      key,
      group,
      label,
      material: it.material,
      kg: 0,
      m: 0,
      pieces: 0,
      amount: 0,
      drawings: [],
      rate: stored?.rate ?? null,
      unit: stored?.unit ?? defaultUnit(group, it, c),
      missing: false,
    };
    r.kg += kg;
    r.m += group === "jobwork" ? 0 : (it.lengthM ?? 0);
    r.pieces += it.multiplier;
    r.amount += amount;
    if (!r.drawings.includes(drawingNo)) r.drawings.push(drawingNo);
    rows.set(key, r);
  };
  for (const d of drawings) {
    for (const it of d.items) {
      if (!it.unit || it.error) continue;
      if (it.price) {
        const amount = it.price.group === "bought" ? it.fixedAmount - jobAmount(it, c) : it.materialAmount;
        add(it.price.key, it.price.group, it.price.label, it, d.drawing.drawingNo, amount, it.unit.costedByWeight ? it.processWt : 0);
      }
      if (it.job) add(it.job.key, "jobwork", it.job.label, it, d.drawing.drawingNo, jobAmount(it, c), 0);
    }
  }
  for (const r of rows.values()) {
    // Plate and size rows fall back to the material rate; bought-outs and job work have nothing to fall back on.
    const fallback = r.group === "plate" || r.group === "size" ? (c.rates[r.material]?.rate ?? null) : null;
    r.missing = r.rate === null && fallback === null;
  }
  const order: PriceGroup[] = ["plate", "size", "bought", "jobwork"];
  return [...rows.values()].sort(
    (a, b) =>
      order.indexOf(a.group) - order.indexOf(b.group) ||
      a.material.localeCompare(b.material) ||
      a.label.localeCompare(b.label, undefined, { numeric: true }),
  );
}

function missingRates(drawings: DrawingOutput[], prices: PriceRow[], c: CostingInput): MissingRate[] {
  const out: MissingRate[] = [];
  // Materials actually priced by their ₹/kg rate.
  const used = new Set<string>();
  for (const d of drawings) for (const it of d.items) if (it.pricedBy === "material") used.add(it.material);
  for (const m of used) {
    if (c.rates[m]?.rate === null || c.rates[m]?.rate === undefined) out.push({ kind: "material", label: `${m} rate (₹/kg)` });
  }
  for (const p of prices) if (p.missing && (p.group === "bought" || p.group === "jobwork")) out.push({ kind: "price", label: `${p.material} · ${p.label}` });
  // Charge lines that apply to some weight but have no rate. Enter 0 (or remove the line) if not charged.
  for (const line of c.chargeLines) {
    const weight = drawings.reduce((a, d) => a + (d.charges.find((x) => x.line.id === line.id)?.weight ?? 0), 0);
    if (line.rate === null && weight > 0) out.push({ kind: "charge", label: line.name });
  }
  return out;
}


/** Starting charge lines for a new costing (rates blank, typed in per costing). */
export function defaultChargeLines(): ChargeLine[] {
  return [
    { id: "labour-ss", name: "Labour – SS", rate: null, basis: "finish", appliesTo: "SS" },
    { id: "labour-ms", name: "Labour – MS", rate: null, basis: "finish", appliesTo: "MS" },
    { id: "painting", name: "Painting", rate: null, basis: "finish", appliesTo: "MS" },
    { id: "polishing", name: "Polishing", rate: null, basis: "finish", appliesTo: "SS" },
    { id: "packaging", name: "Packaging", rate: null, basis: "finish", appliesTo: "ALL" },
  ];
}
