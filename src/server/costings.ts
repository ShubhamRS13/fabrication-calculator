import { and, asc, desc, eq, exists, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import type { z } from "zod";
import type { Db } from "@/db";
import {
  assemblies, chargeLines, boughtKinds, costingMaterialRates, costingPrices, costings, customShapes, drawings, items, materials, sectionSizes,
} from "@/db/schema";
import { BUILT_IN_TYPES } from "@/lib/calc/registry";
import {
  computeCosting, defaultChargeLines, type AppliesTo, type CostingInput, type CostingOutput,
} from "@/lib/calc/costing";
import type { CustomShapeDef } from "@/lib/calc/custom";
import type { Material } from "@/lib/calc/types";
import { libraryFromRows, type SectionLibrary } from "@/lib/calc/sections-lib";
import { DEFAULT_KINDS, type Template } from "@/lib/calc/bought-catalogue";
import { UNITS_BY_GROUP } from "@/lib/calc/costing";
import { nextItemNo } from "@/lib/item-no";
import * as v from "./validation";

// Data-access layer. Every function takes the database explicitly so tests can
// run it against PGlite. Inputs are parsed with the zod schemas in ./validation.

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "NotFoundError";
  }
}

export class InvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidInputError";
  }
}

const BUILT_IN_IDS = new Set(BUILT_IN_TYPES.map((t) => t.id));

// ---------- lookups ----------

export async function listMaterials(db: Db): Promise<Material[]> {
  const rows = await db.select().from(materials).orderBy(asc(materials.sortOrder), asc(materials.code));
  return rows.map(({ code, density, family }) => ({ code, density, family }));
}

export async function listCustomShapes(db: Db): Promise<CustomShapeDef[]> {
  const rows = await db.select().from(customShapes).orderBy(asc(customShapes.name));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    inputs: r.inputs,
    finishFormula: r.finishFormula,
    processFormula: r.processFormula ?? undefined,
  }));
}

/** Section & pipe tables as edited in Settings. */
export async function loadSectionLibrary(db: Db): Promise<SectionLibrary> {
  const [rows, kinds] = await Promise.all([
    db.select({ series: sectionSizes.series, size: sectionSizes.size, data: sectionSizes.data }).from(sectionSizes),
    db.select().from(boughtKinds).orderBy(asc(boughtKinds.sortOrder), asc(boughtKinds.name)),
  ]);
  const catalogue = kinds.length
    ? kinds.map((k) => ({ name: k.name, template: k.template as Template, unit: k.unit }))
    : DEFAULT_KINDS;
  return libraryFromRows(rows, catalogue);
}

async function assertMaterial(db: Db, code: string | null | undefined) {
  if (!code) return;
  const [row] = await db.select({ code: materials.code }).from(materials).where(eq(materials.code, code));
  if (!row) throw new InvalidInputError(`Unknown material "${code}"`);
}

async function assertItemType(db: Db, type: string) {
  if (BUILT_IN_IDS.has(type)) return;
  const shapeId = type.startsWith("custom:") ? type.slice(7) : "";
  if (v.id.safeParse(shapeId).success) {
    const [row] = await db.select({ id: customShapes.id }).from(customShapes).where(eq(customShapes.id, shapeId));
    if (row) return;
  }
  throw new InvalidInputError(`Unknown item type "${type}"`);
}

async function costingIdOfDrawing(db: Db, drawingId: string) {
  const [row] = await db.select({ costingId: drawings.costingId }).from(drawings).where(eq(drawings.id, drawingId));
  if (!row) throw new NotFoundError("Drawing");
  return row.costingId;
}

async function assertAssemblyInDrawing(db: Db, assemblyId: string | null | undefined, drawingId: string) {
  if (!assemblyId) return;
  const [row] = await db
    .select({ id: assemblies.id })
    .from(assemblies)
    .where(and(eq(assemblies.id, assemblyId), eq(assemblies.drawingId, drawingId)));
  if (!row) throw new InvalidInputError("Assembly does not belong to this drawing");
}

