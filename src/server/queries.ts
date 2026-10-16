import { connection } from "next/server";
import { cache } from "react";
import { getDb } from "@/db";
import * as dal from "./costings";
import * as lib from "./library";
import { requireUser } from "./guard";

// Reads for Server Components. connection() keeps them out of prerendering, so
// every request sees fresh data; React.cache shares one result per request.

async function ready() {
  await connection();
  await requireUser();
  return getDb();
}

export const searchCostings = cache(async (q: string) => dal.searchCostings(await ready(), { q }));

export const getComputedCosting = cache(async (costingId: string) => {
  const db = await ready();
  if (!isUuid(costingId)) return null;
  return dal.computeCostingById(db, costingId);
});

export const getMaterials = cache(async () => dal.listMaterials(await ready()));

export const getCustomShapes = cache(async () => dal.listCustomShapes(await ready()));

export const getSettings = cache(async () => lib.getSettings(await ready()));

export const getSectionSizes = cache(async () => lib.listSectionSizes(await ready()));

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
