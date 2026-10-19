import { describe, expect, it } from "vitest";
import { polygonArea, unrollStrip, type V3 } from "../dev/geometry";
import {
  coneFrustumAngle, coneFrustumApex, coneFrustumHeight, coneOblique90, coneObliqueOffset, coneTruncBase, coneTruncBoth, coneTruncTop,
} from "../items/cones";
import {
  cylinderFull, cylinderGable, cylinderTruncCentre, cylinderTruncHeights, cylinderTruncRadius, cylinderTruncSide,
} from "../items/cylinders";
import { closedForm, dishEllip, dishHemi, dishTori } from "../items/dish-ends";
import { ringFlange } from "../items/sheet";
import { CalcError } from "../types";
import { BUILT_IN_LIBRARY } from "../sections-lib";

const SS = { density: 8 };
const kgOf = (areaMm2: number, t: number) => (areaMm2 * t * 8) / 1e6;
const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);

describe("geometry", () => {
  it("polygon area", () => {
    expect(polygonArea([[0, 0], [4, 0], [4, 3], [0, 3]])).toBe(12);
  });

  it("triangulated strip of a right frustum ≈ its lateral area", () => {
    const n = 360;
    const top: V3[] = [];
    const bot: V3[] = [];
    for (let i = 0; i < n; i++) {
      const p = (2 * Math.PI * i) / n;
      bot.push([500 * Math.cos(p), 500 * Math.sin(p), 0]);
      top.push([200 * Math.cos(p), 200 * Math.sin(p), 400]);
    }
    const s = unrollStrip(top, bot);
    expect(rel(s.area, Math.PI * (500 + 200) * 500)).toBeLessThan(5e-5);
  });
});

describe("right cone frustum – three ways to enter it give the same cone", () => {
  const base = { d1: 1000, d2: 300, diaRef: "OD", thk: 5 };
  const a = coneFrustumHeight.compute({ ...base, height: 800 }, SS);
  const Ha = a.development!.apexHeight;
  const Rb = a.development!.Rb;

  it("top dia & apex height", () => {
    const b = coneFrustumApex.compute({ ...base, apexHeight: Ha }, SS);
    expect(b.finishWt).toBeCloseTo(a.finishWt, 9);
    expect(b.processWt).toBeCloseTo(a.processWt, 9);
  });

  it("top dia & cone angle", () => {
    const alpha = (2 * Math.atan(Rb / Ha) * 180) / Math.PI;
    const c = coneFrustumAngle.compute({ ...base, angle: alpha }, SS);
    expect(c.finishWt).toBeCloseTo(a.finishWt, 9);
  });

  it("mass report: actual = finish, frame = process, frame is the fan's bounding box", () => {
    expect(a.mass!.actual.mass).toBeCloseTo(a.finishWt, 12);
    expect(a.mass!.frame.mass).toBeCloseTo(a.processWt, 12);
    expect(a.mass!.pieces[0].frameW).toBeCloseTo(a.sheetL!, 9);
    expect(a.markTable!.rows).toHaveLength(25);
  });

  it("rejects an angle of 180° or more", () => {
    expect(() => coneFrustumAngle.compute({ ...base, angle: 180 }, SS)).toThrow(CalcError);
  });
});

/** Independent check: build the cut surface in 3D and triangulate it. */
function coneSurfaceArea(Rb: number, Ha: number, bottom: [number, number], top: [number, number]) {
  const n = 720;
  const z = (h: number, tan: number, phi: number) => {
    const k = (tan * Rb * Math.cos(phi)) / Ha;
    return (h + k * Ha) / (1 + k);
  };
  const pt = (zz: number, phi: number): V3 => {
    const r = (Rb * (Ha - zz)) / Ha;
    return [r * Math.cos(phi), r * Math.sin(phi), zz];
  };
  const t: V3[] = [];
  const b: V3[] = [];
  for (let i = 0; i < n; i++) {
    const phi = (2 * Math.PI * i) / n;
    t.push(pt(z(top[0], top[1], phi), phi));
    b.push(pt(z(bottom[0], bottom[1], phi), phi));
  }
  return unrollStrip(t, b).area;
}

