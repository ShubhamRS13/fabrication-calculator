import { eq } from "drizzle-orm";
import { DEFAULT_MATERIALS } from "@/lib/calc/materials";
import { IS1239_OD, IS1239_WALL, PIPE_OD, PIPE_WALL, STRUCTURAL, SWG } from "@/lib/calc/data/sections";
import type { Db } from "./index";
import { materials, sectionSizes, settings } from "./schema";

export const COMPANY = {
  companyName: "Shubhangi Engineers",
  address: "J495, J-Block, MIDC, Bhosari, Pune - 411026",
  email: "shubhangi645@rediffmail.com",
  phone: "7385795722",
};

/** Built-in section sizes from the engine's starter tables. */
export function builtInSectionRows() {
  const rows: { series: string; size: string; data: Record<string, number>; builtIn: boolean }[] = [];
  for (const [sch, walls] of Object.entries(PIPE_WALL)) {
    for (const [nb, wall] of Object.entries(walls)) {
      rows.push({ series: `PIPE-SCH-${sch}`, size: `${nb} NB`, data: { nb: Number(nb), od: PIPE_OD[Number(nb)], wall }, builtIn: true });
    }
  }
  for (const [cls, walls] of Object.entries(IS1239_WALL)) {
    for (const [nb, wall] of Object.entries(walls)) {
      rows.push({ series: `PIPE-IS1239-${cls}`, size: `${nb} NB`, data: { nb: Number(nb), od: IS1239_OD[Number(nb)], wall }, builtIn: true });
    }
  }
  for (const [gauge, thk] of Object.entries(SWG)) {
    rows.push({ series: "SWG", size: `${gauge} SWG`, data: { gauge: Number(gauge), thk }, builtIn: true });
  }
  for (const [series, sizes] of Object.entries(STRUCTURAL)) {
    for (const [size, kgPerM] of Object.entries(sizes)) {
      rows.push({ series, size, data: { kgPerM }, builtIn: true });
    }
  }
  return rows;
}

/** Idempotent: safe to run on every deploy. Never overwrites user edits. */
export async function seed(db: Db) {
  await db.insert(settings).values({ id: 1, ...COMPANY }).onConflictDoNothing();
  await db
    .insert(materials)
    .values(DEFAULT_MATERIALS.map((m, i) => ({ ...m, sortOrder: i })))
    .onConflictDoNothing();
  const existing = await db.select({ id: sectionSizes.id }).from(sectionSizes).where(eq(sectionSizes.builtIn, true)).limit(1);
  if (!existing.length) await db.insert(sectionSizes).values(builtInSectionRows());
}
