import { describe, expect, it } from "vitest";
import { bentPlate, disc, flat, plate, rectFlange, ringFlange } from "../items/sheet";
import { cone, fanBoundingBox, shell } from "../items/round";
import { pyramidHopper, rectDuct } from "../items/panels";
import { angleCustom, pipeCustom, pipeSch, pipeSwg, rectTube, roundBar, structural } from "../items/sections";
import { boughtMisc, dishedEnd } from "../items/bought";
import { CalcError } from "../types";
import * as WB from "./workbook-lambdas";

const MS = { density: 7.85 };
const SS = { density: 8 };

describe("sheet items match the workbook LAMBDAs", () => {
  it("plate = SHEET_OR_PLATE", () => {
    const r = plate.compute({ length: 1250, width: 2500, thk: 6 }, MS);
    expect(r.finishWt).toBeCloseTo(WB.SHEET_OR_PLATE(1250, 2500, 6, 1, 7.85), 9);
    expect(r.processWt).toBe(r.finishWt);
    expect(r.scrap).toBe(0);
  });

  it("disc: finish = CIRCLE_SHEET, process = square blank", () => {
    const r = disc.compute({ dia: 600, thk: 5 }, SS);
    expect(r.finishWt).toBeCloseTo(WB.CIRCLE_SHEET(600, 5, 1, 8), 9);
    expect(r.processWt).toBeCloseTo(WB.SHEET_OR_PLATE(600, 600, 5, 1, 8), 9);
    expect(r.scrap).toBeCloseTo(r.processWt - r.finishWt, 9);
    expect([r.sheetL, r.sheetW]).toEqual([600, 600]);
  });

  it("ring flange = FLANGE_CRICLE, minus holes", () => {
    const r = ringFlange.compute({ od: 500, id: 400, thk: 10 }, MS);
    expect(r.finishWt).toBeCloseTo(WB.FLANGE_CRICLE(500, 400, 10, 1, 7.85), 9);
    expect(r.processWt).toBeCloseTo(WB.SHEET_OR_PLATE(500, 500, 10, 1, 7.85), 9);
    const withHoles = ringFlange.compute({ od: 500, id: 400, thk: 10, holes: 8, holeDia: 18 }, MS);
    expect(r.finishWt - withHoles.finishWt).toBeCloseTo(WB.CIRCLE_SHEET(18, 10, 8, 7.85), 9);
  });

  it("ring flange rejects ID >= OD", () => {
    expect(() => ringFlange.compute({ od: 400, id: 400, thk: 10 }, MS)).toThrow(CalcError);
  });

  it("rect flange = outer − inner, made from strips: no scrap", () => {
    const r = rectFlange.compute({ length: 600, width: 400, innerL: 500, innerW: 300, thk: 8 }, MS);
    expect(r.finishWt).toBeCloseTo(
      WB.FLANGE_SQUARE(600, 400, 8, 1, 7.85) - WB.FLANGE_SQUARE(500, 300, 8, 1, 7.85), 9);
    expect(r.finishWt).toBeCloseTo(5.652, 9);
    expect(r.processWt).toBeCloseTo(r.finishWt, 9);
    const pieces = r.mass!.pieces.map((p) => [p.count, p.frameW, p.frameH]);
    expect(pieces).toEqual([[2, 600, 50], [2, 300, 50]]);
  });

  it("rect flange with unequal strip widths", () => {
    const r = rectFlange.compute({ length: 700, width: 400, innerL: 500, innerW: 300, thk: 6 }, MS);
    expect(r.mass!.pieces.map((p) => [p.count, p.frameW, p.frameH])).toEqual([[2, 700, 50], [2, 300, 100]]);
    expect(r.processWt).toBeCloseTo(r.finishWt, 9);
  });

  it("rect flange without opening is a plain plate", () => {
    const r = rectFlange.compute({ length: 600, width: 400, thk: 8 }, MS);
    expect(r.finishWt).toBeCloseTo(WB.FLANGE_SQUARE(600, 400, 8, 1, 7.85), 9);
    expect(r.processWt).toBeCloseTo(r.finishWt, 9);
  });

  it("bent plate = girth × length", () => {
    const r = bentPlate.compute({ girth: 300, length: 2000, thk: 3 }, SS);
    expect(r.finishWt).toBeCloseTo(WB.SHEET_OR_PLATE(300, 2000, 3, 1, 8), 9);
  });
});

