import { describe, expect, it } from "vitest";
import { angleStd, angleTrue, beamH, beamI, channelStd, hexBar, pipeSch, sectionCustom, structural } from "../items/sections";
import { BUILT_IN_LIBRARY, libraryFromRows } from "../sections-lib";
import { CalcError } from "../types";

const MS = { density: 7.85 };

describe("rolled sections (IS 808)", () => {
  it("C, I and H pick up their table kg/m", () => {
    expect(channelStd.compute({ series: "ISLC", size: "150", length: 1000 }, MS).kgPerM).toBeCloseTo(14.4, 9);
    expect(beamI.compute({ series: "ISWB", size: "300", length: 2000 }, MS).finishWt).toBeCloseTo(96.2, 9);
    expect(beamH.compute({ series: "ISHB", size: "200 (37.3)", length: 1000 }, MS).finishWt).toBeCloseTo(37.3, 9);
    expect(angleStd.compute({ series: "ISA", size: "75x50x6", length: 1000 }, MS).finishWt).toBeCloseTo(5.6, 9);
  });

  it("each picker type only offers its own series", () => {
    const series = (t: typeof channelStd) => t.fields[0].dependentOptions!({}, BUILT_IN_LIBRARY).map((o) => o.value);
    expect(series(channelStd)).toEqual(["ISMC", "ISLC", "ISJC"]);
    expect(series(beamH)).toEqual(["ISHB"]);
    expect(series(beamI)).toEqual(expect.arrayContaining(["ISMB", "ISLB", "ISJB", "ISWB"]));
    expect(series(structural).length).toBeGreaterThanOrEqual(9);
  });

  it("custom I/H/C from dimensions", () => {
    // ISMB 200-like: D 200, B 100, tw 5.7, tf 10.8
    const r = sectionCustom.compute({ shape: "I", depth: 200, flange: 100, web: 5.7, flangeThk: 10.8, length: 1000 }, MS);
    const area = 2 * 100 * 10.8 + (200 - 21.6) * 5.7;
    expect(r.kgPerM).toBeCloseTo((area * 7.85) / 1000, 9);
    expect(() => sectionCustom.compute({ depth: 20, flange: 100, web: 5, flangeThk: 10, length: 1 }, MS)).toThrow(CalcError);
  });

  it("true-area angle and hex bar", () => {
    expect(angleTrue.compute({ a: 75, b: 50, thk: 6, length: 1000 }, MS).kgPerM).toBeCloseTo(((75 + 50 - 6) * 6 * 7.85) / 1000, 9);
    expect(hexBar.compute({ af: 30, length: 1000 }, MS).kgPerM).toBeCloseTo(((Math.sqrt(3) / 2) * 900 * 7.85) / 1000, 9);
  });
});

describe("section library from the database", () => {
  it("a size added in Settings is used, and an edited value wins", () => {
    const lib = libraryFromRows([
      { series: "ISMC", size: "100", data: { kgPerM: 9.6 } },
      { series: "MC", size: "250", data: { kgPerM: 30.6 } },
      { series: "PIPE-SCH-40", size: "65 NB", data: { nb: 65, od: 73, wall: 5.16 } },
      { series: "SWG", size: "12 SWG", data: { gauge: 12, thk: 2.642 } },
    ]);
    expect(channelStd.compute({ series: "ISMC", size: "100", length: 1000 }, { ...MS, lib }).finishWt).toBeCloseTo(9.6, 9);
    expect(structural.compute({ series: "MC", size: "250", length: 1000 }, { ...MS, lib }).finishWt).toBeCloseTo(30.6, 9);
    expect(pipeSch.compute({ sch: "40", nb: "65", length: 1000 }, { ...MS, lib }).kgPerM).toBeCloseTo((Math.PI * 5.16 * (73 - 5.16) * 7.85) / 1000, 9);
    expect(() => pipeSch.compute({ sch: "40", nb: "50", length: 1000 }, { ...MS, lib })).toThrow(CalcError);
  });
});
