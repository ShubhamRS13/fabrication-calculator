import type { InputValue, ItemInputs, ItemType } from "./types";
import { BUILT_IN_LIBRARY, type SectionLibrary } from "./sections-lib";

// "Size" text for an item, written like a drawing BOM:
//   5 THK × 600 × 12000 · 50 NB SCH 10S × 3000 L · 6 THK × ID 100 × OD 130
// Item types give their own `size()`; sections and bought-outs fall back to
// their Pricing page label (sections add the cut length).

/** Number as typed: up to 2 decimals, no grouping. Blank → "?". */
export function n(v: InputValue): string {
  const x = Number(v);
  if (v === undefined || v === "" || !Number.isFinite(x)) return "?";
  return String(Math.round(x * 100) / 100);
}

/** Join the parts that are present with " × ". */
export const join = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" × ");

export const thk = (i: ItemInputs) => `${n(i.thk)} THK`;
export const deg = (v: InputValue) => `${n(v)}°`;
/** "OD 1300" / "ID 1296" from the dia + diaRef inputs. */
export const dia = (i: ItemInputs, key = "dia") => `${String(i.diaRef || "OD")} ${n(i[key])}`;
/** Optional dimension: only shown when it is a positive number. */
export const opt = (i: ItemInputs, key: string, text: (v: string) => string) =>
  Number(i[key]) > 0 ? text(n(i[key])) : null;

export function itemSize(type: ItemType | undefined, inputs: ItemInputs, lib: SectionLibrary = BUILT_IN_LIBRARY): string {
  if (!type) return "";
  try {
    if (type.size) return type.size(inputs, lib);
    const label = type.priceRef?.(inputs, lib)?.label ?? "";
    if (type.category === "section") return join(label.replace(/^Pipe /, ""), opt(inputs, "length", (v) => `${v} L`));
    return label;
  } catch {
    return "";
  }
}
