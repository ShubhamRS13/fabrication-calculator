import type { ItemResult } from "./calc/types";
import { num } from "./format";

/** Names for the marking dimensions in `ItemResult.development` (item editor, exports). */
export const DEV_LABELS: Record<string, string> = {
  Dm: "Mean dia Dm", Rb: "Mean base radius Rb", rt: "Mean top radius rt", apexHeight: "Apex height Ha", slant: "Slant to apex S",
  R1: "R1 (outer radius)", R2: "R2 (inner radius)", theta: "Flat angle θ", chord: "Chord", girth: "Girth π × Dm",
  height: "Height", shortest: "Shortest line", longest: "Longest line", offset: "Offset e", cutRadius: "Cut radius Rc",
  depth: "Dish depth", meridian: "Meridian length", blankDia: "Blank dia", holeOnBlank: "Hole dia on blank",
  OD: "OD", ID: "ID", PCD: "PCD", hA: "Panel A true height", hB: "Panel B true height",
  flatWidth: "Flat width W", flatLength: "Flat length π × Dm", cutLength: "Cut length incl. allowance",
};

export const devLabel = (k: string) => DEV_LABELS[k] ?? k;

/** One-line development summary, e.g. "Sheet 1570.8 × 1000 · R1 520 · Flat angle θ 120°". */
export function devSummary(r: ItemResult): string {
  const parts: string[] = [];
  if (r.sheetL && r.sheetW) parts.push(`Sheet ${num(r.sheetL)} × ${num(r.sheetW)}`);
  for (const [k, v] of Object.entries(r.development ?? {})) {
    parts.push(`${devLabel(k)} ${num(v)}${k === "theta" ? "°" : ""}`);
  }
  return parts.join(" · ");
}
