import { CalcError, type DevPiece, type ItemType, type Pt } from "../types";
import { bool, f, pos } from "../helpers";
import { rect } from "../dev/geometry";
import { devResult } from "../dev/result";
import { join, n, thk } from "../size";

const FAMILY = "Hoppers & ducts";

/** Symmetric trapezoid with `top` above `bottom`, true height h. Frame = max(top, bottom) × h. */
function trapezoid(name: string, count: number, top: number, bottom: number, h: number): DevPiece {
  const m = Math.max(top, bottom);
  const outline: Pt[] = [
    [(m - bottom) / 2, 0],
    [(m + bottom) / 2, 0],
    [(m + top) / 2, h],
    [(m - top) / 2, h],
  ];
  return {
    name,
    count,
    outline,
    dims: [
      { kind: "linear", label: f(top, 1), from: outline[3], to: outline[2], offset: h * 0.08 },
      { kind: "linear", label: f(bottom, 1), from: outline[0], to: outline[1], offset: -h * 0.08 },
      { kind: "text", label: `h ${f(h, 1)}`, at: [m / 2, h / 2] },
    ],
  };
}

/** Rect-to-rect pyramid hopper, concentric. Process = each panel's bounding rectangle. */
export const pyramidHopper: ItemType = {
  id: "pyramid-hopper",
  size: (i) => join(thk(i), `top ${n(i.topL)} × ${n(i.topW)}`, `bottom ${n(i.botL)} × ${n(i.botW)}`, `H ${n(i.height)}`),
  category: "fabricated",
  family: FAMILY,
  label: "Pyramid hopper (rect to rect)",
  description: "A rectangular hopper with a concentric rectangular outlet. Four flat trapezoid panels.",
  formulaText: [
    "Panel A (on the L sides): top L, bottom l, true height hA = √(H² + ((W − w)/2)²)",
    "Panel B (on the W sides): top W, bottom w, true height hB = √(H² + ((L − l)/2)²)",
    "Finish = 2 × (L + l)/2 × hA + 2 × (W + w)/2 × hB  (× t × ρ)",
  ],
  fields: [
    { key: "topL", label: "Top L", kind: "number", unit: "mm" },
    { key: "topW", label: "Top W", kind: "number", unit: "mm" },
    { key: "botL", label: "Bottom l", kind: "number", unit: "mm" },
    { key: "botW", label: "Bottom w", kind: "number", unit: "mm" },
    { key: "height", label: "Height H", kind: "number", unit: "mm" },
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
    return devResult(
      { pieces: [trapezoid("Panel A (L side)", 2, L, l, hA), trapezoid("Panel B (W side)", 2, W, w, hB)] },
      t,
      density,
      {
        steps: [`True heights: hA = √(${f(H)}² + ${f((W - w) / 2)}²) = ${f(hA)}, hB = √(${f(H)}² + ${f((L - l) / 2)}²) = ${f(hB)} mm`],
        development: { hA, hB },
      },
    );
  },
};

const FACES = ["top", "bottom", "front", "back", "left", "right"] as const;

/** Rectangular duct / box: length along L, cross-section W × H. Ends are left/right. */
export const rectDuct: ItemType = {
  id: "rect-duct",
  size: (i) => join(thk(i), n(i.length), n(i.width), `H ${n(i.height)}`),
  category: "fabricated",
  family: FAMILY,
  label: "Rectangular duct / box",
  description: "A straight rectangular duct or box. Choose which faces are closed.",
  formulaText: ["Top/bottom: L × W,  front/back: L × H,  ends: W × H", "Weight = Σ panels × t × ρ / 1e6"],
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
    const panel = (name: string, count: number, a: number, b: number): DevPiece => ({
      name,
      count,
      outline: rect(0, 0, a, b),
      dims: [{ kind: "text", label: `${f(a, 1)} × ${f(b, 1)}`, at: [a / 2, b / 2] }],
    });
    const pieces: DevPiece[] = [];
    const tb = +has.top + +has.bottom;
    const fb = +has.front + +has.back;
    const lr = +has.left + +has.right;
    if (tb) pieces.push(panel("Top/bottom", tb, L, W));
    if (fb) pieces.push(panel("Front/back", fb, L, H));
    if (lr) pieces.push(panel("Ends", lr, W, H));
    if (!pieces.length) throw new CalcError("Select at least one face");
    return devResult({ pieces }, t, density, { steps: [`Duct ${f(L)} long, section ${f(W)} × ${f(H)}`] });
  },
};
