import { describe, expect, it } from "vitest";
import { rectToRound } from "../items/transitions";
import { itemSize } from "../size";
import type { ItemInputs } from "../types";

// Rectangle to round, checked against hand geometry: a flat pattern keeps every
// edge length and the true surface area of the part.

const rho = 8;
const run = (i: ItemInputs) => rectToRound.compute(i, { density: rho });

/** Surface by hand: 4 flat triangles + 4 corner cones (numerically integrated), mean sizes. */
function handArea(A: number, B: number, D: number, H: number, r: number) {
  const R = D / 2, ha = A / 2, hb = B / 2;
  const lineA = Math.hypot(H, hb - R);
  const lineB = Math.hypot(H, ha - R);
  // Flat sides: a triangle on the straight part of each side (side − 2r), 2 × ½ × base × height per pair.
  const area = (A - 2 * r) * lineA + (B - 2 * r) * lineB;
  // One corner: ruled surface between the corner arc and a quarter of the circle.
  const N = 20000;
  let corner = 0;
  for (let k = 0; k < N; k++) {
    const p = (a: number) => [ha - r + r * Math.cos(a), hb - r + r * Math.sin(a), 0];
    const q = (a: number) => [R * Math.cos(a), R * Math.sin(a), H];
    const a0 = (Math.PI / 2) * (k / N), a1 = (Math.PI / 2) * ((k + 1) / N);
    const tri = (u: number[], v: number[], w: number[]) => {
      const x = [v[0] - u[0], v[1] - u[1], v[2] - u[2]], y = [w[0] - u[0], w[1] - u[1], w[2] - u[2]];
      return Math.hypot(x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]) / 2;
    };
    corner += tri(p(a0), q(a0), p(a1)) + tri(q(a0), p(a1), q(a1));
  }
  return { area: area + 4 * corner, lineA, lineB };
}

describe("transition rectangle to round", () => {
  const base = { a: 600, b: 400, d: 300, height: 500, thk: 3, diaRef: "OD" };
  // Mean sizes (outside dims − t).
  const A = 597, B = 397, D = 297, H = 500;

  it("flat pattern keeps the true surface area (sharp corners)", () => {
    const res = run(base);
    const hand = handArea(A, B, D, H, 0);
    // 48 steps per corner: within 0.01 % of the hand value.
    expect(Math.abs(res.mass!.actual.area * 1e6 - hand.area) / hand.area).toBeLessThan(1e-4);
    expect(res.finishWt).toBeCloseTo((hand.area * 3 * rho) / 1e6, 3);
    expect(res.development!.lineA).toBeCloseTo(hand.lineA, 9);
    expect(res.development!.lineB).toBeCloseTo(hand.lineB, 9);
  });

  it("flat pattern keeps every edge length: rectangle + circle + seams", () => {
    const lineB = Math.hypot(H, A / 2 - D / 2);
    const lineA = Math.hypot(H, B / 2 - D / 2);
    const edges = 2 * (A + B) + Math.PI * D;
    const per = (pieces: string) => run({ ...base, pieces }).mass!.actual.perimeter;
    // Circle is drawn as 4 × 48 chords: allow 0.01 %.
    expect(Math.abs(per("1") - (edges + 2 * lineB)) / per("1")).toBeLessThan(1e-4);
    expect(Math.abs(per("2") - (edges + 4 * lineB)) / per("2")).toBeLessThan(1e-4);
    expect(Math.abs(per("4") - (edges + 4 * lineB + 4 * lineA)) / per("4")).toBeLessThan(1e-4);
  });

  it("1, 2 or 4 pieces: same finish weight, a sheet rectangle per piece", () => {
    const one = run({ ...base, pieces: "1" });
    const two = run({ ...base, pieces: "2" });
    const four = run({ ...base, pieces: "4" });
    expect(two.finishWt).toBeCloseTo(one.finishWt, 9);
    expect(four.finishWt).toBeCloseTo(one.finishWt, 9);
    expect(one.dev!.pieces).toHaveLength(1);
    expect(two.dev!.pieces).toHaveLength(2);
    expect(four.dev!.pieces).toHaveLength(4);
    for (const r of [one, two, four]) expect(r.processWt).toBeGreaterThan(r.finishWt);
  });

  it("corner radius: rounded corners in the area and in the bottom edge", () => {
    const r = 50;
    const res = run({ ...base, r });
    const rm = r - 3 / 2;
    const hand = handArea(A, B, D, H, rm);
    expect(Math.abs(res.mass!.actual.area * 1e6 - hand.area) / hand.area).toBeLessThan(1e-4);
    const lineB = Math.hypot(H, A / 2 - D / 2);
    const edges = 2 * (A + B) - (8 - 2 * Math.PI) * rm + Math.PI * D;
    expect(Math.abs(res.mass!.actual.perimeter - (edges + 2 * lineB)) / edges).toBeLessThan(1e-4);
    expect(res.development!.rc).toBeCloseTo(rm, 9);
  });

  it("square to round, inside sizes", () => {
    const res = run({ a: 500, b: 500, d: 250, height: 400, thk: 4, diaRef: "ID" });
    const hand = handArea(504, 504, 254, 400, 0);
    expect(Math.abs(res.mass!.actual.area * 1e6 - hand.area) / hand.area).toBeLessThan(1e-5);
    expect(res.development!.lineA).toBeCloseTo(res.development!.lineB, 9);
  });

  it("corner line table: first line runs from the corner to the B side point of the circle", () => {
    const res = run(base);
    const rows = res.markTable!.rows;
    expect(rows).toHaveLength(5);
    expect(rows[0][2]).toBeCloseTo(Math.hypot(A / 2 - D / 2, B / 2, H), 9);
    expect(rows[4][2]).toBeCloseTo(Math.hypot(A / 2, B / 2 - D / 2, H), 9);
  });

  it("rejects impossible sizes", () => {
    expect(() => run({ ...base, r: 300 })).toThrow(/Corner radius/);
    expect(() => run({ ...base, height: 0 })).toThrow();
    expect(() => run({ ...base, pieces: "3" })).toThrow(/1, 2 or 4/);
  });

  it("Size text", () => {
    expect(itemSize(rectToRound, { ...base, r: 25 })).toBe("3 THK × 600 × 400 × Ø300 × H 500 (r 25)");
  });
});