/** Bump the costing's updated_at so the list shows recently edited costings first. */
async function touch(db: Db, costingId: string) {
  await db.update(costings).set({ updatedAt: new Date() }).where(eq(costings.id, costingId));
}

async function nextSort(db: Db, table: typeof drawings | typeof assemblies | typeof items | typeof chargeLines, where: ReturnType<typeof eq>) {
  const [row] = await db
    .select({ max: sql<number | null>`max(${table.sortOrder})` })
    .from(table)
    .where(where);
  return (row?.max ?? -1) + 1;
}

// ---------- costings ----------

export async function createCosting(db: Db, data: v.CostingHeader): Promise<string> {
  const header = v.costingHeader.parse(data);
  await assertMaterial(db, header.defaultMaterial);
  const mats = await listMaterials(db);
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(costings).values(header).returning({ id: costings.id });
    await tx
      .insert(costingMaterialRates)
      .values(mats.map((m) => ({ costingId: row.id, material: m.code, rate: null, scrapRate: null })));
    await tx
      .insert(chargeLines)
      .values(defaultChargeLines().map(({ name, rate, basis, appliesTo }, i) => ({ costingId: row.id, name, rate, basis, appliesTo, sortOrder: i })));
    return row.id;
  });
}

export async function updateCosting(db: Db, costingId: string, patch: z.input<typeof v.costingHeaderPatch>) {
  const data = v.costingHeaderPatch.parse(patch);
  await assertMaterial(db, data.defaultMaterial);
  const res = await db.update(costings).set({ ...data, updatedAt: new Date() }).where(eq(costings.id, costingId)).returning({ id: costings.id });
  if (!res.length) throw new NotFoundError("Costing");
}

export async function deleteCosting(db: Db, costingId: string) {
  const res = await db.delete(costings).where(eq(costings.id, costingId)).returning({ id: costings.id });
  if (!res.length) throw new NotFoundError("Costing");
}

export async function setMaterialRate(db: Db, costingId: string, rate: z.input<typeof v.materialRate>) {
  const data = v.materialRate.parse(rate);
  await assertMaterial(db, data.material);
  await db
    .insert(costingMaterialRates)
    .values({ costingId, ...data })
    .onConflictDoUpdate({
      target: [costingMaterialRates.costingId, costingMaterialRates.material],
      set: { rate: data.rate, scrapRate: data.scrapRate },
    });
  await touch(db, costingId);
}

/** A rate on the Pricing page (plate thickness, section size, bought-out, job work). Blank = missing. */
export async function setPrice(db: Db, costingId: string, input: z.input<typeof v.price>) {
  const data = v.price.parse(input);
  if (!UNITS_BY_GROUP[data.group].includes(data.unit)) throw new InvalidInputError(`${data.group} cannot be priced per ${data.unit}`);
  const [c] = await db.select({ id: costings.id }).from(costings).where(eq(costings.id, costingId));
  if (!c) throw new NotFoundError("Costing");
  await db
    .insert(costingPrices)
    .values({ costingId, ...data })
    .onConflictDoUpdate({
      target: [costingPrices.costingId, costingPrices.key],
      set: { rate: data.rate, unit: data.unit, label: data.label },
    });
  await touch(db, costingId);
}

/**
 * Fill blank rates from another costing: material and scrap rates, prices with the
 * same key, charge lines with the same name. Rates already entered are never changed.
 */
