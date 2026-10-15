import type { Material, MaterialFamily } from "./types";

/** Starting list; editable in Settings. SS202 added (missing from the old workbook). */
export const DEFAULT_MATERIALS: Material[] = [
  { code: "MS", density: 7.85, family: "MS" },
  { code: "SS304", density: 8.0, family: "SS" },
  { code: "SS316", density: 8.0, family: "SS" },
  { code: "SS202", density: 7.8, family: "SS" },
];

export function familyOf(code: string): MaterialFamily {
  const c = code.toUpperCase();
  if (c.startsWith("SS")) return "SS";
  if (c === "MS") return "MS";
  return "OTHER";
}

export function findMaterial(materials: Material[], code: string): Material | undefined {
  return materials.find((m) => m.code.toUpperCase() === code.toUpperCase());
}
