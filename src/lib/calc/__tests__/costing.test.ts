import { describe, expect, it } from "vitest";
import { computeCosting, defaultChargeLines, sizeRateRows, type CostingInput } from "../costing";
import { DEFAULT_MATERIALS } from "../materials";

function baseCosting(): CostingInput {
  const lines = defaultChargeLines();
  lines.find((l) => l.id === "labour-ss")!.rate = 85;
  lines.find((l) => l.id === "labour-ms")!.rate = 25;
  return {
    defaultMaterial: "MS",
    burningPct: 3,
    profitPct: 10,
    materials: DEFAULT_MATERIALS,
    rates: {
      MS: { rate: 60, scrapRate: 26 },
      SS304: { rate: 220, scrapRate: 110 },
      SS316: { rate: 300, scrapRate: 210 },
    },
    chargeLines: lines,
    drawings: [
      {
        id: "d1",
        drawingNo: "2600121050-01",
        title: "Bag filter",
        items: [
          { id: "i1", type: "plate", name: "Base plate", qty: 1, inputs: { length: 1000, width: 1000, thk: 10 } },
          { id: "i2", type: "disc", name: "Blank", qty: 1, material: "SS304", inputs: { dia: 500, thk: 5 } },
          { id: "i3", type: "bought-misc", name: "Hose clamp", qty: 4, inputs: { rate: 150 } },
        ],
      },
    ],
  };
}

describe("costing engine", () => {
  it("reproduces the workbook cost block, with burning added", () => {
    const out = computeCosting(baseCosting());
    const d = out.drawings[0];
    const ms = d.byMaterial.find((t) => t.material === "MS")!;
    const ss = d.byMaterial.find((t) => t.material === "SS304")!;

    // MS plate: 1000×1000×10 → 78.5 kg, no scrap.
    expect(ms.process).toBeCloseTo(78.5, 9);
    expect(ms.burning).toBeCloseTo(2.355, 9);
    expect(ms.net).toBeCloseTo((78.5 + 2.355) * 60, 9);

    // SS disc Ø500×5: finish π/4·0.25·5·8 = 7.854 kg, process 10 kg.
    const ssFinish = (Math.PI * 500 * 500 / 4) * 5 * 8 / 1e6;
    expect(ss.finish).toBeCloseTo(ssFinish, 9);
    expect(ss.process).toBeCloseTo(10, 9);
    expect(ss.scrap).toBeCloseTo(10 - ssFinish, 9);
    expect(ss.net).toBeCloseTo(10.3 * 220 - (10 - ssFinish) * 110, 9);

    const labourSS = d.charges.find((c) => c.line.id === "labour-ss")!;
    const labourMS = d.charges.find((c) => c.line.id === "labour-ms")!;
    expect(labourSS.amount).toBeCloseTo(ssFinish * 85, 9);
    expect(labourMS.amount).toBeCloseTo(78.5 * 25, 9);

    expect(d.boughtTotal).toBe(600);
    expect(d.total).toBeCloseTo(ms.net + ss.net + labourSS.amount + labourMS.amount + 600, 9);
    expect(out.subtotal).toBeCloseTo(d.total, 9);
    expect(out.profit).toBeCloseTo(d.total * 0.1, 9);
    expect(out.grandTotal).toBeCloseTo(d.total * 1.1, 9);
  });

  it("blank charge rates count as zero", () => {
    const out = computeCosting(baseCosting());
    const painting = out.drawings[0].charges.find((c) => c.line.id === "painting")!;
    expect(painting.weight).toBeCloseTo(78.5, 9);
    expect(painting.amount).toBe(0);
  });

  it("process-basis and single-material charge lines", () => {
    const c = baseCosting();
    c.chargeLines = [{ id: "x", name: "Burning job", rate: 5, basis: "process", appliesTo: "MAT:SS304" }];
    const d = computeCosting(c).drawings[0];
    expect(d.charges[0].weight).toBeCloseTo(10, 9);
    expect(d.charges[0].amount).toBeCloseTo(50, 9);
  });

  it("assembly quantity multiplies its items; overrides cascade", () => {
    const c = baseCosting();
    c.drawings[0].assemblies = [{ id: "a1", name: "Cyclone assembly", qty: 2, material: "SS316" }];
    c.drawings[0].items[0].assemblyId = "a1";
    c.drawings[0].burningPct = 0;
    const d = computeCosting(c).drawings[0];
    const plate = d.items[0];
    expect(plate.material).toBe("SS316");
    expect(plate.multiplier).toBe(2);
    expect(plate.processWt).toBeCloseTo(2 * 80, 9); // 1000×1000×10×8 = 80 kg each
    expect(plate.burning).toBe(0);
  });

  it("item errors are reported and contribute nothing", () => {
    const c = baseCosting();
    c.drawings[0].items.push({ id: "bad", type: "ring-flange", name: "Bad", qty: 1, inputs: { od: 100, id: 200, thk: 5 } });
    c.drawings[0].items.push({ id: "bad2", type: "plate", name: "Bad mat", qty: 1, material: "XYZ", inputs: { length: 1, width: 1, thk: 1 } });
    const d = computeCosting(c).drawings[0];
    expect(d.items[3].error).toMatch(/ID must be smaller/);
    expect(d.items[4].error).toMatch(/Unknown material/);
    expect(d.total).toBeCloseTo(computeCosting(baseCosting()).drawings[0].total, 9);
  });

  it("SS202 is supported and counts as SS for SS charge lines", () => {
    const c = baseCosting();
    c.drawings[0].items = [
      { id: "s", type: "plate", name: "SS202 plate", qty: 1, material: "SS202", inputs: { length: 1000, width: 1000, thk: 1 } },
    ];
    const d = computeCosting(c).drawings[0];
    expect(d.byMaterial[0].finish).toBeCloseTo(8, 9);
    expect(d.charges.find((x) => x.line.id === "labour-ss")!.amount).toBeCloseTo(8 * 85, 9);
  });

  it("outsourced dished end: material by weight plus job work", () => {
    const c = baseCosting();
    c.drawings[0].items = [
      { id: "de", type: "dished-end", name: "Top dish", qty: 2, material: "SS304", inputs: { od: 1000, thk: 6, dishType: "torispherical", jobWork: 3500 } },
    ];
    const d = computeCosting(c).drawings[0];
    expect(d.boughtTotal).toBe(7000);
    expect(d.byMaterial[0].material).toBe("SS304");
    expect(d.byMaterial[0].process).toBeCloseTo(2 * 1090 * 1090 * 6 * 8 / 1e6, 9);
  });

  it("totals across drawings", () => {
    const c = baseCosting();
    c.drawings.push({ ...c.drawings[0], id: "d2", drawingNo: "02" });
    const out = computeCosting(c);
    expect(out.subtotal).toBeCloseTo(2 * out.drawings[0].total, 9);
    expect(out.byMaterial.find((t) => t.material === "MS")!.process).toBeCloseTo(157, 9);
  });
});