export async function fillBlankRates(db: Db, costingId: string, sourceId: string): Promise<number> {
  if (costingId === sourceId) throw new InvalidInputError("Choose a different costing");
  const [target, source] = await Promise.all([getCostingTree(db, costingId), getCostingTree(db, sourceId)]);
  if (!target || !source) throw new NotFoundError("Costing");
  let filled = 0;
  for (const r of target.rates) {
    const s = source.rates.find((x) => x.material === r.material);
    if (!s) continue;
    const rate = r.rate ?? s.rate;
    const scrapRate = r.scrapRate ?? s.scrapRate;
    if (rate !== r.rate || scrapRate !== r.scrapRate) {
      await db
        .update(costingMaterialRates)
        .set({ rate, scrapRate })
        .where(and(eq(costingMaterialRates.costingId, costingId), eq(costingMaterialRates.material, r.material)));
      filled += Number(rate !== r.rate) + Number(scrapRate !== r.scrapRate);
    }
  }
  const have = new Map(target.prices.map((p) => [p.key, p]));
  for (const p of source.prices) {
    if (p.rate === null) continue;
    const mine = have.get(p.key);
    if (mine && mine.rate !== null) continue;
    await db
      .insert(costingPrices)
      .values({ costingId, key: p.key, group: p.group, material: p.material, label: p.label, rate: p.rate, unit: p.unit })
      .onConflictDoUpdate({ target: [costingPrices.costingId, costingPrices.key], set: { rate: p.rate, unit: p.unit } });
    filled++;
  }
  for (const line of target.chargeLines) {
    if (line.rate !== null) continue;
    const s = source.chargeLines.find((x) => x.name.trim().toLowerCase() === line.name.trim().toLowerCase() && x.rate !== null);
    if (!s) continue;
    await db.update(chargeLines).set({ rate: s.rate }).where(eq(chargeLines.id, line.id));
    filled++;
  }
  if (filled) await touch(db, costingId);
  return filled;
}

/** The most recent rate used in any other costing, per price key / material / charge name (for hints). */
export async function lastUsedRates(db: Db, costingId: string) {
  const [prices, mats, lines] = await Promise.all([
    db
      .select({ key: costingPrices.key, rate: costingPrices.rate, unit: costingPrices.unit, project: costings.projectName, at: costings.updatedAt })
      .from(costingPrices)
      .innerJoin(costings, eq(costings.id, costingPrices.costingId))
      .where(and(sql`${costingPrices.costingId} <> ${costingId}`, sql`${costingPrices.rate} is not null`))
      .orderBy(desc(costings.updatedAt)),
    db
      .select({ material: costingMaterialRates.material, rate: costingMaterialRates.rate, project: costings.projectName, at: costings.updatedAt })
      .from(costingMaterialRates)
      .innerJoin(costings, eq(costings.id, costingMaterialRates.costingId))
      .where(and(sql`${costingMaterialRates.costingId} <> ${costingId}`, sql`${costingMaterialRates.rate} is not null`))
      .orderBy(desc(costings.updatedAt)),
    db
      .select({ name: chargeLines.name, rate: chargeLines.rate, project: costings.projectName, at: costings.updatedAt })
      .from(chargeLines)
      .innerJoin(costings, eq(costings.id, chargeLines.costingId))
      .where(and(sql`${chargeLines.costingId} <> ${costingId}`, sql`${chargeLines.rate} is not null`))
      .orderBy(desc(costings.updatedAt)),
  ]);
  const first = <T, K>(rows: T[], key: (r: T) => K) => {
    const m = new Map<K, T>();
    for (const r of rows) if (!m.has(key(r))) m.set(key(r), r);
    return m;
  };
  type Hint = { rate: number; unit?: string; project: string };
  const toObj = <T extends { rate: number | null; project: string; unit?: string }>(m: Map<string, T>) =>
    Object.fromEntries([...m].map(([k, r]) => [k, { rate: r.rate!, unit: r.unit, project: r.project } satisfies Hint]));
  return {
    prices: toObj(first(prices, (r) => r.key)),
    materials: toObj(first(mats, (r) => r.material)),
    charges: toObj(first(lines, (r) => r.name.trim().toLowerCase())),
  };
}

// ---------- charge lines ----------