describe("shell", () => {
  it("OD-given shell equals PIPE()", () => {
    const r = shell.compute({ dia: 1000, diaRef: "OD", height: 1500, thk: 5 }, SS);
    expect(r.finishWt).toBeCloseTo(WB.PIPE(1000, 1500, 5, 1, 8), 9);
    expect(r.development?.Dm).toBe(995);
    expect(r.sheetL).toBeCloseTo(Math.PI * 995, 6);
    expect(r.sheetW).toBe(1500);
  });

  it("ID-given shell uses Dm = ID + t", () => {
    const r = shell.compute({ dia: 1000, diaRef: "ID", height: 1000, thk: 6 }, MS);
    expect(r.development?.Dm).toBe(1006);
    expect(r.finishWt).toBeCloseTo(WB.PIPE(1012, 1000, 6, 1, 7.85), 9);
  });
});

describe("concentric cone", () => {
  const r = cone.compute({ d1: 1000, d2: 300, diaRef: "OD", height: 800, thk: 5 }, SS);
  const d = r.development!;

  it("development geometry", () => {
    expect(d.Rb).toBe(497.5);
    expect(d.R1).toBeCloseTo(d.slant, 9);
    expect(d.R1 - d.R2).toBeCloseTo(Math.hypot(800, 350), 9);
    // Outer arc length equals the mean circumference of the large end.
    expect((Math.PI * d.R1 * d.theta) / 180).toBeCloseTo(Math.PI * 995, 6);
    expect((Math.PI * d.R2 * d.theta) / 180).toBeCloseTo(Math.PI * 295, 6);
  });

  it("finish weight = CONE_FULCRUM_ARC = frustum lateral area", () => {
    expect(r.finishWt).toBeCloseTo(WB.CONE_FULCRUM_ARC(d.theta, d.R1, d.R2, 5, 1, 8), 9);
    const lateral = Math.PI * ((995 + 295) / 2) * (d.R1 - d.R2);
    expect(r.finishWt).toBeCloseTo((lateral * 5 * 8) / 1e6, 9);
  });

  it("process >= finish, sheet is the fan bounding box", () => {
    expect(r.processWt).toBeGreaterThan(r.finishWt);
    expect(r.sheetL! * r.sheetW! * 5 * 8 / 1e6).toBeCloseTo(r.processWt, 9);
  });

  it("swaps D1/D2 if entered the other way round", () => {
    const s = cone.compute({ d1: 300, d2: 1000, diaRef: "OD", height: 800, thk: 5 }, SS);
    expect(s.finishWt).toBeCloseTo(r.finishWt, 9);
  });

  it("rejects equal diameters", () => {
    expect(() => cone.compute({ d1: 500, d2: 500, height: 100, thk: 3 }, SS)).toThrow(CalcError);
  });
});

describe("fan bounding box", () => {
  it("θ = 90°", () => {
    const b = fanBoundingBox(100, 50, 90);
    expect(b.width).toBeCloseTo(200 * Math.sin(Math.PI / 4), 9);
    expect(b.height).toBeCloseTo(100 - 50 * Math.cos(Math.PI / 4), 9);
  });
  it("θ = 270°", () => {
    const b = fanBoundingBox(100, 50, 270);
    expect(b.width).toBeCloseTo(200, 9);
    expect(b.height).toBeCloseTo(100 + 100 * Math.cos(Math.PI / 4), 9);
  });
});

