import { describe, expect, it } from "vitest";
import { computeCosting, defaultChargeLines, type CostingInput } from "../costing";
import { DEFAULT_MATERIALS } from "../materials";
import { rawMaterialList, type RmGroup } from "../raw-material";

function costing(): CostingInput {
  return {
    defaultMaterial: "SS304",
    burningPct: 3,
    profitPct: 10,
    materials: DEFAULT_MATERIALS,
    rates: { SS304: { rate: 220, scrapRate: 110 }, MS: { rate: null, scrapRate: null } },
    chargeLines: defaultChargeLines(),
    prices: { "bought|SS304|Hose 20 NB": { rate: 300, unit: "m" } },
    drawings: [
      {
        id: "d1",
        drawingNo: "P-01",
        title: "Hopper",
        assemblies: [{ id: "a1", name: "Frame", qty: 2, material: "MS" }],
        items: [
          { id: "p3", itemNo: "1", type: "plate", name: "Side plate", qty: 2, inputs: { length: 1200, width: 600, thk: 3 } },
          { id: "p10", itemNo: "2", type: "plate", name: "Base plate", qty: 1, inputs: { length: 500, width: 800, thk: 10 } },
          { id: "chq", itemNo: "3", type: "plate", name: "Chequered", qty: 1, inputs: { length: 2000, width: 1000, thk: 4, thkAllowance: 0.5 } },
          { id: "p4", itemNo: "4", type: "plate", name: "Cover", qty: 1, inputs: { length: 500, width: 500, thk: 4 } },
          { id: "pipe", itemNo: "5", type: "pipe-sch", name: "Pipe", qty: 2, inputs: { sch: "10S", nb: "50", length: 3000 } },
          { id: "flat", itemNo: "6", type: "flat", name: "Flat", qty: 2, inputs: { width: 50, thk: 6, length: 1000 } },
          { id: "ring", itemNo: "7", type: "ring-flange", name: "Ring", qty: 1, inputs: { madeFrom: "flat", od: 300, id: 200, thk: 6, allowance: 100 } },
          { id: "ang", itemNo: "8", type: "angle-true", name: "Angle", qty: 4, inputs: { a: 50, b: 50, thk: 6, length: 800 } },
          { id: "bolt", itemNo: "9", type: "bought", name: "Bolt", qty: 8, inputs: { kind: "Hex bolt", thread: "M12", len: 50 } },
          { id: "nbw", itemNo: "10", type: "bought", name: "NBW", qty: 6, inputs: { kind: "Nut-bolt-washer set", thread: "M16", len: 60 } },
          { id: "stub", itemNo: "11", type: "bought", name: "Stub end", qty: 2, inputs: { kind: "Stub end", nb: "50", stub: "Long", rating: "SCH 10S" } },
          { id: "hose", itemNo: "12", type: "bought", name: "Hose", qty: 3, inputs: { kind: "Hose", nb: "20", pieceLength: 1500 } },
          { id: "dish", itemNo: "13", type: "dish-tori", name: "Top dish", qty: 2, inputs: { dia: 800, diaRef: "OD", crown: 800, knuckle: 80, thk: 5 } },
          { id: "dishf", itemNo: "14", type: "dished-end", name: "Bottom dish", qty: 1, inputs: { od: 1000, thk: 5, dishType: "torispherical" } },
          { id: "f1", itemNo: "1", type: "plate", name: "Frame plate", qty: 3, assemblyId: "a1", inputs: { length: 500, width: 400, thk: 10 } },
          { id: "bad", itemNo: "15", type: "ring-flange", name: "Bad", qty: 1, inputs: { od: 100, id: 200, thk: 5 } },
        ],
      },
      {
        id: "d2",
        drawingNo: "P-02",
        title: "Support",
        items: [
          { id: "pipe2", itemNo: "1", type: "pipe-sch", name: "Pipe", qty: 1, inputs: { sch: "10S", nb: "50", length: 4500 } },
          { id: "p3b", itemNo: "2", type: "plate", name: "Gusset", qty: 4, inputs: { length: 200, width: 150, thk: 3 } },
          { id: "clamp", itemNo: "3", type: "bought-misc", name: "Hose clamp", qty: 4, inputs: { rate: 150 } },
          { id: "o1", itemNo: "4", type: "bought", name: "Bolt", qty: 10, inputs: { kind: "Other", desc: "Hex hd bolt M10x25" } },
          { id: "o2", itemNo: "5", type: "bought", name: "Lock nut", qty: 5, inputs: { kind: "Other", desc: "Nylo lock nut M8" } },
          { id: "o3", itemNo: "6", type: "bought", name: "Wheel", qty: 2, inputs: { kind: "Other", desc: "Wheel" } },
          { id: "rf1", itemNo: "7", type: "rect-flange", name: "Frame", qty: 1, inputs: { madeFrom: "flat", length: 600, width: 400, innerL: 500, innerW: 300, thk: 8 } },
          { id: "rf2", itemNo: "8", type: "rect-flange", name: "Frame", qty: 2, inputs: { madeFrom: "flat", length: 700, width: 400, innerL: 500, innerW: 300, thk: 8 } },
          { id: "rf3", itemNo: "9", type: "rect-flange", name: "Frame", qty: 1, inputs: { length: 600, width: 400, innerL: 500, innerW: 300, thk: 8 } },
        ],
      },
    ],
  };
}