export async function addChargeLine(db: Db, costingId: string, line: z.input<typeof v.chargeLine>) {
  const data = v.chargeLine.parse(line);
  const sortOrder = await nextSort(db, chargeLines, eq(chargeLines.costingId, costingId));
  const [row] = await db.insert(chargeLines).values({ costingId, ...data, sortOrder }).returning({ id: chargeLines.id });
  await touch(db, costingId);
  return row.id;
}

export async function updateChargeLine(db: Db, lineId: string, patch: z.input<typeof v.chargeLinePatch>) {
  const data = v.chargeLinePatch.parse(patch);
  const [row] = await db.update(chargeLines).set(data).where(eq(chargeLines.id, lineId)).returning({ costingId: chargeLines.costingId });
  if (!row) throw new NotFoundError("Charge line");
  await touch(db, row.costingId);
}

export async function deleteChargeLine(db: Db, lineId: string) {
  const [row] = await db.delete(chargeLines).where(eq(chargeLines.id, lineId)).returning({ costingId: chargeLines.costingId });
  if (!row) throw new NotFoundError("Charge line");
  await touch(db, row.costingId);
}

// ---------- drawings ----------

export async function addDrawing(db: Db, costingId: string, data: z.input<typeof v.drawing>) {
  const d = v.drawing.parse(data);
  await assertMaterial(db, d.material);
  const [c] = await db.select({ id: costings.id }).from(costings).where(eq(costings.id, costingId));
  if (!c) throw new NotFoundError("Costing");
  const sortOrder = await nextSort(db, drawings, eq(drawings.costingId, costingId));
  const [row] = await db.insert(drawings).values({ costingId, ...d, sortOrder }).returning({ id: drawings.id });
  await touch(db, costingId);
  return row.id;
}

export async function updateDrawing(db: Db, drawingId: string, patch: z.input<typeof v.drawingPatch>) {
  const d = v.drawingPatch.parse(patch);
  await assertMaterial(db, d.material);
  const [row] = await db.update(drawings).set(d).where(eq(drawings.id, drawingId)).returning({ costingId: drawings.costingId });
  if (!row) throw new NotFoundError("Drawing");
  await touch(db, row.costingId);
}

export async function deleteDrawing(db: Db, drawingId: string) {
  const [row] = await db.delete(drawings).where(eq(drawings.id, drawingId)).returning({ costingId: drawings.costingId });
  if (!row) throw new NotFoundError("Drawing");
  await touch(db, row.costingId);
}

// ---------- assemblies ----------

export async function addAssembly(db: Db, drawingId: string, data: z.input<typeof v.assembly>) {
  const a = v.assembly.parse(data);
  await assertMaterial(db, a.material);
  const costingId = await costingIdOfDrawing(db, drawingId);
  const sortOrder = await nextSort(db, assemblies, eq(assemblies.drawingId, drawingId));
  const [row] = await db.insert(assemblies).values({ drawingId, ...a, sortOrder }).returning({ id: assemblies.id });
  await touch(db, costingId);
  return row.id;
}

export async function updateAssembly(db: Db, assemblyId: string, patch: z.input<typeof v.assemblyPatch>) {
  const a = v.assemblyPatch.parse(patch);
  await assertMaterial(db, a.material);
  const [row] = await db.update(assemblies).set(a).where(eq(assemblies.id, assemblyId)).returning({ drawingId: assemblies.drawingId });
  if (!row) throw new NotFoundError("Assembly");
  await touch(db, await costingIdOfDrawing(db, row.drawingId));
}

/**
 * Items in the assembly stay on the drawing, ungrouped. They are renumbered to
 * continue after the drawing's loose items, so numbers do not clash.
 */
