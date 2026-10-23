import { describe, expect, it } from "vitest";
import { elbow90, elbowAngle, elbowDouble, segBend90, segBendAngle } from "../items/elbows";
import { CalcError, type ItemResult } from "../types";

// Each case is a Plate'n'Sheets Professional V4 output (Screenshot/<pattern>/mass.txt, 23 Oct 2026).
// Areas in m²; P'n'S prints 7 decimals.

const CTX = { density: 7.85 };
const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 5);

/** Per-piece rectangle and actual areas, one entry per physical piece, as P'n'S lists them. */
function perPiece(r: ItemResult) {
  return r.mass!.pieces.flatMap((p) => Array.from({ length: p.count }, () => ({ rect: p.frame.area / p.count, actual: p.actual.area / p.count })));
}

describe("elbows and segmented bends vs Plate'n'Sheets", () => {
  it("elbow 90: Ø200 mean, legs 600 + 500, 4 THK", () => {
    const r = elbow90.compute({ dia: 200, diaRef: "MEAN", leg1: 600, leg2: 500, thk: 4 }, CTX);
    expect(r.sheetL).toBeCloseTo(628.32, 2);
    expect(r.sheetW).toBeCloseTo(1100, 6);
    near(r.mass!.frame.area, 0.6911504); // single rectangle = process
    near(r.mass!.actual.area, 0.6911504);
    const p = perPiece(r);
    near(p[0].rect, 0.439823);
    near(p[1].rect, 0.3769911);
    near(p[0].actual, 0.3769911);
    near(p[1].actual, 0.3141593);
    expect(r.processWt).toBeCloseTo((0.6911504 * 4 * 7.85), 3);
  });

  it("elbow angle: OD 200 outside, 110° between legs, legs 600 + 500, 6 THK", () => {
    const r = elbowAngle.compute({ dia: 200, diaRef: "OD", leg1: 600, leg2: 500, angle: 110, thk: 6 }, CTX);
    expect(r.sheetL).toBeCloseTo(609.47, 2);
    near(r.mass!.frame.area, 0.6704159);
    const p = perPiece(r);
    near(p[0].rect, 0.4070766);
    near(p[1].rect, 0.3461297);
    near(p[0].actual, 0.3656814);
    near(p[1].actual, 0.3047345);
  });

  it("double elbow: Ø300 mean, 300 / rise 600 / 400, offset 350, 5 THK", () => {
    const r = elbowDouble.compute({ dia: 300, diaRef: "MEAN", top: 300, rise: 600, bottom: 400, offset: 350, thk: 5 }, CTX);
    expect(r.sheetL).toBeCloseTo(942.48, 2);
    expect(r.sheetW).toBeCloseTo(1394.62, 2);
    near(r.mass!.frame.area, 1.3144005);
    const p = perPiece(r);
    near(p[0].rect, 0.4152108);
    near(p[1].rect, 0.7311054);
    near(p[2].rect, 0.320963);
    near(p[0].actual, 0.3769911);
    near(p[1].actual, 0.654666);
    near(p[2].actual, 0.2827433);
  });

  it("segmented bend 90: OD 500, R 900, 5 segments, 6 THK", () => {
    const r = segBend90.compute({ dia: 500, diaRef: "OD", bendRadius: 900, segments: 5, thk: 6 }, CTX);
    expect(r.sheetL).toBeCloseTo(1551.95, 2);
    expect(r.sheetW).toBeCloseTo(1432.17, 2);
    near(r.mass!.frame.area, 2.2226501);
    near(r.mass!.actual.area, 2.2226501);
    const p = perPiece(r);
    expect(p).toHaveLength(5);
    near(p[0].rect, 0.3540805);
    near(p[0].actual, 0.2778313);
    near(p[2].rect, 0.708161);
    near(p[2].actual, 0.5556625);
    // Sum of separate rectangles = P'n'S "multiple rectangle"
    near(p.reduce((a, x) => a + x.rect, 0), 2.8326441);
  });

  it("segmented bend angle: OD 500, R 1500, 60°, 8 segments, 4 THK", () => {
    const r = segBendAngle.compute({ dia: 500, diaRef: "OD", bendRadius: 1500, segments: 8, angle: 60, thk: 4 }, CTX);
    expect(r.sheetL).toBeCloseTo(1558.23, 2);
    expect(r.sheetW).toBeCloseTo(1573.73, 2);
    near(r.mass!.frame.area, 2.452237);
    const p = perPiece(r);
    expect(p).toHaveLength(8);
    near(p[0].rect, 0.2041195);
    near(p[0].actual, 0.1751598);
    near(p[3].rect, 0.4082391);
    near(p[3].actual, 0.3503196);
    near(p.reduce((a, x) => a + x.rect, 0), 2.8576736);
  });

  it("outlines enclose the stated shape area", () => {
    const r = segBend90.compute({ dia: 500, diaRef: "OD", bendRadius: 900, segments: 5, thk: 6 }, CTX);
    for (const piece of r.dev!.pieces) {
      let a = 0;
      const o = piece.outline;
      for (let i = 0; i < o.length; i++) {
        const [x1, y1] = o[i];
        const [x2, y2] = o[(i + 1) % o.length];
        a += x1 * y2 - x2 * y1;
      }
      expect(Math.abs(a / 2) / piece.exactArea!).toBeCloseTo(1, 3);
    }
  });

  it("rejects cuts that cross", () => {
    expect(() => segBend90.compute({ dia: 500, bendRadius: 200, segments: 5, thk: 6 }, CTX)).toThrow(CalcError);
    expect(() => elbow90.compute({ dia: 200, leg1: 50, leg2: 500, thk: 4 }, CTX)).toThrow(CalcError);
    expect(() => elbowAngle.compute({ dia: 200, leg1: 600, leg2: 500, angle: 180, thk: 4 }, CTX)).toThrow(CalcError);
  });
});
