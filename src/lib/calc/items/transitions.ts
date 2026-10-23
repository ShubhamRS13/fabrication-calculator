import { CalcError, type DevPiece, type DiaRef, type FieldDef, type ItemInputs, type ItemType, type Pt } from "../types";
import { diaRef, f, meanDia, optNum, pos, str } from "../helpers";
import { bbox, dist3, unrollOpen, type V3 } from "../dev/geometry";
import { devResult } from "../dev/result";
import { join, n, thk } from "../size";

// Transitions (Plate'n'Sheets group E). Rectangle to round, symmetric: a
// rectangle A × B (optional corner radius r) at the bottom, a circle D at
// height H above its centre, planes parallel. Mean sizes are used.
//
// The surface is four flat triangles (one on each side, apex where the circle's
// tangent is parallel to that side) and four corner cones joining each corner
// to a quarter of the circle. Every line is straight, so the whole surface is
// unrolled by triangles (`unrollOpen`), exactly for the flat parts and in fine
// steps around the corners.

const FAMILY = "Transitions";
/** Steps per corner (pattern accuracy); marking lines are drawn every quarter. */
const STEPS = 48;
const MARKS_PER_CORNER = 4;

const toRad = (d: number) => (d * Math.PI) / 180;

const SIZE_REF: FieldDef = {
  key: "diaRef",
  label: "Sizes given as",
  kind: "diaRef",
  options: [
    { value: "OD", label: "Outside" },
    { value: "MEAN", label: "Mean" },
    { value: "ID", label: "Inside" },
  ],
  default: "OD",
};

const PIECES = (dflt: string): FieldDef => ({
  key: "pieces",
  label: "Made in",
  kind: "select",
  options: [
    { value: "1", label: "1 piece (seam at the middle of a B side)" },
    { value: "2", label: "2 pieces (seams at the middle of both B sides)" },
    { value: "4", label: "4 pieces (seams at the middle of every side)" },
  ],
  default: dflt,
});

interface Station {
  top: V3;
  bottom: V3;
  /** Middle of a side: where a seam may go. */
  sideMid?: boolean;
  /** Draw a marking line here. */
  mark?: boolean;
}

/** A rounded rectangle at height z: sides x × y, corner radius r (a circle is x = y = D, r = D/2). */
interface RoundedRect {
  x: number;
  y: number;
  r: number;
  z: number;
}

/**
 * Stations around a transition between two concentric, parallel rounded
 * rectangles, counter-clockwise from the middle of the right-hand side.
 * Points at the same angle on the two corner arcs are joined (a cone when the
 * radii differ), the sides between the corners are flat.
 */
function stations(bot: RoundedRect, top: RoundedRect): Station[] {
  const corner = (s: RoundedRect, q: number): [number, number] => [
    (q === 0 || q === 3 ? 1 : -1) * (s.x / 2 - s.r),
    (q < 2 ? 1 : -1) * (s.y / 2 - s.r),
  ];
  const mid = (s: RoundedRect, q: number): V3 => [[s.x / 2, 0], [0, s.y / 2], [-s.x / 2, 0], [0, -s.y / 2]][q].concat(s.z) as V3;
  const out: Station[] = [];
  for (let q = 0; q < 4; q++) {
    const a0 = q * 90;
    const [bx, by] = corner(bot, q);
    const [tx, ty] = corner(top, q);
    out.push({ top: mid(top, q), bottom: mid(bot, q), sideMid: true });
    for (let k = 0; k <= STEPS; k++) {
      const a = toRad(a0 + (90 * k) / STEPS);
      out.push({
        top: [tx + top.r * Math.cos(a), ty + top.r * Math.sin(a), top.z],
        bottom: [bx + bot.r * Math.cos(a), by + bot.r * Math.sin(a), bot.z],
        mark: k % (STEPS / MARKS_PER_CORNER) === 0,
      });
    }
  }
  return out;
}

/** Rotate points about the origin. */
const rotate = (pts: Pt[], a: number): Pt[] => pts.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);