describe("panel shapes", () => {
  it("square pyramid hopper", () => {
    const r = pyramidHopper.compute({ topL: 1000, topW: 1000, botL: 200, botW: 200, height: 400, thk: 4 }, MS);
    const h = Math.hypot(400, 400);
    expect(r.dev!.pieces).toHaveLength(2);
    expect(r.development!.hA).toBeCloseTo(h, 9);
    expect(r.finishWt).toBeCloseTo((4 * ((1000 + 200) / 2) * h * 4 * 7.85) / 1e6, 9);
    expect(r.processWt).toBeCloseTo((4 * 1000 * h * 4 * 7.85) / 1e6, 9);
  });

  it("duct with open ends", () => {
    const r = rectDuct.compute({ length: 2000, width: 500, height: 300, thk: 3 }, MS);
    expect(r.finishWt).toBeCloseTo((2 * (2000 * 500 + 2000 * 300) * 3 * 7.85) / 1e6, 9);
    expect(r.scrap).toBe(0);
  });

  it("open-top box", () => {
    const r = rectDuct.compute({ length: 1000, width: 500, height: 400, thk: 3, top: false, left: true, right: true }, MS);
    const area = 1000 * 500 + 2 * 1000 * 400 + 2 * 500 * 400;
    expect(r.finishWt).toBeCloseTo((area * 3 * 7.85) / 1e6, 9);
  });
});

describe("sections (cut length, no scrap)", () => {
  it("custom pipe = PIPE()", () => {
    const r = pipeCustom.compute({ od: 101.6, thk: 3.251, length: 2400 }, SS);
    expect(r.finishWt).toBeCloseTo(WB.PIPE(101.6, 2400, 3.251, 1, 8), 9);
    expect(r.processWt).toBe(r.finishWt);
    expect(r.scrap).toBe(0);
  });

  it("101.6 OD 10 SWG", () => {
    const r = pipeSwg.compute({ od: 101.6, swg: "10", length: 1000 }, SS);
    expect(r.finishWt).toBeCloseTo(WB.PIPE(101.6, 1000, 3.251, 1, 8), 9);
  });

  it("50 NB SCH 40 MS ≈ 5.44 kg/m", () => {
    const r = pipeSch.compute({ nb: "50", sch: "40", length: 1000 }, MS);
    expect(r.kgPerM).toBeCloseTo(5.44, 1);
  });

  it("round bar = ROD(), angle custom = ANGLE()", () => {
    expect(roundBar.compute({ dia: 25, length: 500 }, MS).finishWt).toBeCloseTo(WB.ROD(25, 500, 7.85, 1), 9);
    expect(angleCustom.compute({ width: 50, thk: 6, length: 1200 }, MS).finishWt).toBeCloseTo(
      WB.ANGLE(1200, 50, 6, 1, 7.85), 9);
  });

  it("flat", () => {
    expect(flat.compute({ width: 50, thk: 10, length: 1000 }, MS).finishWt).toBeCloseTo(3.925, 9);
  });

  it("rect tube: std kg/m override wins", () => {
    const r = rectTube.compute({ a: 150, b: 150, thk: 5, kgPerM: 22.3, length: 3000 }, MS);
    expect(r.finishWt).toBeCloseTo(66.9, 9);
    const c = rectTube.compute({ a: 150, b: 150, thk: 5, length: 1000 }, MS);
    expect(c.kgPerM).toBeCloseTo((2 * 5 * 290 * 7.85) / 1000, 9);
  });

  it("structural scales MS kg/m by density", () => {
    const ms = structural.compute({ series: "ISMC", size: "100", length: 1000 }, MS);
    expect(ms.finishWt).toBeCloseTo(9.2, 9);
    const ss = structural.compute({ series: "ISMC", size: "100", length: 1000 }, SS);
    expect(ss.finishWt).toBeCloseTo((9.2 * 8) / 7.85, 9);
  });
});

describe("bought and outsourced", () => {
  it("bought item: fixed cost, not costed by weight", () => {
    const r = boughtMisc.compute({ description: "Hose clamp", rate: 45, weight: 0.1 }, MS);
    expect(r.fixedCost).toBe(45);
    expect(r.costedByWeight).toBe(false);
  });

  it("torispherical dish blank ≈ 1.09 × OD + 2 SF; square blank = process", () => {
    const r = dishedEnd.compute({ od: 1000, thk: 6, dishType: "torispherical", sf: 40, jobWork: 3500 }, SS);
    expect(r.development?.blankDia).toBeCloseTo(1170, 9);
    expect(r.processWt).toBeCloseTo(WB.SHEET_OR_PLATE(1170, 1170, 6, 1, 8), 9);
    expect(r.finishWt).toBeCloseTo(WB.CIRCLE_SHEET(1170, 6, 1, 8), 9);
    expect(r.fixedCost).toBe(3500);
    expect(r.costedByWeight).toBe(true);
  });
});
