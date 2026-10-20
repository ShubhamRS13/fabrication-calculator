import type { AppliesTo, CostingInput, CostingOutput, DrawingOutput, ItemOutput } from "../calc/costing";
import { familyOf } from "../calc/materials";
import { buildRegistry } from "../calc/registry";
import { itemSize } from "../calc/size";
import type { PriceGroup, PriceUnit } from "../calc/types";

// Shared by the Excel and PDF exports, so both show the same things.

export interface ExportCompany {
  companyName: string;
  address: string;
  email: string;
  phone: string;
}

export interface ExportHeader {
  clientName: string;
  projectName: string;
  poNo: string;
  drawingRef: string;
  createdBy: string;
  /** YYYY-MM-DD */
  costingDate: string;
}

export interface ExportData {
  company: ExportCompany;
  header: ExportHeader;
  input: CostingInput;
  result: CostingOutput;
  /** PNG logo for the letterhead. */
  logo?: Uint8Array;
}

export const GROUP_LABEL: Record<PriceGroup, string> = {
  plate: "Plate by thickness",
  size: "Size",
  bought: "Bought-out",
  jobwork: "Job work",
};

export function appliesToLabel(a: AppliesTo): string {
  if (a === "ALL") return "All materials";
  if (a === "SS" || a === "MS") return `All ${a}`;
  return a.slice(4);
}

export const missingNote = (count: number, where: string) =>
  `Rates missing (${count}) — these amounts count as 0. Enter them on ${where}.`;

/** "Costing - Client - Project.xlsx", safe for a download name. */
export function exportFileName(header: ExportHeader, ext: string, prefix = "Costing"): string {
  const base = [prefix, header.clientName, header.projectName].filter(Boolean).join(" - ");
  return `${base.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 120)}.${ext}`;
}

/** Item type names and Size text, with the costing's custom shapes and tables. */
export function itemLabels(input: CostingInput) {
  const registry = buildRegistry(input.customShapes);
  return {
    typeLabel: (id: string) => registry.get(id)?.label ?? id,
    sizeOf: (it: ItemOutput) => itemSize(registry.get(it.item.type), it.item.inputs, input.sections),
  };
}

/** The rate and unit an item was priced at (what the engine used). */
export function itemRate(it: ItemOutput, data: ExportData): { rate: number | null; unit: PriceUnit | "" } {
  if (!it.unit || it.error) return { rate: null, unit: "" };
  const stored = it.price ? data.input.prices?.[it.price.key] : undefined;
  if (it.pricedBy === "material") return { rate: data.input.rates[it.material]?.rate ?? null, unit: "kg" };
  if (it.price) {
    const unit = stored?.unit ?? data.result.prices.find((p) => p.key === it.price!.key)?.unit ?? "piece";
    return { rate: stored?.rate ?? null, unit };
  }
  return { rate: null, unit: "" };
}

/** SS / MS process and scrap kg and finish kg of a drawing, as on the Summary page. */
export function familySums(d: DrawingOutput) {
  const s = { ssProcess: 0, ssScrap: 0, msProcess: 0, msScrap: 0, finish: 0 };
  for (const t of d.byMaterial) {
    const fam = familyOf(t.material);
    if (fam === "SS") {
      s.ssProcess += t.process;
      s.ssScrap += t.scrap;
    } else if (fam === "MS") {
      s.msProcess += t.process;
      s.msScrap += t.scrap;
    }
    s.finish += t.finish;
  }
  return s;
}