/** Turn the piece so its sheet rectangle is as small as possible, then move it to (0, 0). */
function fitToSheet(outline: Pt[], marks: [Pt, Pt][]): { outline: Pt[]; marks: [Pt, Pt][] } {
  let best = 0;
  let bestArea = Infinity;
  for (let i = 0; i < 360; i++) {
    const a = (i * Math.PI) / 360;
    const b = bbox(rotate(outline, a));
    if (b.w * b.h < bestArea - 1e-6) {
      bestArea = b.w * b.h;
      best = a;
    }
  }
  const o = rotate(outline, best);
  const b = bbox(o);
  // Lay it landscape (long side along x).
  const turn = b.h > b.w ? Math.PI / 2 : 0;
  const o2 = rotate(o, turn);
  const b2 = bbox(o2);
  const move = (p: Pt): Pt => [p[0] - b2.minX, p[1] - b2.minY];
  return {
    outline: o2.map(move),
    marks: marks.map(([p, q]) => [move(rotate(rotate([p], best), turn)[0]), move(rotate(rotate([q], best), turn)[0])]),
  };
}

/** Drop consecutive repeated points (flat triangles repeat their apex). */
function dedupe(pts: Pt[]): Pt[] {
  return pts.filter((p, i) => {
    const q = pts[(i - 1 + pts.length) % pts.length];
    return i === 0 ? Math.hypot(p[0] - pts[pts.length - 1][0], p[1] - pts[pts.length - 1][1]) > 1e-6 : Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6;
  });
}

export const rectToRound: ItemType = {
  id: "transition-rect-round",
  size: (i) => join(thk(i), `${n(i.a)} × ${n(i.b)}`, `Ø${n(i.d)}`, `H ${n(i.height)}`) + (Number(i.r) > 0 ? ` (r ${n(i.r)})` : "") + (i.diaRef === "ID" ? " (inside)" : ""),
  category: "fabricated",
  family: FAMILY,
  label: "Transition – rectangle to round",
  description: "A symmetrical rectangle (or square: A = B) to round, centred, with an optional corner radius. Made in 1, 2 or 4 pieces.",
  formulaText: [
    "Mean sizes: A, B and D less t (outside) or plus t (inside); corner r ∓ t/2",
    "Four flat triangles (one on each side) + four corner cones from each corner to a quarter of the circle",
    "Side centre lines: A side √(H² + (B/2 − D/2)²), B side √(H² + (A/2 − D/2)²)",
    "Flat pattern unrolled by triangles; finish = true surface × t × ρ, process = sheet rectangle × t × ρ",
  ],
  fields: [
    { key: "a", label: "Side A", kind: "number", unit: "mm" },
    { key: "b", label: "Side B", kind: "number", unit: "mm", help: "Same as A for a square" },
    { key: "d", label: "Round dia D", kind: "number", unit: "mm" },
    { key: "height", label: "Height H", kind: "number", unit: "mm" },
    { key: "r", label: "Corner radius r", kind: "number", unit: "mm", optional: true, help: "0 or blank for sharp corners" },
    { key: "thk", label: "THK", kind: "number", unit: "mm" },
    SIZE_REF,
    PIECES("1"),
  ],
  compute(inp, { density }) {
    const t = pos(inp, "thk", "THK");
    const ref = diaRef(inp);
    const A = meanDia(pos(inp, "a", "Side A"), ref, t);
    const B = meanDia(pos(inp, "b", "Side B"), ref, t);
    const D = meanDia(pos(inp, "d", "Round dia D"), ref, t);
    const H = pos(inp, "height", "Height H");
    const r = cornerRadius(inp, "r", ref, t);
    if (A <= 0 || B <= 0 || D <= 0) throw new CalcError("Sizes are too small for this thickness");
    if (r > Math.min(A, B) / 2) throw new CalcError("Corner radius is more than half the shorter side");
    const lineA = Math.hypot(H, B / 2 - D / 2);
    const lineB = Math.hypot(H, A / 2 - D / 2);
    // A circle is a rounded rectangle D × D with corner radius D/2.
    return developRectTransition(t, density, { x: A, y: B, r, z: 0 }, { x: D, y: D, r: D / 2, z: H }, madeIn(inp, "1"), {
      label: `${f(A, 1)} × ${f(B, 1)} → Ø${f(D, 1)}`,
      steps: [
        `Mean sizes: A ${f(A)}, B ${f(B)}, D ${f(D)}${r ? `, corner r ${f(r)}` : ""} mm, H ${f(H)} mm`,
        `Side centre lines: A side ${f(lineA)}, B side ${f(lineB)} mm`,
      ],
      development: { Am: A, Bm: B, Dm: D, ...(r ? { rc: r } : {}), height: H, lineA, lineB },
      markTitle: "Corner lines, true length (each corner, from the B side to the A side)",
      markAngle: "Angle on the circle °",
    });
  },
};

