import type { ItemInputs, ItemResult, ItemType, Material } from "./types";
import { familyOf, findMaterial } from "./materials";
import { buildRegistry } from "./registry";
import type { CustomShapeDef } from "./custom";
import type { SectionLibrary } from "./sections-lib";

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
  ctx: { type?: ItemType; material: string; materials: Material[]; burningPct: number; multiplier: number; rate: MaterialRate | undefined; sections?: SectionLibrary },
): ItemOutput {
  const out: ItemOutput = {
    item, material: ctx.material, burningPct: ctx.burningPct, multiplier: ctx.multiplier, unit: null,
    finishWt: 0, processWt: 0, scrap: 0, burning: 0, materialAmount: 0, scrapCredit: 0, fixedAmount: 0,
  };
  const mat = findMaterial(ctx.materials, ctx.material);
  if (!ctx.type) return { ...out, error: `Unknown item type "${item.type}"` };
  if (!mat && ctx.type.category !== "bought") return { ...out, error: `Unknown material "${ctx.material}"` };
  let unit: ItemResult;
  try {
    unit = ctx.type.compute(item.inputs, { density: mat?.density ?? 0, lib: ctx.sections });
  } catch (err) {
    return { ...out, error: (err as Error).message };
  }
  const n = ctx.multiplier;
  out.unit = unit;
  out.finishWt = unit.finishWt * n;
  out.processWt = unit.processWt * n;
  out.scrap = unit.scrap * n;
  out.fixedAmount = unit.fixedCost * n;
  if (unit.costedByWeight) {
    out.burning = (out.processWt * ctx.burningPct) / 100;
    out.materialAmount = (out.processWt + out.burning) * (ctx.rate?.rate ?? 0);
    out.scrapCredit = out.scrap * (ctx.rate?.scrapRate ?? 0);
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
  return { drawings, byMaterial: [...all.values()], subtotal, profit, grandTotal: subtotal + profit };
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