describe("truncated right cones", () => {
  const tan = (d: number) => Math.tan((d * Math.PI) / 180);
  const Rb = 600 - 3; // OD 1200, t 6
  const alpha = 60;
  const Ha = Rb / Math.tan(((alpha / 2) * Math.PI) / 180);

  it("top truncated: area matches an independent 3D triangulation", () => {
    const r = coneTruncTop.compute({ d1: 1200, diaRef: "OD", angle: alpha, cutHeight: 500, cutAngle: 20, thk: 6 }, SS);
    const area = coneSurfaceArea(Rb, Ha, [0, 0], [500, tan(20)]);
    expect(rel(r.finishWt, kgOf(area, 6))).toBeLessThan(1e-4);
    // Shortest generator on the seam, longest opposite.
    const lens = r.markTable!.rows.map((row) => row[4]);
    expect(lens[0]).toBeCloseTo(Math.min(...lens), 6);
  });

  it("base truncated", () => {
    const r = coneTruncBase.compute({ d1: 1200, d2: 400, diaRef: "OD", height: 700, cutAngle: 15, thk: 6 }, SS);
    const rt = 200 - 3;
    const HaB = (700 * Rb) / (Rb - rt);
    const area = coneSurfaceArea(Rb, HaB, [0, tan(15)], [700, 0]);
    expect(rel(r.finishWt, kgOf(area, 6))).toBeLessThan(1e-4);
  });

  it("top and base truncated", () => {
    const r = coneTruncBoth.compute({ d1: 1200, diaRef: "OD", angle: alpha, baseAngle: -10, cutHeight: 450, cutAngle: 25, thk: 6 }, SS);
    const area = coneSurfaceArea(Rb, Ha, [0, tan(-10)], [450, tan(25)]);
    expect(rel(r.finishWt, kgOf(area, 6))).toBeLessThan(1e-4);
  });

  it("cuts that cross, or go above the apex, are refused", () => {
    expect(() => coneTruncTop.compute({ d1: 1200, diaRef: "OD", angle: alpha, cutHeight: 2000, cutAngle: 0.0001, thk: 6 }, SS)).toThrow(CalcError);
    expect(() => coneTruncTop.compute({ d1: 1200, diaRef: "OD", angle: alpha, cutHeight: 50, cutAngle: 60, thk: 6 }, SS)).toThrow(CalcError);
  });
});

describe("oblique cones", () => {
  it("zero offset gives the right frustum", () => {
    const right = coneFrustumHeight.compute({ d1: 1000, d2: 400, diaRef: "OD", height: 600, thk: 4 }, SS);
    const obl = coneObliqueOffset.compute({ d1: 1000, d2: 400, diaRef: "OD", height: 600, offset: 0, thk: 4 }, SS);
    expect(rel(obl.finishWt, right.finishWt)).toBeLessThan(5e-5);
  });

  it("90° side: the shortest generator is the vertical side (= H)", () => {
    const r = coneOblique90.compute({ d1: 1000, d2: 400, diaRef: "OD", height: 600, thk: 4 }, SS);
    expect(r.development!.offset).toBeCloseTo(300, 9);
    expect(r.development!.shortest).toBeCloseTo(600, 6);
    expect(r.markTable!.rows[0][1]).toBeCloseTo(600, 6);
    expect(r.processWt).toBeGreaterThan(r.finishWt);
  });
});

