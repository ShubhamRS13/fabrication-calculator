import { z } from "zod";

// Shapes of everything the UI may send. Server actions parse with these before
// touching the database; ids of the rows to change are passed separately.

const text = (max = 200) => z.string().trim().max(max);
const optionalMaterial = z.string().trim().min(1).max(40).nullable().optional();
const pct = z.number().finite().min(0).max(100);

export const id = z.string().uuid();

export const costingHeader = z.object({
  clientName: text().min(1, "Client name is required"),
  projectName: text().min(1, "Project name is required"),
  poNo: text(100).default(""),
  drawingRef: text(100).default(""),
  createdBy: text(100).default(""),
  costingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").optional(),
  defaultMaterial: z.string().trim().min(1).max(40),
  burningPct: pct.default(3),
  profitPct: z.number().finite().min(0).max(1000).default(0),
});
export type CostingHeader = z.input<typeof costingHeader>;
export const costingHeaderPatch = costingHeader.partial();

export const materialRate = z.object({
  material: z.string().trim().min(1).max(40),
  rate: z.number().finite().min(0).nullable(),
  scrapRate: z.number().finite().min(0).nullable(),
});

export const price = z.object({
  key: z.string().trim().min(1).max(300),
  group: z.enum(["plate", "size", "bought", "jobwork"]),
  material: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1).max(250),
  rate: z.number().finite().min(0).nullable(),
  unit: z.enum(["kg", "m", "piece", "set"]),
});

export const appliesTo = z.union([
  z.literal("ALL"),
  z.literal("SS"),
  z.literal("MS"),
  z.string().regex(/^MAT:[A-Za-z0-9 _-]{1,40}$/),
]);

export const chargeLine = z.object({
  name: text(100).min(1, "Name is required"),
  rate: z.number().finite().min(0).nullable(),
  basis: z.enum(["process", "finish"]),
  appliesTo,
});
export const chargeLinePatch = chargeLine.partial();

export const drawing = z.object({
  drawingNo: text(100).min(1, "Drawing no. is required"),
  title: text().default(""),
  material: optionalMaterial,
  burningPct: pct.nullable().optional(),
});
export const drawingPatch = drawing.partial();

export const assembly = z.object({
  name: text().min(1, "Name is required"),
  qty: z.number().finite().positive().max(1e6),
  material: optionalMaterial,
  burningPct: pct.nullable().optional(),
});
export const assemblyPatch = assembly.partial();

const inputValue = z.union([z.number().finite(), z.string().max(200), z.boolean()]);

export const item = z.object({
  /** Blank = next number in the drawing or assembly. */
  itemNo: text(20).optional(),
  type: z.string().trim().min(1).max(80),
  name: text().min(1, "Name is required"),
  dwgSheet: text(40).default(""),
  qty: z.number().finite().positive().max(1e6),
  material: optionalMaterial,
  burningPct: pct.nullable().optional(),
  assemblyId: id.nullable().optional(),
  inputs: z
    .record(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,40}$/), inputValue)
    .refine((r) => Object.keys(r).length <= 50, "Too many inputs")
    .default({}),
});
export type ItemData = z.input<typeof item>;
export const itemPatch = item.partial();

export const customShape = z.object({
  name: text(100).min(1, "Name is required"),
  inputs: z
    .array(z.object({ key: z.string().max(40), label: text(60).min(1), unit: z.enum(["mm", "deg"]).optional() }))
    .min(1)
    .max(20),
  finishFormula: z.string().trim().min(1).max(500),
  processFormula: z.string().trim().max(500).nullable().optional(),
});

export const searchQuery = z.object({
  q: z.string().trim().max(100).default(""),
  limit: z.number().int().min(1).max(200).default(50),
});
