/** Names for the marking dimensions in `ItemResult.development` (item editor). */
export const DEV_LABELS: Record<string, string> = {
  Dm: "Mean dia Dm", Rb: "Mean base radius Rb", rt: "Mean top radius rt", apexHeight: "Apex height Ha", slant: "Slant to apex S",
  R1: "R1 (outer radius)", R2: "R2 (inner radius)", theta: "Flat angle θ", chord: "Chord", girth: "Girth π × Dm",
  height: "Height", shortest: "Shortest line", longest: "Longest line", offset: "Offset e", cutRadius: "Cut radius Rc",
  depth: "Dish depth", meridian: "Meridian length", blankDia: "Blank dia", holeOnBlank: "Hole dia on blank",
  OD: "OD", ID: "ID", PCD: "PCD", hA: "Panel A true height", hB: "Panel B true height",
  Am: "Mean side A", Bm: "Mean side B", rc: "Mean corner radius r", lineA: "A side centre line (true)", lineB: "B side centre line (true)",
  flatWidth: "Flat width W", flatLength: "Flat length π × Dm", cutLength: "Cut length incl. allowance",
  totalLength: "Total centre-line length", cutOffset: "Cut offset ± (from square)", middle: "Middle length", bendAngle: "Bend angle δ",
  segmentAngle: "Full segment angle", fullSegment: "Full segment length",
  am: "Mean top side a", bm: "Mean top side b", dm: "Mean top dia dm",
  stripTopBottom: "Top / bottom strip width b", stripSide: "Side strip width a", stripLength: "Total strip length",
};

export const devLabel = (k: string) => DEV_LABELS[k] ?? k;

