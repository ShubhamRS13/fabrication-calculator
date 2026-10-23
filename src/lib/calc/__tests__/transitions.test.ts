import { describe, expect, it } from "vitest";
import { rectToRect, rectToRound, roundToRoundAngleTop } from "../items/transitions";
import { CalcError } from "../types";
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

// Plate'n'Sheets Professional V4 outputs, Screenshot/ folders (23 Oct 2026).
describe("transitions vs Plate'n'Sheets", () => {
  const c = { density: 7.25 };
  const rr = (pieces: string) =>
    rectToRect.compute({ a1: 300, b1: 500, r1: 30, a2: 100, b2: 300, r2: 20, height: 400, thk: 6, diaRef: "OD", pieces }, c);

  it("rectangle to rectangle 300 × 500 r30 → 100 × 300 r20, H 400, 6 THK outside", () => {
    const two = rr("2");
    // P'n'S actual 0.4700839 m², 20.45 kg at 7.25 (ours divides the corners finer)
    expect(two.mass!.actual.area).toBeCloseTo(0.4700839, 3);
    expect(two.finishWt).toBeCloseTo(20.45, 1);
    // 2 cuts: each piece about 714.47 × 476.89 (rect 0.3407232 m²)
    for (const p of two.mass!.pieces) {
      expect(p.frameW).toBeCloseTo(714.47, 0);
      expect(Math.abs(p.frameH - 476.89)).toBeLessThan(2);
    }
    // 1 cut: 1276.21 × 566.84
    const one = rr("1");
    expect(Math.abs(one.mass!.pieces[0].frameW - 1276.21)).toBeLessThan(1);
    expect(Math.abs(one.mass!.pieces[0].frameH - 566.84)).toBeLessThan(1);
    expect(one.finishWt).toBeCloseTo(two.finishWt, 9);
    expect(rr("4").finishWt).toBeCloseTo(two.finishWt, 9);
  });

  it("rectangle to rectangle with sharp corners = four flat trapezia", () => {
    const r = rectToRect.compute({ a1: 400, b1: 600, a2: 200, b2: 300, height: 500, thk: 2, diaRef: "MEAN", pieces: "4" }, c);
    const trap = (top: number, bot: number, h: number) => ((top + bot) / 2) * h;
    const sideA = Math.hypot(500, (600 - 300) / 2); // slant of the A sides
    const sideB = Math.hypot(500, (400 - 200) / 2);
    const area = 2 * trap(200, 400, sideA) + 2 * trap(300, 600, sideB);
    expect(r.mass!.actual.area * 1e6).toBeCloseTo(area, 3);
  });

  it("round to round, top at 45°: Ø500 → Ø300, H 500, 6 THK outside", () => {
    const r = roundToRoundAngleTop.compute({ d1: 500, d2: 300, height: 500, tilt: 45, thk: 6, diaRef: "OD" }, c);
    // P'n'S 0.6044009 m² with 24 divisions; ours (96) is the truer surface, 0.3 % more
    expect(Math.abs(r.mass!.actual.area - 0.6044009) / 0.6044009).toBeLessThan(0.005);
    const p = r.mass!.pieces[0];
    expect(Math.abs(p.frameW - 1430.22)).toBeLessThan(5);
    expect(Math.abs(p.frameH - 620.17)).toBeLessThan(2);
  });

  it("round to round with a flat top is a cone frustum", () => {
    const r = roundToRoundAngleTop.compute({ d1: 600, d2: 300, height: 400, tilt: 0, thk: 2, diaRef: "MEAN" }, c);
    const slant = Math.hypot(400, 150);
    // 96 straight divisions sit just inside the true cone (0.02 % less)
    const exact = Math.PI * (300 + 150) * slant;
    expect(Math.abs(r.mass!.actual.area * 1e6 - exact) / exact).toBeLessThan(0.001);
  });

  it("rejects impossible sizes", () => {
    expect(() => rectToRect.compute({ a1: 300, b1: 500, r1: 200, a2: 100, b2: 300, height: 400, thk: 6 }, c)).toThrow(CalcError);
    expect(() => roundToRoundAngleTop.compute({ d1: 500, d2: 300, height: 100, tilt: 60, thk: 6 }, c)).toThrow(CalcError);
  });
});
