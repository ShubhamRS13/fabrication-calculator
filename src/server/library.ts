import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { boughtKinds, customShapes, items, materials, sectionSizes, settings } from "@/db/schema";
import { validateCustomShape } from "@/lib/calc/custom";
import { COMPANY } from "@/db/seed";
import { InvalidInputError, NotFoundError } from "./costings";
import * as v from "./validation";
import { kindOf } from "@/lib/calc/sections-lib";
import { TEMPLATE_LABEL } from "@/lib/calc/bought-catalogue";

// Library and settings: company details, materials, custom shapes, section tables.

export const companySchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required").max(200),
  address: z.string().trim().max(300),
  email: z.string().trim().max(200),
  phone: z.string().trim().max(50),
});

export async function getSettings(db: Db) {
  const [row] = await db.select().from(settings).where(eq(settings.id, 1));
  return row ?? { id: 1, ...COMPANY, logoPath: "/brand/logo-with-name.png", updatedAt: new Date() };
}

export async function updateSettings(db: Db, data: z.input<typeof companySchema>) {
  const d = companySchema.parse(data);
  await db.insert(settings).values({ id: 1, ...d }).onConflictDoUpdate({ target: settings.id, set: d });
}

export const materialSchema = z.object({
  code: z.string().trim().min(1, "Code is required").max(40).regex(/^[A-Za-z0-9 _-]+$/, "Use letters, digits, space, - or _"),
  density: z.number().finite().positive("Density must be more than 0").max(30),
  family: z.enum(["SS", "MS", "OTHER"]),
});

/** Add a material, or change the density/family of an existing one. */
export async function upsertMaterial(db: Db, data: z.input<typeof materialSchema>) {
  const m = materialSchema.parse(data);
  const [{ max }] = await db.select({ max: sql<number | null>`max(${materials.sortOrder})` }).from(materials);
  await db
    .insert(materials)
    .values({ ...m, sortOrder: (max ?? -1) + 1 })
    .onConflictDoUpdate({ target: materials.code, set: { density: m.density, family: m.family } });
}

export async function addCustomShape(db: Db, data: z.input<typeof v.customShape>) {
  const d = v.customShape.parse(data);
  const problems = validateCustomShape({ id: "new", ...d, processFormula: d.processFormula ?? undefined });
  if (problems.length) throw new InvalidInputError(problems[0]);
  const [row] = await db
    .insert(customShapes)
    .values({ name: d.name, inputs: d.inputs, finishFormula: d.finishFormula, processFormula: d.processFormula || null })
    .returning({ id: customShapes.id });
  return row.id;
}

/** Refuses while any item still uses the shape, so no costing loses its weights. */
export async function deleteCustomShape(db: Db, shapeId: string) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(items).where(eq(items.type, `custom:${shapeId}`));
  if (n > 0) throw new InvalidInputError(`This shape is used by ${n} item${n === 1 ? "" : "s"}; change or delete them first`);
  const res = await db.delete(customShapes).where(eq(customShapes.id, shapeId)).returning({ id: customShapes.id });
  if (!res.length) throw new NotFoundError("Custom shape");
}

export async function listSectionSizes(db: Db) {
  return db.select().from(sectionSizes).orderBy(asc(sectionSizes.series), asc(sectionSizes.size));
}

// ---------- section tables (editable) ----------

const positive = (label: string) => z.number().finite().positive(`${label} must be more than 0`).max(100000);

export const sectionSizeSchema = z.object({
  series: z.string().trim().min(1, "Series is required").max(40).regex(/^[A-Za-z0-9 _-]+$/, "Series: letters, digits, space, - or _"),
  size: z.string().trim().min(1, "Size is required").max(40),
  /** kg/m for rolled series; od + wall (+ nb) for pipes; thk (+ gauge) for SWG. */
  data: z.record(z.number().finite()),
});

/** Validate the numbers a series needs, and derive the key fields (NB, gauge) from the size label. */
function checkSectionData(series: string, size: string, data: Record<string, number>): Record<string, number> {
  const { kind } = kindOf(series);
  const lead = Number(/^\s*(\d+(\.\d+)?)/.exec(size)?.[1]);
  if (kind === "kgPerM") return { kgPerM: positive("kg/m").parse(data.kgPerM) };
  if (kind === "swg") {
    if (!Number.isFinite(lead)) throw new InvalidInputError("SWG size must start with the gauge number, e.g. 10 SWG");
    return { gauge: lead, thk: positive("Thickness").parse(data.thk) };
  }
  if (!Number.isFinite(lead)) throw new InvalidInputError("Pipe size must start with the NB, e.g. 50 NB");
  const od = positive("OD").parse(data.od);
  const wall = positive("Wall").parse(data.wall);
  if (2 * wall >= od) throw new InvalidInputError("Wall is too thick for this OD");
  return { nb: lead, od, wall };
}

/** Add a size, or change an existing one's values (built-in sizes can be corrected too). */
export async function upsertSectionSize(db: Db, input: z.input<typeof sectionSizeSchema>) {
  const { series, size, data } = sectionSizeSchema.parse(input);
  const clean = checkSectionData(series, size, data);
  await db
    .insert(sectionSizes)
    .values({ series, size, data: clean, builtIn: false })
    .onConflictDoUpdate({ target: [sectionSizes.series, sectionSizes.size], set: { data: clean } });
}

/** Only sizes you added can be deleted; built-in sizes would come back on the next update. */
export async function deleteSectionSize(db: Db, id: string) {
  const [row] = await db.select({ builtIn: sectionSizes.builtIn }).from(sectionSizes).where(eq(sectionSizes.id, id));
  if (!row) throw new NotFoundError("Section size");
  if (row.builtIn) throw new InvalidInputError("Built-in sizes cannot be deleted; correct the value instead");
  await db.delete(sectionSizes).where(eq(sectionSizes.id, id));
}

// ---------- bought-out catalogue ----------

export const boughtKindSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(60),
  template: z.enum(Object.keys(TEMPLATE_LABEL) as [string, ...string[]]),
  unit: z.enum(["piece", "set", "kg", "m"]),
});

export async function listBoughtKinds(db: Db) {
  return db.select().from(boughtKinds).orderBy(asc(boughtKinds.sortOrder), asc(boughtKinds.name));
}

export async function addBoughtKind(db: Db, input: z.input<typeof boughtKindSchema>) {
  const k = boughtKindSchema.parse(input);
  const [{ max }] = await db.select({ max: sql<number | null>`max(${boughtKinds.sortOrder})` }).from(boughtKinds);
  const res = await db
    .insert(boughtKinds)
    .values({ ...k, unit: k.unit as "piece" | "set" | "kg" | "m", sortOrder: (max ?? -1) + 1, builtIn: false })
    .onConflictDoNothing()
    .returning({ name: boughtKinds.name });
  if (!res.length) throw new InvalidInputError(`"${k.name}" is already in the list`);
}

/** Only kinds you added, and only while no item uses them. */
export async function deleteBoughtKind(db: Db, name: string) {
  const [row] = await db.select().from(boughtKinds).where(eq(boughtKinds.name, name));
  if (!row) throw new NotFoundError("Item kind");
  if (row.builtIn) throw new InvalidInputError("Built-in kinds cannot be deleted");
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(items).where(sql`${items.type} = 'bought' and ${items.inputs}->>'kind' = ${name}`);
  if (n > 0) throw new InvalidInputError(`"${name}" is used by ${n} item${n === 1 ? "" : "s"}`);
  await db.delete(boughtKinds).where(eq(boughtKinds.name, name));
}