/** Corner radius to the mean line: less t/2 for outside sizes, plus t/2 for inside. */
function cornerRadius(inp: ItemInputs, key: string, ref: DiaRef, t: number): number {
  const rIn = optNum(inp, key);
  if (rIn < 0) throw new CalcError("Corner radius cannot be negative");
  if (rIn === 0) return 0;
  return Math.max(0, ref === "OD" ? rIn - t / 2 : ref === "MEAN" ? rIn : rIn + t / 2);
}

function madeIn(inp: ItemInputs, dflt: string): number {
  const pieces = Number(str(inp, "pieces", dflt));
  if (![1, 2, 4].includes(pieces)) throw new CalcError("Made in 1, 2 or 4 pieces");
  return pieces;
}

/** Develop a transition between two concentric rounded rectangles in 1, 2 or 4 pieces (seams at side middles). */
function developRectTransition(
  t: number,
  density: number,
  bot: RoundedRect,
  top: RoundedRect,
  pieces: number,
  o: { label: string; steps: string[]; development: Record<string, number>; markTitle: string; markAngle: string },
) {
  const all = stations(bot, top);
  // Seams at side middles: index of each side-middle station (0 = right B side, 1 = top A side…).
  const midIdx = all.flatMap((s, i) => (s.sideMid ? [i] : []));
  const seamSides = pieces === 1 ? [0] : pieces === 2 ? [0, 2] : [0, 1, 2, 3];
  const loop = [...all, all[0]];
  const devPieces: DevPiece[] = [];
  let area3 = 0;
  for (let p = 0; p < seamSides.length; p++) {
    const from = midIdx[seamSides[p]];
    const to = p + 1 < seamSides.length ? midIdx[seamSides[p + 1]] : all.length;
    const part = loop.slice(from, to + 1);
    const flat = unrollOpen(part.map((s) => s.top), part.map((s) => s.bottom));
    area3 += flat.area;
    const marks: [Pt, Pt][] = part.flatMap((s, i) => (s.mark ? [[flat.bottom[i], flat.top[i]] as [Pt, Pt]] : []));
    const outline = dedupe([...flat.bottom, ...[...flat.top].reverse()]);
    const fitted = fitToSheet(outline, marks);
    const box = bbox(fitted.outline);
    devPieces.push({
      name: pieces === 1 ? "Transition" : `Piece ${p + 1} of ${pieces}`,
      count: 1,
      outline: fitted.outline,
      marks: fitted.marks,
      exactArea: flat.area,
      dims: [{ kind: "text", label: o.label, at: [box.w / 2, box.h / 2] }],
    });
  }
  // Corners are mirror images of each other, so one corner's lines serve all four.
  const rows: number[][] = [];
  for (let k = 0; k <= MARKS_PER_CORNER; k++) {
    const s = all[1 + (k * STEPS) / MARKS_PER_CORNER];
    rows.push([k + 1, (90 * k) / MARKS_PER_CORNER, dist3(s.top, s.bottom)]);
  }
  return devResult({ pieces: devPieces }, t, density, {
    steps: [...o.steps, `True surface = ${f(area3 / 1e6, 6)} m² in ${pieces} piece${pieces === 1 ? "" : "s"}`],
    development: o.development,
    markTable: { title: o.markTitle, columns: ["Line", o.markAngle, "True length mm"], rows },
  });
}

const sizeRefText = (i: ItemInputs) => (i.diaRef === "ID" ? " (inside)" : i.diaRef === "MEAN" ? " (mean)" : "");

