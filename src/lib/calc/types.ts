import type { SectionLibrary } from "./sections-lib";

// Core types for the calculation engine.
// Units everywhere: lengths mm, density g/cc, weights kg, money ₹.

export type MaterialFamily = "SS" | "MS" | "OTHER";

export interface Material {
  code: string; // "MS", "SS304", ...
  density: number; // g/cc
  family: MaterialFamily;
}

export type DiaRef = "ID" | "OD";

export type ItemCategory =
  | "fabricated"
  | "section"
  | "bought"
  | "outsourced"
  | "custom";

export type InputValue = number | string | boolean | undefined;
export type ItemInputs = Record<string, InputValue>;

export interface FieldDef {
  key: string;
  label: string;
  kind: "number" | "diaRef" | "select" | "boolean" | "text";
  unit?: "mm" | "deg" | "kg/m" | "kg" | "₹" | "nos";
  options?: { value: string; label: string }[];
  default?: InputValue;
  optional?: boolean;
  help?: string;
  /** Options that depend on other inputs or the section library, e.g. sizes of the chosen series. */
  dependentOptions?: (inputs: ItemInputs, lib: SectionLibrary) => { value: string; label: string }[];
  /** Show the field only when this returns true (e.g. rolling allowance only for "from flat"). */
  showIf?: (inputs: ItemInputs) => boolean;
}

// ---------- Flat-pattern development ----------

/** A point on the flat pattern, in mm. y points up. */
export type Pt = [number, number];

/** A labelled dimension drawn on the flat pattern. */
export type DevDim =
  | { kind: "radius"; label: string; center: Pt; to: Pt }
  | { kind: "angle"; label: string; center: Pt; from: Pt; to: Pt; r: number }
  | { kind: "linear"; label: string; from: Pt; to: Pt; offset?: number }
  | { kind: "text"; label: string; at: Pt };

/** One flat piece cut from sheet (count = pieces of this shape per item). */
export interface DevPiece {
  name: string;
  count: number;
  /** Closed outline, in order (last point joins the first). */
  outline: Pt[];
  holes?: Pt[][];
  /** Marking lines (generators, bend lines). */
  marks?: [Pt, Pt][];
  dims?: DevDim[];
  /** Exact area / cut length when a closed formula exists (the outline is a polyline approximation). */
  exactArea?: number;
  exactPerimeter?: number;
}

export interface Development {
  pieces: DevPiece[];
}

/** Like Plate'n'Sheets' mass report: the sheet rectangle vs the actual shape. */
export interface MassFigures {
  /** m² */
  area: number;
  /** mm (cut length) */
  perimeter: number;
  /** kg */
  mass: number;
}

export interface MassReport {
  frame: MassFigures;
  actual: MassFigures;
  pieces: { name: string; count: number; frameW: number; frameH: number; frame: MassFigures; actual: MassFigures }[];
}

/** Shop-floor marking table, e.g. generator lengths at each division. */
export interface MarkTable {
  title: string;
  columns: string[];
  rows: number[][];
}

/** Result for ONE unit of an item. Quantity is applied by the costing engine. */
export interface ItemResult {
  finishWt: number;
  processWt: number;
  scrap: number;
  /** Ideal sheet rectangle (single-piece developments). */
  sheetL?: number;
  sheetW?: number;
  kgPerM?: number;
  /** Cut length per piece, mm (sections), for ₹/m rates. */
  cutLength?: number;
  /** Marking dimensions of the development, e.g. R1, R2, theta. */
  development?: Record<string, number>;
  /** Fixed ₹ per unit (bought price, job-work charge). */
  fixedCost: number;
  /** false for bought items: weight shown but never costed by ₹/kg. */
  costedByWeight: boolean;
  /** Human-readable calculation with the numbers filled in. */
  formula: string;
  /** Flat pattern, when the item is cut from sheet. */
  dev?: Development;
  mass?: MassReport;
  markTable?: MarkTable;
  /** True surface area of the formed part, mm² (info; e.g. dish ends). */
  surfaceArea?: number;
}

export interface CalcContext {
  density: number;
  /** Section & pipe tables; built-in tables when absent. */
  lib?: SectionLibrary;
}

export interface ItemType {
  id: string;
  category: ItemCategory;
  label: string;
  /** Family shown as a group in the item picker, e.g. "Cones". */
  family?: string;
  /** One or two sentences for the picker, like Plate'n'Sheets. */
  description?: string;
  /** Symbolic formula lines, using the letters on the reference diagram. */
  formulaText?: string[];
  /**
   * Size name for the size-wise rate chart, e.g. "Pipe 50 NB SCH 40". Items of the
   * same material and size share one rate. Absent = priced by material ₹/kg only.
   */
  sizeLabel?: (inputs: ItemInputs) => string;
  fields: FieldDef[];
  compute(inputs: ItemInputs, ctx: CalcContext): ItemResult;
}

export class CalcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalcError";
  }
}
