import { DEFAULT_MATERIALS } from "@/lib/calc/materials";
import { builtInSectionRows } from "@/lib/calc/sections-lib";
import type { Db } from "./index";
import { materials, sectionSizes, settings } from "./schema";

export const COMPANY = {
  companyName: "Shubhangi Engineers",
  address: "J495, J-Block, MIDC, Bhosari, Pune - 411026",
  email: "shubhangi645@rediffmail.com",
  phone: "7385795722",
};

/** Idempotent: safe to run on every deploy. Never overwrites user edits. */
export async function seed(db: Db) {
  await db.insert(settings).values({ id: 1, ...COMPANY }).onConflictDoNothing();
  await db
    .insert(materials)
    .values(DEFAULT_MATERIALS.map((m, i) => ({ ...m, sortOrder: i })))
    .onConflictDoNothing();
  // Adds built-in sizes that are missing (e.g. new series in an update); never overwrites edits.
  await db
    .insert(sectionSizes)
    .values(builtInSectionRows().map((r) => ({ ...r, builtIn: true })))
    .onConflictDoNothing({ target: [sectionSizes.series, sectionSizes.size] });
}
