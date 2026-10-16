import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/** Any Drizzle Postgres database with our schema: Neon in the app, PGlite in tests. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let cached: Db | undefined;

/** Neon over WebSockets, so multi-step writes (duplicate costing) can use transactions. */
export function getDb(): Db {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Add it to .env (local) or Vercel env vars.");
  cached = drizzle({ client: new Pool({ connectionString: url }), schema }) as unknown as Db;
  return cached;
}

export { schema };
