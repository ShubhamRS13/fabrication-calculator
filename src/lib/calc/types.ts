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
  /** Options that depend on other inputs, e.g. sizes of the chosen series. */
  dependentOptions?: (inputs: ItemInputs) => { value: string; label: string }[];
}

/** One flat panel of a multi-panel development (hopper, duct). */
export interface Panel {
  name: string;
  count: number;
  shape: "rectangle" | "trapezoid";
  /** Trapezoid: top and bottom edges; rectangle: top = bottom = width. */
  top: number;
  bottom: number;
  /** True (developed) height of the panel. */
  height: number;
  /** Ideal sheet rectangle for one panel. */
  rectL: number;
  rectW: number;
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
  /** Marking dimensions of the development, e.g. R1, R2, theta. */
  development?: Record<string, number>;
  panels?: Panel[];
  /** Fixed ₹ per unit (bought price, job-work charge). */
  fixedCost: number;
  /** false for bought items: weight shown but never costed by ₹/kg. */
  costedByWeight: boolean;
  /** Human-readable formula with the numbers filled in. */
  formula: string;
}

export interface CalcContext {
  density: number;
}

export interface ItemType {
  id: string;
  category: ItemCategory;
  label: string;
  fields: FieldDef[];
  compute(inputs: ItemInputs, ctx: CalcContext): ItemResult;
}

export class CalcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalcError";
  }
}
