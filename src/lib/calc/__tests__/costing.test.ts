import { describe, expect, it } from "vitest";
import { computeCosting, defaultChargeLines, type CostingInput } from "../costing";
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

describe("pricing page rates", () => {
  const SS = "SS304";
  function base(): CostingInput {
    return {
      defaultMaterial: SS,
      burningPct: 3,
      profitPct: 0,
      materials: DEFAULT_MATERIALS,
      rates: { SS304: { rate: 220, scrapRate: 110 } },
      chargeLines: [],
      drawings: [
        {
          id: "d",
          drawingNo: "P-01",
          title: "Mixed",
          items: [
            { id: "a", type: "pipe-sch", name: "50 NB", qty: 2, inputs: { sch: "10S", nb: "50", length: 3000 } },
            { id: "b", type: "pipe-sch", name: "50 NB again", qty: 1, inputs: { sch: "10S", nb: "50", length: 1000 } },
            { id: "c", type: "pipe-sch", name: "25 NB", qty: 1, inputs: { sch: "10S", nb: "25", length: 1000 } },
            { id: "p3", type: "plate", name: "PLATE 3", qty: 1, inputs: { length: 1000, width: 1000, thk: 3 } },
            { id: "p6", type: "plate", name: "PLATE 6", qty: 1, inputs: { length: 1000, width: 1000, thk: 6 } },
            { id: "s1", type: "bought", name: "STUBEND LONG", qty: 4, inputs: { kind: "Stub end", nb: "50", stub: "Long", rating: "SCH 10S" } },
            { id: "s2", type: "bought", name: "Long stub end", qty: 2, inputs: { kind: "Stub end", nb: "50", stub: "Long", rating: "SCH 10S" } },
            { id: "h", type: "bought", name: "HOSE", qty: 3, inputs: { kind: "Hose", nb: "20", pieceLength: 1500 } },
            { id: "dish", type: "dish-tori", name: "TOP DISH", qty: 2, inputs: { dia: 800, diaRef: "OD", crown: 800, knuckle: 80, thk: 5 } },
          ],
        },
      ],
    };
  }

  it("blank size rate falls back to the material rate", () => {
    const out = computeCosting(base());
    const it = out.drawings[0].items[0];
    expect(it.price?.key).toBe("size|SS304|Pipe 50 NB SCH 10S");
    expect(it.pricedBy).toBe("material");
    expect(it.materialAmount).toBeCloseTo(it.processWt * 1.03 * 220, 9);
  });

  it("₹/m, ₹/kg and ₹/piece for sizes", () => {
    const c = base();
    c.prices = { "size|SS304|Pipe 50 NB SCH 10S": { rate: 900, unit: "m" }, "size|SS304|Pipe 25 NB SCH 10S": { rate: 400, unit: "kg" } };
    const items = computeCosting(c).drawings[0].items;
    expect(items[0].materialAmount).toBeCloseTo(6 * 900, 9);
    expect(items[1].materialAmount).toBeCloseTo(900, 9);
    expect(items[2].materialAmount).toBeCloseTo(items[2].processWt * 1.03 * 400, 9);
    c.prices["size|SS304|Pipe 50 NB SCH 10S"] = { rate: 2500, unit: "piece" };
    expect(computeCosting(c).drawings[0].items[0].materialAmount).toBeCloseTo(2 * 2500, 9);
  });

  it("plate rates by thickness; blank thickness uses the material rate", () => {
    const c = base();
    c.prices = { "plate|SS304|6 mm": { rate: 260, unit: "kg" } };
    const items = computeCosting(c).drawings[0].items;
    const p3 = items.find((i) => i.item.id === "p3")!;
    const p6 = items.find((i) => i.item.id === "p6")!;
    expect(p3.price?.key).toBe("plate|SS304|3 mm");
    expect(p3.materialAmount).toBeCloseTo(p3.processWt * 1.03 * 220, 9);
    expect(p6.materialAmount).toBeCloseTo(p6.processWt * 1.03 * 260, 9);
  });

  it("bought-outs: the same stub end written two ways is one row; hose priced per metre", () => {
    const c = base();
    const out = computeCosting(c);
    const stub = out.prices.filter((r) => r.group === "bought" && r.label.startsWith("Stub end"));
    expect(stub).toHaveLength(1);
    expect(stub[0].label).toBe("Stub end 50 NB Long SCH 10S");
    expect(stub[0].pieces).toBe(6);
    expect(stub[0].missing).toBe(true);
    c.prices = {
      "bought|SS304|Stub end 50 NB Long SCH 10S": { rate: 450, unit: "piece" },
      "bought|SS304|Hose 20 NB": { rate: 300, unit: "m" },
    };
    const d = computeCosting(c).drawings[0];
    expect(d.items.find((i) => i.item.id === "s1")!.fixedAmount).toBe(1800);
    expect(d.items.find((i) => i.item.id === "h")!.fixedAmount).toBeCloseTo(3 * 1.5 * 300, 9);
    // Price only: bought items never add to material weight or labour.
    expect(d.byMaterial.find((t) => t.material === "SS304")!.finish).toBeCloseTo(
      d.items.filter((i) => i.unit?.costedByWeight).reduce((a, i) => a + i.finishWt, 0),
      9,
    );
  });

  it("dish job work is priced per dish size; 0 means free, blank is missing", () => {
    const c = base();
    let out = computeCosting(c);
    const job = out.prices.find((r) => r.group === "jobwork")!;
    expect(job.label).toBe("Torispherical dish forming – D 800 OD × 5");
    expect(out.missing.map((m) => m.label)).toContain(`SS304 · ${job.label}`);
    c.prices = { [job.key]: { rate: 0, unit: "piece" } };
    out = computeCosting(c);
    expect(out.missing.map((m) => m.label)).not.toContain(`SS304 · ${job.label}`);
    c.prices = { [job.key]: { rate: 3500, unit: "piece" } };
    expect(computeCosting(c).drawings[0].boughtTotal).toBeCloseTo(7000, 9);
  });

  it("missing list: material rate, bought-outs, and charge lines that apply", () => {
    const c = base();
    c.rates = {};
    c.chargeLines = [{ id: "l", name: "Labour – SS", rate: null, basis: "finish", appliesTo: "SS" }];
    const labels = computeCosting(c).missing.map((m) => m.label);
    expect(labels).toContain("SS304 rate (₹/kg)");
    expect(labels).toContain("Labour – SS");
    expect(labels.some((l) => l.includes("Stub end"))).toBe(true);
  });
});
