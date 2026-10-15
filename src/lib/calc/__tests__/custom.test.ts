import { describe, expect, it } from "vitest";
import { makeCustomItemType, validateCustomShape, type CustomShapeDef } from "../custom";
import { FLANGE_CRICLE } from "./workbook-lambdas";

const ring: CustomShapeDef = {
  id: "ring",
  name: "My ring",
  inputs: [
    { key: "OD", label: "OD", unit: "mm" },
    { key: "ID", label: "ID", unit: "mm" },
    { key: "THK", label: "THK", unit: "mm" },
  ],
  finishFormula: "PI*(OD^2-ID^2)/4*THK*density/1e6",
  processFormula: "OD*OD*THK*density/1e6",
};

describe("custom shapes", () => {
  it("evaluates finish and process formulas", () => {
    const t = makeCustomItemType(ring);
    const r = t.compute({ OD: 500, ID: 300, THK: 10 }, { density: 7.85 });
    expect(r.finishWt).toBeCloseTo(FLANGE_CRICLE(500, 300, 10, 1, 7.85), 9);
    expect(r.processWt).toBeCloseTo((500 * 500 * 10 * 7.85) / 1e6, 9);
    expect(r.scrap).toBeCloseTo(r.processWt - r.finishWt, 9);
    expect(t.id).toBe("custom:ring");
  });

  it("process defaults to finish", () => {
    const t = makeCustomItemType({ ...ring, processFormula: undefined });
    const r = t.compute({ OD: 500, ID: 300, THK: 10 }, { density: 8 });
    expect(r.processWt).toBe(r.finishWt);
  });

  it("allows math functions like sqrt and sin", () => {
    const t = makeCustomItemType({
      id: "x", name: "x", inputs: [{ key: "A", label: "A" }],
      finishFormula: "sqrt(A) + sin(0)",
    });
    expect(t.compute({ A: 16 }, { density: 1 }).finishWt).toBe(4);
  });

  it("rejects unknown names, assignments and disabled functions", () => {
    expect(validateCustomShape({ ...ring, finishFormula: "OD*X" })).toEqual([
      'Finish formula: Unknown name "X" in formula',
    ]);
    expect(validateCustomShape({ ...ring, finishFormula: "a = 5" }).length).toBeGreaterThan(0);
    expect(validateCustomShape({ ...ring, finishFormula: "f(x) = x" }).length).toBeGreaterThan(0);
    const t = makeCustomItemType({ ...ring, finishFormula: 'evaluate("1+1")', processFormula: undefined });
    expect(() => t.compute({ OD: 1, ID: 0, THK: 1 }, { density: 1 })).toThrow();
  });

  it("rejects bad and reserved input names", () => {
    const errs = validateCustomShape({
      ...ring,
      inputs: [{ key: "density", label: "d" }, { key: "1x", label: "y" }],
      finishFormula: "1",
      processFormula: undefined,
    });
    expect(errs).toHaveLength(2);
  });

  it("requires a value for every input", () => {
    const t = makeCustomItemType(ring);
    expect(() => t.compute({ OD: 500, THK: 10 }, { density: 8 })).toThrow("ID is required");
  });
});
