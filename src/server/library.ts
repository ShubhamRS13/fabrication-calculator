import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { customShapes, items, materials, sectionSizes, settings } from "@/db/schema";
import { validateCustomShape } from "@/lib/calc/custom";
import { COMPANY } from "@/db/seed";
import { InvalidInputError, NotFoundError } from "./costings";
import * as v from "./validation";

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