export const rectToRect: ItemType = {
  id: "transition-rect-rect",
  size: (i) =>
    join(thk(i), `${n(i.a1)} × ${n(i.b1)}`, `${n(i.a2)} × ${n(i.b2)}`, `H ${n(i.height)}`) +
    (Number(i.r1) > 0 || Number(i.r2) > 0 ? ` (r ${n(i.r1 ?? 0)} / ${n(i.r2 ?? 0)})` : "") +
    sizeRefText(i),
  category: "fabricated",
  family: FAMILY,
  label: "Transition – rectangle to rectangle",
  description: "A transition between two rectangles, centred, top and base parallel, with optional corner radii. Made in 1, 2 or 4 pieces.",
  formulaText: [
    "Mean sizes: sides less t (outside) or plus t (inside); corner radii ∓ t/2",
    "Four flat sides (trapezia) + four corner cones where the corners are rounded",
    "Side centre lines: A side √(H² + ((B − b)/2)²), B side √(H² + ((A − a)/2)²)",
    "Flat pattern unrolled by triangles; finish = true surface × t × ρ, process = sheet rectangle per piece × t × ρ",
  ],
  fields: [
    { key: "a1", label: "Base side A", kind: "number", unit: "mm" },
    { key: "b1", label: "Base side B", kind: "number", unit: "mm" },
    { key: "r1", label: "Base corner radius R", kind: "number", unit: "mm", optional: true, help: "0 or blank for sharp corners" },
    { key: "a2", label: "Top side a (along A)", kind: "number", unit: "mm" },
    { key: "b2", label: "Top side b (along B)", kind: "number", unit: "mm" },
    { key: "r2", label: "Top corner radius r", kind: "number", unit: "mm", optional: true },
    { key: "height", label: "Height H", kind: "number", unit: "mm" },
    { key: "thk", label: "THK", kind: "number", unit: "mm" },
    SIZE_REF,
    PIECES("2"),
  ],
  compute(inp, { density }) {
    const t = pos(inp, "thk", "THK");
    const ref = diaRef(inp);
    const A = meanDia(pos(inp, "a1", "Base side A"), ref, t);
    const B = meanDia(pos(inp, "b1", "Base side B"), ref, t);
    const a = meanDia(pos(inp, "a2", "Top side a"), ref, t);
    const b = meanDia(pos(inp, "b2", "Top side b"), ref, t);
    const H = pos(inp, "height", "Height H");
    const R = cornerRadius(inp, "r1", ref, t);
    const r = cornerRadius(inp, "r2", ref, t);
    if (A <= 0 || B <= 0 || a <= 0 || b <= 0) throw new CalcError("Sizes are too small for this thickness");
    if (R > Math.min(A, B) / 2) throw new CalcError("Base corner radius is more than half the shorter base side");
    if (r > Math.min(a, b) / 2) throw new CalcError("Top corner radius is more than half the shorter top side");
    const lineA = Math.hypot(H, (B - b) / 2);
    const lineB = Math.hypot(H, (A - a) / 2);
    return developRectTransition(t, density, { x: A, y: B, r: R, z: 0 }, { x: a, y: b, r, z: H }, madeIn(inp, "2"), {
      label: `${f(A, 1)} × ${f(B, 1)} → ${f(a, 1)} × ${f(b, 1)}`,
      steps: [
        `Mean sizes: base ${f(A)} × ${f(B)}${R ? ` r ${f(R)}` : ""}, top ${f(a)} × ${f(b)}${r ? ` r ${f(r)}` : ""}, H ${f(H)} mm`,
        `Side centre lines: A side ${f(lineA)}, B side ${f(lineB)} mm`,
      ],
      development: { Am: A, Bm: B, am: a, bm: b, height: H, lineA, lineB },
      markTitle: "Corner lines, true length (each corner, from the B side to the A side)",
      markAngle: "Angle around the corner °",
    });
  },
};

/** Round to round, top tilted: divisions around the circles (marking line every RR_MARK_EVERY). */
const RR_DIV = 96;
const RR_MARK_EVERY = 4;

