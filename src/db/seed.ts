import { DEFAULT_MATERIALS } from "@/lib/calc/materials";
import { builtInSectionRows } from "@/lib/calc/sections-lib";
import { DEFAULT_KINDS } from "@/lib/calc/bought-catalogue";
import { migrateLegacyPricing } from "@/server/migrate-pricing";
import type { Db } from "./index";
import { boughtKinds, materials, sectionSizes, settings } from "./schema";

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
  // Bought-out catalogue: built-in kinds that are missing; your own kinds are kept.
  await db
    .insert(boughtKinds)
    .values(DEFAULT_KINDS.map((k, i) => ({ ...k, sortOrder: i, builtIn: true })))
    .onConflictDoNothing();
  // Review 2: per-item bought rates and dish job work move to the Pricing page.
  await migrateLegacyPricing(db);
}
