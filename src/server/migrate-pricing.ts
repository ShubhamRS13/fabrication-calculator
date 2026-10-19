import { eq, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import { costingPrices, costings, items } from "@/db/schema";
import { normaliseDesc } from "@/lib/calc/bought-catalogue";
import { priceKey } from "@/lib/calc/costing";
import { buildRegistry } from "@/lib/calc/registry";
import { computeCostingById } from "./costings";

// Moves older per-item rates onto the Pricing page (Review 2). Safe to run any
// number of times: it only touches items still in the old form.
//  - Old bought types (rate on the item) become catalogue "Other" items; their
//    rate becomes the costing's price for that item.
//  - Dish job-work charges typed on the item become job-work prices.

const LEGACY_BOUGHT = ["bought-flange", "bought-dish", "bought-misc"];

export async function migrateLegacyPricing(db: Db): Promise<{ bought: number; jobWork: number }> {
  const registry = buildRegistry();
  const legacy = await db.select({ id: items.id }).from(items).where(inArray(items.type, LEGACY_BOUGHT));
  const withJob = (await db.select({ id: items.id, inputs: items.inputs }).from(items)).filter((i) => Number(i.inputs.jobWork) > 0);
  if (!legacy.length && !withJob.length) return { bought: 0, jobWork: 0 };

  let bought = 0;
  let jobWork = 0;
  for (const c of await db.select({ id: costings.id }).from(costings)) {
    const out = await computeCostingById(db, c.id);
    if (!out) continue;
    for (const d of out.result.drawings) {
      for (const it of d.items) {
        const inp = it.item.inputs;
        if (LEGACY_BOUGHT.includes(it.item.type)) {
          const parts = [it.item.name, inp.size, inp.class, inp.flangeType, inp.dishType, inp.description].filter((x) => x !== undefined && String(x).trim());
          const desc = parts.map(String).join(" ");
          const label = normaliseDesc(desc) || "OTHER";
          const rate = Number(inp.rate);
          if (Number.isFinite(rate) && inp.rate !== undefined && inp.rate !== "") {
            await db
              .insert(costingPrices)
              .values({ costingId: c.id, key: priceKey("bought", it.material, label), group: "bought", material: it.material, label, rate, unit: "piece" })
              .onConflictDoNothing();
          }
          const next: Record<string, string | number | boolean> = { kind: "Other", desc };
          if (Number(inp.weight) > 0) next.weight = Number(inp.weight);
          await db.update(items).set({ type: "bought", inputs: next, material: it.item.material ?? null }).where(eq(items.id, it.item.id));
          bought++;
        } else if (Number(inp.jobWork) > 0) {
          const type = registry.get(it.item.type);
          const label = type?.jobWorkRef?.(inp);
          if (label) {
            await db
              .insert(costingPrices)
              .values({ costingId: c.id, key: priceKey("jobwork", it.material, label), group: "jobwork", material: it.material, label, rate: Number(inp.jobWork), unit: "piece" })
              .onConflictDoNothing();
          }
          const rest = Object.fromEntries(Object.entries(inp).filter(([k]) => k !== "jobWork")) as Record<string, string | number | boolean>;
          await db.update(items).set({ inputs: rest }).where(eq(items.id, it.item.id));
          jobWork++;
        }
      }
    }
  }
  return { bought, jobWork };
}