export const roundToRoundAngleTop: ItemType = {
  id: "transition-round-angle-top",
  size: (i) => join(thk(i), `Ø${n(i.d1)}`, `Ø${n(i.d2)}`, `H ${n(i.height)}`, `top ${n(i.tilt)}°`) + sizeRefText(i),
  category: "fabricated",
  family: FAMILY,
  label: "Transition – round to round – angle top",
  description: "Round to round with the axis perpendicular to the base; the top is tilted and its centre stays on the axis.",
  formulaText: [
    "Mean diameters: D and d less t (outside) or plus t (inside)",
    "Top circle tilted by β about its centre, at height H on the axis",
    "Points at the same angle on both circles joined; unrolled by triangles",
    "Finish = true surface × t × ρ, process = sheet rectangle × t × ρ",
  ],
  fields: [
    { key: "d1", label: "Base dia D", kind: "number", unit: "mm" },
    { key: "d2", label: "Top dia d (in its own plane)", kind: "number", unit: "mm" },
    { key: "height", label: "Height H (to the top centre)", kind: "number", unit: "mm" },
    { key: "tilt", label: "Top angle β", kind: "number", unit: "deg", help: "0 = top parallel to the base" },
    { key: "thk", label: "THK", kind: "number", unit: "mm" },
    SIZE_REF,
  ],
  compute(inp, { density }) {
    const t = pos(inp, "thk", "THK");
    const ref = diaRef(inp);
    const D = meanDia(pos(inp, "d1", "Base dia D"), ref, t);
    const d = meanDia(pos(inp, "d2", "Top dia d"), ref, t);
    const H = pos(inp, "height", "Height H");
    const beta = optNum(inp, "tilt");
    if (D <= 0 || d <= 0) throw new CalcError("Sizes are too small for this thickness");
    if (!(beta >= 0 && beta < 90)) throw new CalcError("Top angle must be from 0° to less than 90°");
    const R1 = D / 2;
    const R2 = d / 2;
    const b = toRad(beta);
    if (H - R2 * Math.sin(b) <= 0) throw new CalcError("The tilted top goes below the base — increase H or reduce the angle");
    // Seam on the short side (where the top is lowest), as Plate'n'Sheets.
    const tops: V3[] = [];
    const bots: V3[] = [];
    for (let i = 0; i <= RR_DIV; i++) {
      const p = Math.PI + (2 * Math.PI * i) / RR_DIV;
      bots.push([R1 * Math.cos(p), R1 * Math.sin(p), 0]);
      tops.push([R2 * Math.cos(p) * Math.cos(b), R2 * Math.sin(p), H + R2 * Math.cos(p) * Math.sin(b)]);
    }
    const flat = unrollOpen(tops, bots);
    const marks: [Pt, Pt][] = [];
    const rows: number[][] = [];
    for (let i = 0; i <= RR_DIV; i += RR_MARK_EVERY) {
      if (i > 0 && i < RR_DIV) marks.push([flat.bottom[i], flat.top[i]]);
      if (i <= RR_DIV / 2) rows.push([i / RR_MARK_EVERY + 1, (360 * i) / RR_DIV, dist3(tops[i], bots[i])]);
    }
    const fitted = fitToSheet(dedupe([...flat.bottom, ...[...flat.top].reverse()]), marks);
    const box = bbox(fitted.outline);
    const shortest = dist3(tops[0], bots[0]);
    const longest = dist3(tops[RR_DIV / 2], bots[RR_DIV / 2]);
    return devResult(
      {
        pieces: [
          {
            name: "Transition",
            count: 1,
            outline: fitted.outline,
            marks: fitted.marks,
            exactArea: flat.area,
            dims: [{ kind: "text", label: `Ø${f(D, 1)} → Ø${f(d, 1)} at ${f(beta)}°`, at: [box.w / 2, box.h / 2] }],
          },
        ],
      },
      t,
      density,
      {
        steps: [
          `Mean dias: D ${f(D)}, d ${f(d)} mm, H ${f(H)} mm, top at ${f(beta)}°`,
          `Lines: shortest ${f(shortest)} (at the seam), longest ${f(longest)} mm`,
          `True surface = ${f(flat.area / 1e6, 6)} m²`,
        ],
        development: { Dm: D, dm: d, height: H, shortest, longest },
        markTable: {
          title: "Generator lines, true length (from the seam, half way round; the other half mirrors)",
          columns: ["Line", "Angle from the seam °", "True length mm"],
          rows,
        },
      },
    );
  },
};

export const TRANSITION_TYPES: ItemType[] = [rectToRound, rectToRect, roundToRoundAngleTop];
