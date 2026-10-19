import { sql } from "drizzle-orm";
import {
  boolean, date, doublePrecision, index, integer, uniqueIndex, jsonb, pgEnum, pgTable, primaryKey, text,
  timestamp, uuid,
} from "drizzle-orm/pg-core";
import type { InputValue } from "@/lib/calc/types";
import type { CustomShapeDef } from "@/lib/calc/custom";

// Only inputs are stored. Weights and costs are always recomputed by src/lib/calc.

const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updated = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date());

/** Single row (id = 1): company details for letterhead and exports. */
export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  companyName: text("company_name").notNull(),
  address: text("address").notNull().default(""),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  logoPath: text("logo_path").notNull().default("/brand/logo-with-name.png"),
  updatedAt: updated(),
});

export const materialFamily = pgEnum("material_family", ["SS", "MS", "OTHER"]);

export const materials = pgTable("materials", {
  code: text("code").primaryKey(),
  density: doublePrecision("density").notNull(),
  family: materialFamily("family").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

/**
 * Section and pipe sizes. `series` is e.g. "ISMC", "PIPE-SCH-40", "SWG";
 * `data` holds the dimensions or kg/m for that series.
 */
export const sectionSizes = pgTable(
  "section_sizes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    series: text("series").notNull(),
    size: text("size").notNull(),
    data: jsonb("data").$type<Record<string, number>>().notNull(),
    builtIn: boolean("built_in").notNull().default(false),
  },
  (t) => [uniqueIndex("section_sizes_series_size_uq").on(t.series, t.size)],
);

export const customShapes = pgTable("custom_shapes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  inputs: jsonb("inputs").$type<CustomShapeDef["inputs"]>().notNull(),
  finishFormula: text("finish_formula").notNull(),
  processFormula: text("process_formula"),
  createdAt: created(),
});

export const costings = pgTable(
  "costings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientName: text("client_name").notNull(),
    projectName: text("project_name").notNull(),
    poNo: text("po_no").notNull().default(""),
    drawingRef: text("drawing_ref").notNull().default(""),
    createdBy: text("created_by").notNull().default(""),
    costingDate: date("costing_date").notNull().default(sql`CURRENT_DATE`),
    defaultMaterial: text("default_material").notNull(),
    burningPct: doublePrecision("burning_pct").notNull().default(3),
    profitPct: doublePrecision("profit_pct").notNull().default(0),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("costings_updated_idx").on(t.updatedAt)],
);

/** Negotiated rates for one costing. Null = not entered yet (counts as 0). */
export const costingMaterialRates = pgTable(
  "costing_material_rates",
  {
    costingId: uuid("costing_id").notNull().references(() => costings.id, { onDelete: "cascade" }),
    material: text("material").notNull(),
    rate: doublePrecision("rate"),
    scrapRate: doublePrecision("scrap_rate"),
  },
  (t) => [primaryKey({ columns: [t.costingId, t.material] })],
);

export const priceGroup = pgEnum("price_group", ["plate", "size", "bought", "jobwork"]);
export const priceUnit = pgEnum("price_unit", ["kg", "m", "piece", "set"]);

/**
 * Every rate on a costing's Pricing page other than material ₹/kg and charge
 * lines: plate thickness, section sizes, bought-outs and job work.
 * key = group|material|label, e.g. "bought|SS304|Stub end 50 NB Long SCH 10S".
 * Blank rate = missing; 0 = deliberately free.
 */
export const costingPrices = pgTable(
  "costing_prices",
  {
    costingId: uuid("costing_id").notNull().references(() => costings.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    group: priceGroup("group").notNull(),
    material: text("material").notNull(),
    label: text("label").notNull(),
    rate: doublePrecision("rate"),
    unit: priceUnit("unit").notNull(),
  },
  (t) => [primaryKey({ columns: [t.costingId, t.key] }), index("costing_prices_key_idx").on(t.key)],
);

/** Bought-out catalogue kinds (built-in ones seeded; more added in Settings). */
export const boughtKinds = pgTable("bought_kinds", {
  name: text("name").primaryKey(),
  template: text("template").notNull(),
  unit: priceUnit("unit").notNull().default("piece"),
  sortOrder: integer("sort_order").notNull().default(0),
  builtIn: boolean("built_in").notNull().default(false),
});

export const chargeBasis = pgEnum("charge_basis", ["process", "finish"]);

export const chargeLines = pgTable(
  "charge_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    costingId: uuid("costing_id").notNull().references(() => costings.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    rate: doublePrecision("rate"),
    basis: chargeBasis("basis").notNull(),
    /** "ALL", "SS", "MS" or "MAT:<code>" */
    appliesTo: text("applies_to").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("charge_lines_costing_idx").on(t.costingId)],
);

export const drawings = pgTable(
  "drawings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    costingId: uuid("costing_id").notNull().references(() => costings.id, { onDelete: "cascade" }),
    drawingNo: text("drawing_no").notNull(),
    title: text("title").notNull().default(""),
    material: text("material"),
    burningPct: doublePrecision("burning_pct"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: created(),
  },
  (t) => [index("drawings_costing_idx").on(t.costingId)],
);

export const assemblies = pgTable(
  "assemblies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    drawingId: uuid("drawing_id").notNull().references(() => drawings.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    qty: doublePrecision("qty").notNull().default(1),
    material: text("material"),
    burningPct: doublePrecision("burning_pct"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("assemblies_drawing_idx").on(t.drawingId)],
);

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    drawingId: uuid("drawing_id").notNull().references(() => drawings.id, { onDelete: "cascade" }),
    assemblyId: uuid("assembly_id").references(() => assemblies.id, { onDelete: "set null" }),
    /** Balloon / Sr. no. on the drawing. Free text ("19A"); numbering restarts per assembly. */
    itemNo: text("item_no").notNull().default(""),
    type: text("type").notNull(),
    name: text("name").notNull(),
    dwgSheet: text("dwg_sheet").notNull().default(""),
    qty: doublePrecision("qty").notNull().default(1),
    material: text("material"),
    burningPct: doublePrecision("burning_pct"),
    inputs: jsonb("inputs").$type<Record<string, InputValue>>().notNull().default({}),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: created(),
  },
  (t) => [index("items_drawing_idx").on(t.drawingId), index("items_assembly_idx").on(t.assemblyId)],
);