export async function deleteAssembly(db: Db, assemblyId: string) {
  const members = await db
    .select({ id: items.id })
    .from(items)
    .where(eq(items.assemblyId, assemblyId))
    .orderBy(asc(items.sortOrder), asc(items.createdAt));
  const [row] = await db.delete(assemblies).where(eq(assemblies.id, assemblyId)).returning({ drawingId: assemblies.drawingId });
  if (!row) throw new NotFoundError("Assembly");
  const memberIds = new Set(members.map((m) => m.id));
  const loose = await db
    .select({ id: items.id, itemNo: items.itemNo })
    .from(items)
    .where(and(eq(items.drawingId, row.drawingId), isNull(items.assemblyId)));
  let next = Number(nextItemNo(loose.filter((l) => !memberIds.has(l.id)).map((l) => l.itemNo)));
  for (const m of members) {
    await db.update(items).set({ itemNo: String(next++) }).where(eq(items.id, m.id));
  }
  await touch(db, await costingIdOfDrawing(db, row.drawingId));
}

// ---------- items ----------

/** Next item number among the drawing's loose items, or within one assembly. */
async function nextItemNoIn(db: Db, drawingId: string, assemblyId: string | null | undefined, excludeItemId?: string) {
  const rows = await db
    .select({ id: items.id, itemNo: items.itemNo })
    .from(items)
    .where(and(eq(items.drawingId, drawingId), assemblyId ? eq(items.assemblyId, assemblyId) : isNull(items.assemblyId)));
  return nextItemNo(rows.filter((r) => r.id !== excludeItemId).map((r) => r.itemNo));
}

export async function addItem(db: Db, drawingId: string, data: v.ItemData) {
  const it = v.item.parse(data);
  await assertItemType(db, it.type);
  await assertMaterial(db, it.material);
  const costingId = await costingIdOfDrawing(db, drawingId);
  await assertAssemblyInDrawing(db, it.assemblyId, drawingId);
  const sortOrder = await nextSort(db, items, eq(items.drawingId, drawingId));
  const itemNo = it.itemNo || (await nextItemNoIn(db, drawingId, it.assemblyId));
  const [row] = await db.insert(items).values({ drawingId, ...it, itemNo, sortOrder }).returning({ id: items.id });
  await touch(db, costingId);
  return row.id;
}

export async function updateItem(db: Db, itemId: string, patch: z.input<typeof v.itemPatch>) {
  const it = v.itemPatch.parse(patch);
  if (it.type) await assertItemType(db, it.type);
  await assertMaterial(db, it.material);
  const [current] = await db
    .select({ drawingId: items.drawingId, assemblyId: items.assemblyId })
    .from(items)
    .where(eq(items.id, itemId));
  if (!current) throw new NotFoundError("Item");
  await assertAssemblyInDrawing(db, it.assemblyId, current.drawingId);
  // Moved into or out of an assembly without a number given: take the next one there.
  const moved = it.assemblyId !== undefined && (it.assemblyId ?? null) !== current.assemblyId;
  if (it.itemNo === "" || (moved && it.itemNo === undefined)) {
    it.itemNo = await nextItemNoIn(db, current.drawingId, it.assemblyId ?? current.assemblyId, itemId);
  }
  await db.update(items).set(it).where(eq(items.id, itemId));
  await touch(db, await costingIdOfDrawing(db, current.drawingId));
}

export async function deleteItem(db: Db, itemId: string) {
  const [row] = await db.delete(items).where(eq(items.id, itemId)).returning({ drawingId: items.drawingId });
  if (!row) throw new NotFoundError("Item");
  await touch(db, await costingIdOfDrawing(db, row.drawingId));
}

// ---------- reading ----------

