import { CalcError, type ItemType, type Panel } from "../types";
import { bool, f, kg, pos, weightResult } from "../helpers";

const panelArea = (p: Panel) => ((p.top + p.bottom) / 2) * p.height * p.count;
const panelRectArea = (p: Panel) => p.rectL * p.rectW * p.count;

function panelsResult(panels: Panel[], t: number, density: number) {
  const finishArea = panels.reduce((a, p) => a + panelArea(p), 0);
  const processArea = panels.reduce((a, p) => a + panelRectArea(p), 0);
  const finish = kg(finishArea * t, density);
  const process = kg(processArea * t, density);
  const lines = panels.map(
    (p) =>
      `${p.name} × ${p.count}: ` +
      (p.shape === "trapezoid"
        ? `top ${f(p.top)}, bottom ${f(p.bottom)}, true height ${f(p.height)}`
        : `${f(p.top)} × ${f(p.height)}`) +
      ` → sheet ${f(p.rectL)} × ${f(p.rectW)}`,
  );
  return weightResult({
    finishWt: finish,
    processWt: process,
    panels,
    formula:
      lines.join("\n") +
      `\nFinish = ${f(finishArea)} mm² × ${f(t)} × ${f(density)} / 1e6 = ${f(finish)} kg` +
      `\nProcess = ${f(processArea)} mm² × ${f(t)} × ${f(density)} / 1e6 = ${f(process)} kg`,
  });
}

/** Rect-to-rect pyramid hopper, concentric. Process = each panel's bounding rectangle. */
export const pyramidHopper: ItemType = {
  id: "pyramid-hopper",
  category: "fabricated",
  label: "Pyramid hopper (rect to rect)",
  fields: [
    { key: "topL", label: "Top L", kind: "number", unit: "mm" },
    { key: "topW", label: "Top W", kind: "number", unit: "mm" },
    { key: "botL", label: "Bottom l", kind: "number", unit: "mm" },
    { key: "botW", label: "Bottom w", kind: "number", unit: "mm" },
    { key: "height", label: "Height", kind: "number", unit: "mm" },
    { key: "thk", label: "THK", kind: "number", unit: "mm" },
  ],
  compute(inp, { density }) {
    const L = pos(inp, "topL", "Top L");
    const W = pos(inp, "topW", "Top W");
    const l = pos(inp, "botL", "Bottom l");
    const w = pos(inp, "botW", "Bottom w");
    const H = pos(inp, "height", "Height");
    const t = pos(inp, "thk", "THK");
    // Panels on the L sides slope across the W difference, and vice versa.
    const hA = Math.hypot(H, (W - w) / 2);
    const hB = Math.hypot(H, (L - l) / 2);
    const panels: Panel[] = [
      { name: "Panel A (L side)", count: 2, shape: "trapezoid", top: L, bottom: l, height: hA, rectL: Math.max(L, l), rectW: hA },
      { name: "Panel B (W side)", count: 2, shape: "trapezoid", top: W, bottom: w, height: hB, rectL: Math.max(W, w), rectW: hB },
    ];
    return panelsResult(panels, t, density);
  },
};

const FACES = ["top", "bottom", "front", "back", "left", "right"] as const;

/** Rectangular duct / box: length along L, cross-section W × H. Ends are left/right. */
export const rectDuct: ItemType = {
  id: "rect-duct",
  category: "fabricated",
  label: "Rectangular duct / box",
  fields: [
    { key: "length", label: "Length L", kind: "number", unit: "mm" },
    { key: "width", label: "Width W", kind: "number", unit: "mm" },
    { key: "height", label: "Height H", kind: "number", unit: "mm" },
    { key: "thk", label: "THK", kind: "number", unit: "mm" },
    { key: "top", label: "Top face", kind: "boolean", default: true },
    { key: "bottom", label: "Bottom face", kind: "boolean", default: true },
    { key: "front", label: "Front face", kind: "boolean", default: true },
    { key: "back", label: "Back face", kind: "boolean", default: true },
    { key: "left", label: "Left end", kind: "boolean", default: false },
    { key: "right", label: "Right end", kind: "boolean", default: false },
  ],
  compute(inp, { density }) {
    const L = pos(inp, "length", "Length");
    const W = pos(inp, "width", "Width");
    const H = pos(inp, "height", "Height");
    const t = pos(inp, "thk", "THK");
    const has = Object.fromEntries(
      FACES.map((k) => [k, bool(inp, k, k !== "left" && k !== "right")]),
    ) as Record<(typeof FACES)[number], boolean>;
    const rect = (name: string, count: number, a: number, b: number): Panel => ({
      name, count, shape: "rectangle", top: a, bottom: a, height: b, rectL: a, rectW: b,
    });
    const panels: Panel[] = [];
    const tb = +has.top + +has.bottom;
    const fb = +has.front + +has.back;
    const lr = +has.left + +has.right;
    if (tb) panels.push(rect("Top/bottom", tb, L, W));
    if (fb) panels.push(rect("Front/back", fb, L, H));
    if (lr) panels.push(rect("Ends", lr, W, H));
    if (!panels.length) throw new CalcError("Select at least one face");
    return panelsResult(panels, t, density);
  },
};
