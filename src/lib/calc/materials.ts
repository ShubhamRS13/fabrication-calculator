import type { Material, MaterialFamily } from "./types";

/**
 * Starting list; editable in Settings. SS202 was missing from the old workbook's
 * DENSITY(); it uses 8.0 like the other SS grades (rounded, as the workshop does).
 */
export const DEFAULT_MATERIALS: Material[] = [
  { code: "MS", density: 7.85, family: "MS" },
  { code: "SS304", density: 8.0, family: "SS" },
  { code: "SS316", density: 8.0, family: "SS" },
  { code: "SS202", density: 8.0, family: "SS" },
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