export async function getCostingTree(db: Db, costingId: string) {
  const [costing] = await db.select().from(costings).where(eq(costings.id, costingId));
  if (!costing) return null;
  const [rates, prices, lines, dws] = await Promise.all([
    db.select().from(costingMaterialRates).where(eq(costingMaterialRates.costingId, costingId)),
    db.select().from(costingPrices).where(eq(costingPrices.costingId, costingId)),
    db.select().from(chargeLines).where(eq(chargeLines.costingId, costingId)).orderBy(asc(chargeLines.sortOrder)),
    db.select().from(drawings).where(eq(drawings.costingId, costingId)).orderBy(asc(drawings.sortOrder), asc(drawings.createdAt)),
  ]);
  const drawingIds = dws.map((d) => d.id);
  const [asms, its] = drawingIds.length
    ? await Promise.all([
        db.select().from(assemblies).where(inArray(assemblies.drawingId, drawingIds)).orderBy(asc(assemblies.sortOrder)),
        db.select().from(items).where(inArray(items.drawingId, drawingIds)).orderBy(asc(items.sortOrder), asc(items.createdAt)),
      ])
    : [[], []];
  return {
    costing,
    rates,
    prices,
    chargeLines: lines,
    drawings: dws.map((d) => ({
      ...d,
      assemblies: asms.filter((a) => a.drawingId === d.id),
      items: its.filter((i) => i.drawingId === d.id),
    })),
  };
}

export type CostingTree = NonNullable<Awaited<ReturnType<typeof getCostingTree>>>;

/** Convert a stored costing into the engine's input. */
export function toCostingInput(tree: CostingTree, mats: Material[], shapes: CustomShapeDef[], sections?: SectionLibrary): CostingInput {
  const nul = <T>(x: T | null) => x ?? undefined;
  return {
    defaultMaterial: tree.costing.defaultMaterial,
    burningPct: tree.costing.burningPct,
    profitPct: tree.costing.profitPct,
    materials: mats,
    customShapes: shapes,
    sections,
    rates: Object.fromEntries(tree.rates.map((r) => [r.material, { rate: r.rate, scrapRate: r.scrapRate }])),
    prices: Object.fromEntries(tree.prices.map((r) => [r.key, { rate: r.rate, unit: r.unit }])),
    chargeLines: tree.chargeLines.map((l) => ({
      id: l.id, name: l.name, rate: l.rate, basis: l.basis, appliesTo: l.appliesTo as AppliesTo,
    })),
    drawings: tree.drawings.map((d) => ({
      id: d.id,
      drawingNo: d.drawingNo,
      title: d.title,
      material: nul(d.material),
      burningPct: nul(d.burningPct),
      assemblies: d.assemblies.map((a) => ({
        id: a.id, name: a.name, qty: a.qty, material: nul(a.material), burningPct: nul(a.burningPct),
      })),
      items: d.items.map((i) => ({
        id: i.id,
        itemNo: i.itemNo,
        type: i.type,
        name: i.name,
        dwgSheet: i.dwgSheet,
        qty: i.qty,
        material: nul(i.material),
        burningPct: nul(i.burningPct),
        assemblyId: nul(i.assemblyId),
        inputs: i.inputs,
      })),
    })),
  };
}

/** Load a costing and compute every weight and cost. Null if it does not exist. */
export async function computeCostingById(
  db: Db,
  costingId: string,
): Promise<{ tree: CostingTree; input: CostingInput; result: CostingOutput } | null> {
  const [tree, mats, shapes, sections] = await Promise.all([
    getCostingTree(db, costingId),
    listMaterials(db),
    listCustomShapes(db),
    loadSectionLibrary(db),
  ]);
  if (!tree) return null;
  const input = toCostingInput(tree, mats, shapes, sections);
  return { tree, input, result: computeCosting(input) };
}

// ---------- duplicate & search ----------

