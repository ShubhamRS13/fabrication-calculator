import { CalcError, type DiaRef, type InputValue, type ItemInputs, type ItemResult } from "./types";

/** Volume in mm³ × density g/cc → kg. */
export const kg = (volumeMm3: number, density: number) => (volumeMm3 * density) / 1e6;

/** Mean diameter used for development: OD − t, or ID + t. */
export function meanDia(d: number, ref: DiaRef, thk: number): number {
  return ref === "OD" ? d - thk : d + thk;
}

export function outerDia(d: number, ref: DiaRef, thk: number): number {
  return ref === "OD" ? d : d + 2 * thk;
}

/** Format a number for formula text: up to 3 decimals, no trailing zeros. */
export function f(n: number, decimals = 3): string {
  if (!Number.isFinite(n)) return String(n);
  return String(Number(n.toFixed(decimals)));
}

export function num(inputs: ItemInputs, key: string, label = key): number {
  const v = inputs[key];
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw new CalcError(`${label} is required`);
  }
  return n;
}

export function pos(inputs: ItemInputs, key: string, label = key): number {
  const n = num(inputs, key, label);
  if (n <= 0) throw new CalcError(`${label} must be greater than 0`);
  return n;
}

export function optNum(inputs: ItemInputs, key: string, fallback = 0): number {
  const v: InputValue = inputs[key];
  if (v === undefined || v === "" || v === null) return fallback;
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

export function str(inputs: ItemInputs, key: string, fallback = ""): string {
  const v = inputs[key];
  return v === undefined || v === null ? fallback : String(v);
}

export function bool(inputs: ItemInputs, key: string, fallback = false): boolean {
  const v = inputs[key];
  if (v === undefined) return fallback;
  return v === true || v === "true";
}

export function diaRef(inputs: ItemInputs, key = "diaRef"): DiaRef {
  return inputs[key] === "ID" ? "ID" : "OD";
}

/** Build a weight result where scrap = process − finish (never negative). */
export function weightResult(
  r: Omit<ItemResult, "scrap" | "fixedCost" | "costedByWeight"> &
    Partial<Pick<ItemResult, "fixedCost" | "costedByWeight">>,
): ItemResult {
  return {
    fixedCost: 0,
    costedByWeight: true,
    ...r,
    scrap: Math.max(0, r.processWt - r.finishWt),
  };
}
