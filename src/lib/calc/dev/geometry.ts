import type { Pt } from "../types";

// Plane geometry for flat patterns. Units: mm. y points up.

/** Shoelace area of a closed polygon (always positive). */
export function polygonArea(pts: Pt[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

/** Length of a closed polygon's boundary. */
export function closedLength(pts: Pt[]): number {
  let l = 0;
  for (let i = 0; i < pts.length; i++) l += dist(pts[i], pts[(i + 1) % pts.length]);
  return l;
}

export const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);

export function bbox(pts: Pt[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/**
 * Points on an arc from angle a0 to a1 (radians, measured from +y, clockwise
 * positive, so a symmetric fan sits upright). Includes every quarter point that
 * falls inside the arc, so the bounding box is exact.
 */
export function arc(center: Pt, r: number, a0: number, a1: number, segments = 120): Pt[] {
  const angles = new Set<number>();
  for (let i = 0; i <= segments; i++) angles.add(a0 + ((a1 - a0) * i) / segments);
  const lo = Math.min(a0, a1);
  const hi = Math.max(a0, a1);
  for (let k = Math.ceil(lo / (Math.PI / 2)); k * (Math.PI / 2) <= hi; k++) angles.add(k * (Math.PI / 2));
  const sorted = [...angles].sort((p, q) => (a1 >= a0 ? p - q : q - p));
  return sorted.map((a) => polar(center, r, a));
}

/** Point at distance r and angle a (from +y, clockwise). */
export function polar(center: Pt, r: number, a: number): Pt {
  return [center[0] + r * Math.sin(a), center[1] + r * Math.cos(a)];
}

export function circle(center: Pt, r: number, segments = 180): Pt[] {
  return arc(center, r, 0, 2 * Math.PI, segments).slice(0, -1);
}

export function rect(x: number, y: number, w: number, h: number): Pt[] {
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}

/** Move every point so the shape's bounding box starts at (0, 0). */
export function normalise(pts: Pt[], others: Pt[][] = []): { dx: number; dy: number } {
  const b = bbox(pts);
  const dx = -b.minX;
  const dy = -b.minY;
  for (const list of [pts, ...others]) for (const p of list) { p[0] += dx; p[1] += dy; }
  return { dx, dy };
}

// ---------- 3D, for triangulated developments ----------

export type V3 = [number, number, number];
export const dist3 = (a: V3, b: V3) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);

/**
 * Third corner of a triangle from two known corners and its distances to them,
 * on the right-hand side of the direction a → b.
 */
export function triangulate(a: Pt, b: Pt, da: number, db: number): Pt {
  const d = dist(a, b);
  const x = (da * da - db * db + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, da * da - x * x));
  const ux = (b[0] - a[0]) / d;
  const uy = (b[1] - a[1]) / d;
  // right-hand normal of a → b
  return [a[0] + ux * x + uy * h, a[1] + uy * x - ux * h];
}

/**
 * Unroll the surface between two closed 3D loops whose points correspond
 * (top[i] joins bottom[i] by a straight generator). Returns the flat loops
 * (with the seam repeated at the end) and the true surface area.
 */
export function unrollStrip(top: V3[], bottom: V3[]) {
  const n = top.length;
  const t: Pt[] = [];
  const b: Pt[] = [];
  b.push([0, 0]);
  t.push([0, dist3(top[0], bottom[0])]);
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    // Triangle (b_i, t_i, b_j), then (t_i, b_j, t_j). The pattern grows to the right.
    const bj = triangulate(t[i], b[i], dist3(top[i], bottom[j]), dist3(bottom[i], bottom[j]));
    const tj = triangulate(t[i], bj, dist3(top[i], top[j]), dist3(bottom[j], top[j]));
    b.push(bj);
    t.push(tj);
    area += triArea3(bottom[i], top[i], bottom[j]) + triArea3(top[i], bottom[j], top[j]);
  }
  return { top: t, bottom: b, area };
}

function triArea3(a: V3, b: V3, c: V3) {
  const u: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
}

/**
 * Unroll an open strip between two 3D polylines whose points correspond
 * (top[i] joins bottom[i] by a straight line). Repeated points are fine: a run
 * of equal top points with moving bottom points is a flat triangle, and the
 * other way round. Returns the flat polylines and the true surface area.
 */
export function unrollOpen(top: V3[], bottom: V3[]) {
  const t: Pt[] = [[0, dist3(top[0], bottom[0])]];
  const b: Pt[] = [[0, 0]];
  let area = 0;
  for (let i = 0; i + 1 < top.length; i++) {
    const j = i + 1;
    const bj = triangulate(t[i], b[i], dist3(top[i], bottom[j]), dist3(bottom[i], bottom[j]));
    const tj = triangulate(t[i], bj, dist3(top[i], top[j]), dist3(bottom[j], top[j]));
    b.push(bj);
    t.push(tj);
    area += triArea3(bottom[i], top[i], bottom[j]) + triArea3(top[i], bottom[j], top[j]);
  }
  return { top: t, bottom: b, area };
}