/** Deep copy with new ids: header, rates, charge lines, drawings, assemblies, items. */
export async function duplicateCosting(
  db: Db,
  costingId: string,
  overrides: z.input<typeof v.costingHeaderPatch> = {},
): Promise<string> {
  const tree = await getCostingTree(db, costingId);
  if (!tree) throw new NotFoundError("Costing");
  const patch = v.costingHeaderPatch.parse(overrides);
  const c = tree.costing;
  return db.transaction(async (tx) => {
    const [copy] = await tx
      .insert(costings)
      .values({
        clientName: c.clientName,
        projectName: `${c.projectName} (copy)`,
        poNo: c.poNo,
        drawingRef: c.drawingRef,
        createdBy: c.createdBy,
        defaultMaterial: c.defaultMaterial,
        burningPct: c.burningPct,
        profitPct: c.profitPct,
        ...patch,
      })
      .returning({ id: costings.id });
    if (tree.rates.length) {
      await tx.insert(costingMaterialRates).values(
        tree.rates.map((r) => ({ costingId: copy.id, material: r.material, rate: r.rate, scrapRate: r.scrapRate })),
      );
    }
    if (tree.prices.length) {
      await tx.insert(costingPrices).values(
        tree.prices.map(({ key, group, material, label, rate, unit }) => ({ costingId: copy.id, key, group, material, label, rate, unit })),
      );
    }
    if (tree.chargeLines.length) {
      await tx.insert(chargeLines).values(
        tree.chargeLines.map(({ name, rate, basis, appliesTo, sortOrder }) => ({ costingId: copy.id, name, rate, basis, appliesTo, sortOrder })),
      );
    }
    for (const d of tree.drawings) {
      const [nd] = await tx
        .insert(drawings)
        .values({ costingId: copy.id, drawingNo: d.drawingNo, title: d.title, material: d.material, burningPct: d.burningPct, sortOrder: d.sortOrder })
        .returning({ id: drawings.id });
      const asmMap = new Map<string, string>();
      for (const a of d.assemblies) {
        const [na] = await tx
          .insert(assemblies)
          .values({ drawingId: nd.id, name: a.name, qty: a.qty, material: a.material, burningPct: a.burningPct, sortOrder: a.sortOrder })
          .returning({ id: assemblies.id });
        asmMap.set(a.id, na.id);
      }
      if (d.items.length) {
        await tx.insert(items).values(
          d.items.map((i) => ({
            drawingId: nd.id,
            assemblyId: i.assemblyId ? (asmMap.get(i.assemblyId) ?? null) : null,
            itemNo: i.itemNo,
            type: i.type,
            name: i.name,
            dwgSheet: i.dwgSheet,
            qty: i.qty,
            material: i.material,
            burningPct: i.burningPct,
            inputs: i.inputs,
            sortOrder: i.sortOrder,
          })),
        );
      }
    }
    return copy.id;
  });
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

/** Search by client, project, PO no., drawing ref or any drawing no. Newest edits first. */
export async function searchCostings(db: Db, query: z.input<typeof v.searchQuery> = {}) {
  const { q, limit } = v.searchQuery.parse(query);
  const pattern = `%${escapeLike(q)}%`;
  const where = q
    ? or(
        ilike(costings.clientName, pattern),
        ilike(costings.projectName, pattern),
        ilike(costings.poNo, pattern),
        ilike(costings.drawingRef, pattern),
        exists(
          db
            .select({ one: sql`1` })
            .from(drawings)
            .where(and(eq(drawings.costingId, costings.id), or(ilike(drawings.drawingNo, pattern), ilike(drawings.title, pattern)))),
        ),
      )
    : undefined;
  return db
    .select({
      id: costings.id,
      clientName: costings.clientName,
      projectName: costings.projectName,
      poNo: costings.poNo,
      costingDate: costings.costingDate,
      updatedAt: costings.updatedAt,
      // Written out with explicit table names: Drizzle leaves columns unqualified inside sql``,
      // which would compare drawings.costing_id with drawings.id.
      drawingCount: sql<number>`(select count(*)::int from "drawings" d where d."costing_id" = "costings"."id")`,
    })
    .from(costings)
    .where(where)
    .orderBy(desc(costings.updatedAt))
    .limit(limit);
}