describe("size-wise rates", () => {
  function pipes(): CostingInput {
    return {
      defaultMaterial: "SS304",
      burningPct: 3,
      profitPct: 0,
      materials: DEFAULT_MATERIALS,
      rates: { SS304: { rate: 220, scrapRate: 110 } },
      chargeLines: [],
      drawings: [
        {
          id: "d",
          drawingNo: "P-01",
          title: "Pipes",
          items: [
            { id: "a", type: "pipe-sch", name: "50 NB", qty: 2, inputs: { sch: "10S", nb: "50", length: 3000 } },
            { id: "b", type: "pipe-sch", name: "50 NB again", qty: 1, inputs: { sch: "10S", nb: "50", length: 1000 } },
            { id: "c", type: "pipe-sch", name: "25 NB", qty: 1, inputs: { sch: "10S", nb: "25", length: 1000 } },
          ],
        },
      ],
    };
  }

  it("blank size rate falls back to the material rate", () => {
    const out = computeCosting(pipes());
    const it = out.drawings[0].items[0];
    expect(it.sizeKey).toBe("SS304|Pipe 50 NB SCH 10S");
    expect(it.pricedBy).toBe("material");
    expect(it.materialAmount).toBeCloseTo(it.processWt * 1.03 * 220, 9);
  });

  it("₹/m, ₹/kg and ₹/piece; different sizes get different rates", () => {
    const c = pipes();
    c.sizeRates = { "SS304|Pipe 50 NB SCH 10S": { rate: 900, unit: "m" }, "SS304|Pipe 25 NB SCH 10S": { rate: 400, unit: "kg" } };
    const items = computeCosting(c).drawings[0].items;
    expect(items[0].materialAmount).toBeCloseTo(6 * 900, 9); // 2 × 3 m
    expect(items[1].materialAmount).toBeCloseTo(1 * 900, 9);
    expect(items[2].materialAmount).toBeCloseTo(items[2].processWt * 1.03 * 400, 9);
    c.sizeRates["SS304|Pipe 50 NB SCH 10S"] = { rate: 2500, unit: "piece" };
    expect(computeCosting(c).drawings[0].items[0].materialAmount).toBeCloseTo(2 * 2500, 9);
  });

  it("rate chart rows group by size across items", () => {
    const rows = sizeRateRows(computeCosting(pipes()));
    expect(rows.map((r) => r.label)).toEqual(["Pipe 25 NB SCH 10S", "Pipe 50 NB SCH 10S"]);
    const p50 = rows[1];
    expect(p50.m).toBeCloseTo(7, 9);
    expect(p50.pieces).toBe(3);
    expect(p50.drawings).toEqual(["P-01"]);
  });

  it("drawing material total uses the size rate", () => {
    const c = pipes();
    c.sizeRates = { "SS304|Pipe 50 NB SCH 10S": { rate: 900, unit: "m" } };
    const d = computeCosting(c).drawings[0];
    expect(d.materialTotal).toBeCloseTo(7 * 900 + d.items[2].materialAmount, 9);
  });
});
