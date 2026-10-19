"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getDb } from "@/db";
import * as dal from "@/server/costings";
import * as lib from "@/server/library";
import { requireUser } from "@/server/guard";
import * as v from "@/server/validation";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** Run a mutation: check the user, validate ids, map known errors to messages. */
async function run<T>(fn: () => Promise<T>, revalidate: string[]): Promise<ActionResult<T>> {
  // Outside the try: when logged out it redirects to /login, which must not be caught.
  await requireUser();
  try {
    const data = await fn();
    for (const p of revalidate) revalidatePath(p, "layout");
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ZodError) return { ok: false, error: err.issues[0]?.message ?? "Invalid input" };
    if (err instanceof dal.InvalidInputError || err instanceof dal.NotFoundError) {
      return { ok: false, error: err.message };
    }
    console.error(err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

// Only used to refresh pages; ids are validated inside run().
const costingPath = (id: string) => `/costings/${encodeURIComponent(id)}`;

// ---------- costings ----------

export async function createCostingAction(data: v.CostingHeader) {
  return run(() => dal.createCosting(getDb(), data), ["/"]);
}

export async function updateCostingAction(costingId: string, patch: Partial<v.CostingHeader>) {
  return run(() => dal.updateCosting(getDb(), v.id.parse(costingId), patch), ["/", costingPath(costingId)]);
}

export async function deleteCostingAction(costingId: string) {
  return run(() => dal.deleteCosting(getDb(), v.id.parse(costingId)), ["/"]);
}

export async function duplicateCostingAction(costingId: string) {
  return run(() => dal.duplicateCosting(getDb(), v.id.parse(costingId)), ["/"]);
}

export async function setMaterialRateAction(
  costingId: string,
  rate: { material: string; rate: number | null; scrapRate: number | null },
) {
  return run(() => dal.setMaterialRate(getDb(), v.id.parse(costingId), rate), [costingPath(costingId)]);
}

type PriceData = {
  key: string;
  group: "plate" | "size" | "bought" | "jobwork";
  material: string;
  label: string;
  rate: number | null;
  unit: "kg" | "m" | "piece" | "set";
};

export async function setPriceAction(costingId: string, price: PriceData) {
  return run(() => dal.setPrice(getDb(), v.id.parse(costingId), price), [costingPath(costingId)]);
}

/** Fill every blank rate in this costing from another costing. Returns how many were filled. */
export async function fillBlankRatesAction(costingId: string, sourceId: string) {
  return run(() => dal.fillBlankRates(getDb(), v.id.parse(costingId), v.id.parse(sourceId)), [costingPath(costingId)]);
}

// ---------- charge lines ----------

type ChargeLineData = { name: string; rate: number | null; basis: "process" | "finish"; appliesTo: string };

export async function addChargeLineAction(costingId: string, line: ChargeLineData) {
  return run(() => dal.addChargeLine(getDb(), v.id.parse(costingId), line), [costingPath(costingId)]);
}

export async function updateChargeLineAction(costingId: string, lineId: string, patch: Partial<ChargeLineData>) {
  return run(() => dal.updateChargeLine(getDb(), v.id.parse(lineId), patch), [costingPath(costingId)]);
}

export async function deleteChargeLineAction(costingId: string, lineId: string) {
  return run(() => dal.deleteChargeLine(getDb(), v.id.parse(lineId)), [costingPath(costingId)]);
}

// ---------- drawings ----------

type DrawingData = { drawingNo: string; title?: string; material?: string | null; burningPct?: number | null };

export async function addDrawingAction(costingId: string, data: DrawingData) {
  return run(() => dal.addDrawing(getDb(), v.id.parse(costingId), data), [costingPath(costingId)]);
}

export async function updateDrawingAction(costingId: string, drawingId: string, patch: Partial<DrawingData>) {
  return run(() => dal.updateDrawing(getDb(), v.id.parse(drawingId), patch), [costingPath(costingId)]);
}

export async function deleteDrawingAction(costingId: string, drawingId: string) {
  return run(() => dal.deleteDrawing(getDb(), v.id.parse(drawingId)), [costingPath(costingId)]);
}

// ---------- assemblies ----------

type AssemblyData = { name: string; qty: number; material?: string | null; burningPct?: number | null };

export async function addAssemblyAction(costingId: string, drawingId: string, data: AssemblyData) {
  return run(() => dal.addAssembly(getDb(), v.id.parse(drawingId), data), [costingPath(costingId)]);
}

export async function updateAssemblyAction(costingId: string, assemblyId: string, patch: Partial<AssemblyData>) {
  return run(() => dal.updateAssembly(getDb(), v.id.parse(assemblyId), patch), [costingPath(costingId)]);
}

export async function deleteAssemblyAction(costingId: string, assemblyId: string) {
  return run(() => dal.deleteAssembly(getDb(), v.id.parse(assemblyId)), [costingPath(costingId)]);
}

// ---------- items ----------

export async function addItemAction(costingId: string, drawingId: string, data: v.ItemData) {
  return run(() => dal.addItem(getDb(), v.id.parse(drawingId), data), [costingPath(costingId)]);
}

export async function updateItemAction(costingId: string, itemId: string, patch: Partial<v.ItemData>) {
  return run(() => dal.updateItem(getDb(), v.id.parse(itemId), patch), [costingPath(costingId)]);
}

export async function deleteItemAction(costingId: string, itemId: string) {
  return run(() => dal.deleteItem(getDb(), v.id.parse(itemId)), [costingPath(costingId)]);
}

// ---------- library & settings ----------

export async function updateSettingsAction(data: { companyName: string; address: string; email: string; phone: string }) {
  return run(() => lib.updateSettings(getDb(), data), ["/settings"]);
}

export async function upsertMaterialAction(data: { code: string; density: number; family: "SS" | "MS" | "OTHER" }) {
  return run(() => lib.upsertMaterial(getDb(), data), ["/"]);
}

export async function addCustomShapeAction(data: {
  name: string;
  inputs: { key: string; label: string; unit?: "mm" | "deg" }[];
  finishFormula: string;
  processFormula?: string | null;
}) {
  return run(() => lib.addCustomShape(getDb(), data), ["/"]);
}

export async function deleteCustomShapeAction(shapeId: string) {
  return run(() => lib.deleteCustomShape(getDb(), v.id.parse(shapeId)), ["/settings"]);
}

export async function upsertSectionSizeAction(data: { series: string; size: string; data: Record<string, number> }) {
  return run(() => lib.upsertSectionSize(getDb(), data), ["/"]);
}

export async function deleteSectionSizeAction(id: string) {
  return run(() => lib.deleteSectionSize(getDb(), v.id.parse(id)), ["/"]);
}

export async function addBoughtKindAction(data: { name: string; template: string; unit: "piece" | "set" | "kg" | "m" }) {
  return run(() => lib.addBoughtKind(getDb(), data), ["/"]);
}

export async function deleteBoughtKindAction(name: string) {
  return run(() => lib.deleteBoughtKind(getDb(), name), ["/"]);
}