describe("cylinders", () => {
  const base = { dia: 500, diaRef: "OD", thk: 5 };
  const P = Math.PI * 495;

  it("full = π Dm H", () => {
    const r = cylinderFull.compute({ ...base, height: 800 }, SS);
    expect(r.finishWt).toBeCloseTo(kgOf(P * 800, 5), 9);
    expect(r.scrap).toBeCloseTo(0, 9);
  });

  it("plane cuts keep area = girth × centre height", () => {
    const c = cylinderTruncCentre.compute({ ...base, height: 800, cutAngle: 30 }, SS);
    expect(c.finishWt).toBeCloseTo(kgOf(P * 800, 5), 9);
    const R = 247.5;
    const k = Math.tan(Math.PI / 6);
    expect(c.development!.shortest).toBeCloseTo(800 - R * k, 6);
    expect(c.development!.longest).toBeCloseTo(800 + R * k, 6);
    const side = cylinderTruncSide.compute({ ...base, sideHeight: 800 - R * k, cutAngle: 30 }, SS);
    expect(side.finishWt).toBeCloseTo(c.finishWt, 9);
    const hts = cylinderTruncHeights.compute({ ...base, h1: 900, h2: 700 }, SS);
    expect(hts.development!.longest).toBeCloseTo(900, 6);
    expect(hts.development!.shortest).toBeCloseTo(700, 6);
    expect(hts.processWt).toBeCloseTo(kgOf(P * 900, 5), 6);
  });

  it("radius cut matches numeric integration", () => {
    const R = 247.5;
    const Rc = 400;
    const H = 800;
    const r = cylinderTruncRadius.compute({ ...base, height: H, radius: Rc }, SS);
    let area = 0;
    const n = 200000;
    for (let i = 0; i < n; i++) {
      const phi = (2 * Math.PI * (i + 0.5)) / n;
      const x = R * Math.cos(phi);
      area += (H - Rc + Math.sqrt(Rc * Rc - x * x)) * ((2 * Math.PI * R) / n);
    }
    expect(rel(r.finishWt, kgOf(area, 5))).toBeLessThan(1e-5);
    expect(() => cylinderTruncRadius.compute({ ...base, height: H, radius: 100 }, SS)).toThrow(CalcError);
  });

  it("gable vent", () => {
    const r = cylinderGable.compute({ ...base, height: 800, cutAngle: 45 }, SS);
    expect(r.development!.longest).toBeCloseTo(800, 6);
    expect(r.development!.shortest).toBeCloseTo(800 - 247.5, 6);
  });

  it("refuses a cut below the base", () => {
    expect(() => cylinderTruncCentre.compute({ ...base, height: 50, cutAngle: 60 }, SS)).toThrow(CalcError);
  });
});

