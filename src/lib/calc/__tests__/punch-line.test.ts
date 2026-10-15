import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeItem, type ItemOutput } from "../costing";
import { buildRegistry } from "../registry";
import type { Material } from "../types";
import { GOLDEN_ROWS, type GoldenRow } from "./punch-line.fixture";

// The workbook's density column is 8 for every SS grade, SS202 included.
const WB_MATERIALS: Material[] = [{ code: "SS", density: 8, family: "SS" }];
const registry = buildRegistry();

function run(row: GoldenRow): ItemOutput {
  return computeItem(
    { id: `${row.tab}-${row.row}`, type: row.type, name: row.name, qty: row.qty, inputs: row.inputs },
    { type: registry.get(row.type), material: "SS", materials: WB_MATERIALS, burningPct: 0, multiplier: row.qty, rate: undefined },
  );
}

describe("Punch Line System workbook (golden rows)", () => {
  for (const row of GOLDEN_ROWS) {
    it(`${row.tab} row ${row.row}: ${row.name} [${row.status}]`, () => {
      const out = run(row);
      expect(out.error).toBeUndefined();
      if (row.status === "match" || row.status === "check") {
        if (row.wb?.process !== undefined) expect(out.processWt).toBeCloseTo(row.wb.process, 6);
        if (row.wb?.finish !== undefined) expect(out.finishWt).toBeCloseTo(row.wb.finish, 6);
      }
      if (row.status === "fixed") {
        expect(out.finishWt).not.toBeCloseTo(row.wb!.finish!, 2);
      }
      if (row.status === "missing") expect(out.processWt).toBeGreaterThan(0);
      if (row.status === "bought") expect(out.unit?.costedByWeight).toBe(false);
    });
  }

  it("fixed flange: hole subtracted", () => {
    const out = run(GOLDEN_ROWS.find((r) => r.tab === "Pickup Hopper" && r.row === 27)!);
    expect(out.finishWt).toBeCloseTo((Math.PI * (280 ** 2 - 171 ** 2) / 4) * 10 * 8 / 1e6, 9);
  });
});

// Set WRITE_REPORT=<path> to write the comparison table as Markdown.
const reportPath = process.env.WRITE_REPORT;
describe.runIf(Boolean(reportPath))("comparison report", () => {
  it("writes the report", () => {
    const n = (v: number | undefined) => (v === undefined ? "–" : v.toFixed(3));
    const lines = [
      "| Tab | Row | Item | Qty | Workbook process | Workbook finish | App process | App finish | Status | Note |",
      "|---|---|---|---|---|---|---|---|---|---|",
    ];
    for (const row of GOLDEN_ROWS) {
      const out = run(row);
      const bought = row.status === "bought";
      lines.push(
        `| ${row.tab} | ${row.row} | ${row.name} | ${row.qty} | ${n(row.wb?.process)} | ${n(row.wb?.finish)} | ` +
          `${bought ? "–" : n(out.processWt)} | ${bought ? "–" : n(out.finishWt)} | ${row.status} | ${row.note ?? ""} |`,
      );
    }
    writeFileSync(reportPath!, lines.join("\n") + "\n", "utf8");
  });
});