const WEIGHED: RmGroup[] = ["sheet", "pipe", "flat", "section", "other"];

describe("raw material list", () => {
  const input = costing();
  const out = computeCosting(input);
  const list = rawMaterialList(input, out);
  const find = (group: RmGroup, material: string, label: string) => {
    const r = list.rows.find((x) => x.group === group && x.material === material && x.label === label);
    if (!r) throw new Error(`No row ${group}|${material}|${label}; have ${list.rows.map((x) => x.key).join(", ")}`);
    return r;
  };

  it("totals equal the costing's process and burning weights", () => {
    const weighed = list.rows.filter((r) => WEIGHED.includes(r.group));
    const process = out.byMaterial.reduce((a, t) => a + t.process, 0);
    const burning = out.byMaterial.reduce((a, t) => a + t.burning, 0);
    expect(weighed.reduce((a, r) => a + r.processKg, 0)).toBeCloseTo(process, 9);
    expect(weighed.reduce((a, r) => a + r.burningKg, 0)).toBeCloseTo(burning, 9);
    for (const r of weighed) {
      expect(r.buyKg).toBeCloseTo(r.processKg + r.burningKg, 9);
      expect(r.lines.reduce((a, l) => a + l.kg, 0)).toBeCloseTo(r.processKg, 9);
    }
  });

  it("groups sheets by material and thickness, with a piece list", () => {
    const s3 = find("sheet", "SS304", "3 mm");
    expect(s3.drawings).toEqual(["P-01", "P-02"]);
    expect(s3.pieces).toBe(6);
    expect(s3.largest).toEqual({ w: 600, l: 1200 });
    expect(s3.processKg).toBeCloseTo((2 * 1200 * 600 + 4 * 200 * 150) * 3 * 8 / 1e6, 9);
    expect(s3.lines.map((l) => [l.w, l.l, l.qty])).toEqual([[600, 1200, 2], [150, 200, 4]]);
  });

  it("keeps chequered plate apart from plain plate of the same thickness", () => {
    expect(find("sheet", "SS304", "4 mm").processKg).toBeCloseTo(500 * 500 * 4 * 8 / 1e6, 9);
    expect(find("sheet", "SS304", "4 mm chequered").processKg).toBeCloseTo(2000 * 1000 * 4.5 * 8 / 1e6, 9);
  });

  it("applies the assembly qty and keeps materials apart", () => {
    const ms = find("sheet", "MS", "10 mm");
    expect(ms.pieces).toBe(6);
    expect(ms.lines[0]).toMatchObject({ assembly: "Frame", qty: 6, itemName: "Frame plate" });
    expect(find("sheet", "SS304", "10 mm").pieces).toBe(1);
  });

  it("puts dish blanks under sheets and the forming under job work", () => {
    const s5 = find("sheet", "SS304", "5 mm");
    expect(s5.lines.map((l) => l.itemName).sort()).toEqual(["Bottom dish", "Top dish"]);
    const jobs = list.rows.filter((r) => r.group === "jobwork");
    expect(jobs.map((r) => r.pieces).sort()).toEqual([1, 2]);
    expect(jobs.every((r) => r.unit === "piece")).toBe(true);
  });

  it("adds up pipe lengths across drawings", () => {
    const p = find("pipe", "SS304", "Pipe 50 NB SCH 10S");
    expect(p.lengthM).toBeCloseTo(10.5, 9);
    expect(p.pieces).toBe(3);
    expect(p.longestMm).toBe(4500);
  });

  it("lists flats by width × thickness, including rings rolled from flat", () => {
    const f = find("flat", "SS304", "Flat 50 × 6");
    const ringStrip = Math.PI * 250 + 100;
    expect(f.lengthM).toBeCloseTo((2 * 1000 + ringStrip) / 1000, 9);
    expect(f.pieces).toBe(3);
    expect(f.longestMm).toBeCloseTo(1000, 9);
  });

  it("rect frames from flat: one row per strip size; from sheet: strips under Sheets", () => {
    // rf1: 2 × 600 + 2 × 300 of 50 wide; rf2 (qty 2): 2 × 700 of 50 wide, 2 × 300 of 100 wide.
    const f50 = find("flat", "SS304", "Flat 50 × 8");
    expect(f50.lengthM).toBeCloseTo((2 * 600 + 2 * 300 + 2 * 2 * 700) / 1000, 9);
    expect(f50.pieces).toBe(8);
    const f100 = find("flat", "SS304", "Flat 100 × 8");
    expect(f100.lengthM).toBeCloseTo((2 * 2 * 300) / 1000, 9);
    expect(f100.pieces).toBe(4);
    const s8 = find("sheet", "SS304", "8 mm");
    expect(s8.lines.filter((l) => l.itemId === "rf3").map((l) => [l.qty, l.w, l.l])).toEqual([[2, 50, 600], [2, 50, 300]]);
  });

  it("rect frame from flat is priced as a flat; unequal strips name both widths", () => {
    const items = out.drawings[1].items;
    expect(items.find((i) => i.item.id === "rf1")?.price?.label).toBe("Flat 50 × 8");
    expect(items.find((i) => i.item.id === "rf2")?.price?.label).toBe("Flat 50 & 100 × 8");
    expect(items.find((i) => i.item.id === "rf1")?.lengthM).toBeCloseTo(1.8, 9);
    expect(items.find((i) => i.item.id === "rf3")?.price?.label).toBe("8 mm");
  });

  it("lists sections by size", () => {
    const a = find("section", "SS304", "Angle 50 × 50 × 6");
    expect(a.lengthM).toBeCloseTo(3.2, 9);
    expect(a.pieces).toBe(4);
  });

  it("splits hardware from other bought-outs, with their units", () => {
    expect(find("hardware", "SS304", "Hex bolt M12 × 50")).toMatchObject({ pieces: 8, unit: "piece" });
    expect(find("hardware", "SS304", "Nut-bolt-washer set M16 × 60")).toMatchObject({ pieces: 6, unit: "set" });
    expect(find("bought", "SS304", "Stub end 50 NB Long SCH 10S")).toMatchObject({ pieces: 2, unit: "piece" });
    const hose = find("bought", "SS304", "Hose 20 NB");
    expect(hose).toMatchObject({ pieces: 3, unit: "m" });
    expect(hose.lengthM).toBeCloseTo(4.5, 9);
    expect(list.rows.find((r) => r.group === "bought" && r.label.startsWith("Hose clamp"))?.pieces).toBe(4);
    for (const r of list.rows.filter((x) => x.group === "hardware" || x.group === "bought")) expect(r.processKg).toBe(0);
  });

  it("spots hardware among free-text bought items", () => {
    expect(find("hardware", "SS304", "HEX HD BOLT M10×25").pieces).toBe(10);
    expect(find("hardware", "SS304", "NYLO LOCK NUT M8").pieces).toBe(5);
    expect(find("bought", "SS304", "WHEEL").pieces).toBe(2);
  });

  it("reports items with errors instead of listing them", () => {
    expect(list.skipped).toEqual([expect.objectContaining({ drawingNo: "P-01", itemNo: "15", itemName: "Bad" })]);
  });

  it("orders groups as they are bought, sheets thinnest first", () => {
    const groups = list.rows.map((r) => r.group);
    expect(groups).toEqual([...groups].sort((a, b) => WEIGHED.concat(["hardware", "bought", "jobwork"]).indexOf(a) - WEIGHED.concat(["hardware", "bought", "jobwork"]).indexOf(b)));
    const ss = list.rows.filter((r) => r.group === "sheet" && r.material === "SS304").map((r) => r.label);
    expect(ss).toEqual(["3 mm", "4 mm", "4 mm chequered", "5 mm", "8 mm", "10 mm"]);
  });
});