describe("end caps", () => {
  const a = 497; // OD 1000, t 6

  it("hemispherical: L = π a / 2, A = 2π a²", () => {
    const r = dishHemi.compute({ dia: 1000, diaRef: "OD", thk: 6, sf: 40 }, SS);
    expect(r.development!.meridian).toBeCloseTo((Math.PI * a) / 2, 4);
    expect(r.development!.blankDia).toBeCloseTo(2 * ((Math.PI * a) / 2 + 40), 4);
    expect(rel(r.surfaceArea!, 2 * Math.PI * a * a + 2 * Math.PI * a * 40)).toBeLessThan(1e-6);
    const byArea = dishHemi.compute({ dia: 1000, diaRef: "OD", thk: 6, sf: 40, method: "area" }, SS);
    expect(rel(byArea.finishWt, kgOf(2 * Math.PI * a * a + 2 * Math.PI * a * 40, 6))).toBeLessThan(1e-6);
  });

  it("semi-elliptical with h = a equals the hemisphere; 2:1 head area matches the spheroid formula", () => {
    const hemi = dishHemi.compute({ dia: 1000, diaRef: "OD", thk: 6 }, SS);
    const same = dishEllip.compute({ dia: 1000, diaRef: "OD", thk: 6, depth: a }, SS);
    expect(rel(same.surfaceArea!, hemi.surfaceArea!)).toBeLessThan(1e-6);
    const b = a / 2;
    const e = Math.sqrt(1 - (b * b) / (a * a));
    const exact = Math.PI * a * a * (1 + ((1 - e * e) / e) * Math.atanh(e));
    const r = dishEllip.compute({ dia: 1000, diaRef: "OD", thk: 6, depth: b }, SS);
    expect(rel(r.surfaceArea!, exact)).toBeLessThan(1e-6);
  });

  it("torispherical matches the closed forms", () => {
    const r = dishTori.compute({ dia: 1000, diaRef: "OD", thk: 6, crown: 1000, knuckle: 100 }, SS);
    expect(rel(r.development!.meridian, closedForm.toriLength(a, 1000, 100))).toBeLessThan(1e-6);
    expect(rel(r.surfaceArea!, closedForm.toriArea(a, 1000, 100))).toBeLessThan(1e-6);
    expect(() => dishTori.compute({ dia: 1000, diaRef: "OD", thk: 6, crown: 300, knuckle: 100 }, SS)).toThrow(CalcError);
  });

  it("end hole: blank gets a hole, weight drops, job work is carried", () => {
    const solid = dishHemi.compute({ dia: 1000, diaRef: "OD", thk: 6 }, SS);
    const holed = dishHemi.compute({ dia: 1000, diaRef: "OD", thk: 6, holeDia: 200, jobWork: 2500 }, SS);
    expect(holed.dev!.pieces[0].holes).toHaveLength(1);
    expect(holed.finishWt).toBeLessThan(solid.finishWt);
    expect(holed.fixedCost).toBe(2500);
    // Meridian length to the hole edge on a hemisphere: a × asin(r/a)
    expect(holed.development!.holeOnBlank).toBeCloseTo(2 * a * Math.asin(100 / a), 3);
  });
});

describe("flange mass report", () => {
  it("cut length = outer + inner + holes", () => {
    const r = ringFlange.compute({ od: 500, id: 300, thk: 10, pcd: 420, holes: 8, holeDia: 18 }, SS);
    expect(r.mass!.actual.perimeter).toBeCloseTo(Math.PI * (500 + 300 + 8 * 18), 6);
    expect(r.dev!.pieces[0].holes).toHaveLength(9);
  });
});

describe("ring flange made from flat", () => {
  const base = { od: 412, id: 314, thk: 6 };

  it("finish is the same ring; process is the flat strip plus rolling allowance", () => {
    const sheet = ringFlange.compute(base, SS);
    const rolled = ringFlange.compute({ ...base, madeFrom: "flat", allowance: 120 }, SS);
    expect(rolled.finishWt).toBeCloseTo(sheet.finishWt, 9);
    const W = (412 - 314) / 2;
    const L = Math.PI * (412 + 314) / 2;
    expect(rolled.development!.flatWidth).toBe(W);
    expect(rolled.development!.flatLength).toBeCloseTo(L, 9);
    expect(rolled.processWt).toBeCloseTo(kgOf(W * (L + 120), 6), 9);
    expect(rolled.sheetL).toBeCloseTo(L + 120, 9);
    // Without allowance the strip is exactly the ring: no scrap.
    expect(ringFlange.compute({ ...base, madeFrom: "flat", allowance: 0 }, SS).scrap).toBeCloseTo(0, 9);
  });

  it("needs an ID", () => {
    expect(() => ringFlange.compute({ od: 400, thk: 6, madeFrom: "flat" }, SS)).toThrow(CalcError);
  });

  it("the allowance field only shows for 'from flat'", () => {
    const f = ringFlange.fields.find((x) => x.key === "allowance")!;
    expect(f.showIf!({ madeFrom: "flat" }, BUILT_IN_LIBRARY)).toBe(true);
    expect(f.showIf!({ madeFrom: "sheet" }, BUILT_IN_LIBRARY)).toBe(false);
  });
});
