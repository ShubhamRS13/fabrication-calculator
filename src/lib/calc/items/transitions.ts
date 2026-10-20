import { CalcError, type DevPiece, type FieldDef, type ItemType, type Pt } from "../types";
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
    { value: "ID", label: "Inside" },
  ],
  default: "OD",
};

interface Station {
  top: V3;
  bottom: V3;
  /** Middle of a side: where a seam may go. */
  sideMid?: boolean;
  /** Draw a marking line here. */
  mark?: boolean;
}

/** Stations around the transition, counter-clockwise from the middle of the right-hand B side. */
function stations(A: number, B: number, D: number, H: number, r: number): Station[] {
  const R = D / 2;
  const ha = A / 2;
  const hb = B / 2;
  const top = (deg: number): V3 => [R * Math.cos(toRad(deg)), R * Math.sin(toRad(deg)), H];
  const centres: [number, number][] = [
    [ha - r, hb - r],
    [-(ha - r), hb - r],
    [-(ha - r), -(hb - r)],
    [ha - r, -(hb - r)],
  ];
  const mids: [number, number][] = [[ha, 0], [0, hb], [-ha, 0], [0, -hb]];
  const out: Station[] = [];
  for (let q = 0; q < 4; q++) {
    const a0 = q * 90;
    const [cx, cy] = centres[q];
    out.push({ top: top(a0), bottom: [mids[q][0], mids[q][1], 0], sideMid: true });
    for (let k = 0; k <= STEPS; k++) {
      const a = a0 + (90 * k) / STEPS;
      out.push({
        top: top(a),
        bottom: [cx + r * Math.cos(toRad(a)), cy + r * Math.sin(toRad(a)), 0],
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
    {
      key: "pieces",
      label: "Made in",
      kind: "select",
      options: [
        { value: "1", label: "1 piece (seam at the middle of a B side)" },
        { value: "2", label: "2 pieces (seams at the middle of both B sides)" },
        { value: "4", label: "4 pieces (seams at the middle of every side)" },
      ],
      default: "1",
    },
  ],
  compute(inp, { density }) {
    const t = pos(inp, "thk", "THK");
    const ref = diaRef(inp);
    const A = meanDia(pos(inp, "a", "Side A"), ref, t);
    const B = meanDia(pos(inp, "b", "Side B"), ref, t);
    const D = meanDia(pos(inp, "d", "Round dia D"), ref, t);
    const H = pos(inp, "height", "Height H");
    const rIn = optNum(inp, "r");
    if (rIn < 0) throw new CalcError("Corner radius cannot be negative");
    const r = rIn > 0 ? Math.max(0, ref === "OD" ? rIn - t / 2 : rIn + t / 2) : 0;
    if (A <= 0 || B <= 0 || D <= 0) throw new CalcError("Sizes are too small for this thickness");
    if (r > Math.min(A, B) / 2) throw new CalcError("Corner radius is more than half the shorter side");
    const pieces = Number(str(inp, "pieces", "1"));
    if (![1, 2, 4].includes(pieces)) throw new CalcError("Made in 1, 2 or 4 pieces");

    const all = stations(A, B, D, H, r);
    // Seams at side middles: index of each side-middle station (0 = right B side, 1 = top A side…).
    const midIdx = all.flatMap((s, i) => (s.sideMid ? [i] : []));
    const seamSides = pieces === 1 ? [0] : pieces === 2 ? [0, 2] : [0, 1, 2, 3];
    const loop = [...all, all[0]];
    const devPieces: DevPiece[] = [];
    let area3 = 0;
    const lengths = new Map<number, number>();
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
        dims: [{ kind: "text", label: `${f(A, 1)} × ${f(B, 1)} → Ø${f(D, 1)}`, at: [box.w / 2, box.h / 2] }],
      });
    }
    // Corners are mirror images of each other, so one corner's lines serve all four.
    for (let k = 0; k <= MARKS_PER_CORNER; k++) {
      const s = all[1 + (k * STEPS) / MARKS_PER_CORNER];
      lengths.set(k, dist3(s.top, s.bottom));
    }
    const lineA = Math.hypot(H, B / 2 - D / 2);
    const lineB = Math.hypot(H, A / 2 - D / 2);
    const rows = [...lengths].map(([k, len]) => [k + 1, (90 * k) / MARKS_PER_CORNER, len]);

    return devResult({ pieces: devPieces }, t, density, {
      steps: [
        `Mean sizes: A ${f(A)}, B ${f(B)}, D ${f(D)}${r ? `, corner r ${f(r)}` : ""} mm, H ${f(H)} mm`,
        `Side centre lines: A side ${f(lineA)}, B side ${f(lineB)} mm`,
        `True surface = ${f(area3 / 1e6, 6)} m² in ${pieces} piece${pieces === 1 ? "" : "s"}`,
      ],
      development: { Am: A, Bm: B, Dm: D, ...(r ? { rc: r } : {}), height: H, lineA, lineB },
      markTable: {
        title: "Corner lines, true length (each corner, from the B side to the A side)",
        columns: ["Line", "Angle on the circle °", "True length mm"],
        rows,
      },
    });
  },
};

export const TRANSITION_TYPES: ItemType[] = [rectToRound];
