import { computeCosting, defaultChargeLines, type CostingInput } from "../../calc/costing";
import { DEFAULT_MATERIALS } from "../../calc/materials";
import type { ExportData } from "../common";

// One costing that touches every pricing path: sizes by ₹/m and ₹/kg, plate by
// thickness and by material fallback, bought-outs by piece and metre, dish job
// work with no rate, an assembly, an item error, an older bought item, and a
// material with no rate.

export function costing(): CostingInput {
  const lines = defaultChargeLines();
  lines.find((l) => l.id === "labour-ss")!.rate = 85;
  lines.find((l) => l.id === "labour-ms")!.rate = 25;
  lines.find((l) => l.id === "painting")!.rate = 12;
  lines.push({ id: "x", name: "Burning job", rate: 5, basis: "process", appliesTo: "MAT:SS304" });
  return {
    defaultMaterial: "SS304",
    burningPct: 3,
    profitPct: 10,
    materials: DEFAULT_MATERIALS,
    rates: { MS: { rate: 60, scrapRate: 26 }, SS304: { rate: 220, scrapRate: 110 }, SS316: { rate: null, scrapRate: null } },
    chargeLines: lines,
    prices: {
      "size|SS304|Pipe 50 NB SCH 10S": { rate: 900, unit: "m" },
      "size|SS304|Pipe 25 NB SCH 10S": { rate: 400, unit: "kg" },
      "plate|SS304|6 mm": { rate: 260, unit: "kg" },
      "bought|SS304|Hose 20 NB": { rate: 300, unit: "m" },
      "bought|SS304|Stub end 50 NB Long SCH 10S": { rate: 450, unit: "piece" },
    },
    drawings: [
      {
        id: "d1",
        drawingNo: "P-01",
        title: "Mixed",
        assemblies: [{ id: "a1", name: "Frame", qty: 2, material: "MS" }],
        items: [
          { id: "a", itemNo: "1", type: "pipe-sch", name: "50 NB", qty: 2, inputs: { sch: "10S", nb: "50", length: 3000 } },
          { id: "c", itemNo: "2", type: "pipe-sch", name: "25 NB", qty: 1, inputs: { sch: "10S", nb: "25", length: 1000 } },
          { id: "p3", itemNo: "3", type: "plate", name: "PLATE 3", qty: 1, inputs: { length: 1000, width: 1000, thk: 3 } },
          { id: "p6", itemNo: "4", type: "plate", name: "PLATE 6", qty: 1, inputs: { length: 1000, width: 1000, thk: 6 } },
          { id: "s1", itemNo: "5", type: "bought", name: "STUBEND LONG", qty: 4, inputs: { kind: "Stub end", nb: "50", stub: "Long", rating: "SCH 10S" } },
          { id: "h", itemNo: "6", type: "bought", name: "HOSE", qty: 3, inputs: { kind: "Hose", nb: "20", pieceLength: 1500 } },
          { id: "dish", itemNo: "7", type: "dish-tori", name: "TOP DISH", qty: 2, inputs: { dia: 800, diaRef: "OD", crown: 800, knuckle: 80, thk: 5 } },
          { id: "f", itemNo: "1", type: "plate", name: "Frame plate", qty: 3, assemblyId: "a1", inputs: { length: 500, width: 400, thk: 10 } },
          { id: "disc", itemNo: "8", type: "disc", name: "Blank", qty: 1, inputs: { dia: 500, thk: 5 } },
          { id: "bad", itemNo: "9", type: "ring-flange", name: "Bad", qty: 1, inputs: { od: 100, id: 200, thk: 5 } },
        ],
      },
      {
        id: "d2",
        drawingNo: "P-02",
        title: "Legacy & SS316",
        items: [
          { id: "m", type: "bought-misc", name: "Hose clamp", qty: 4, inputs: { rate: 150 } },
          { id: "s316", type: "plate", name: "SS316 plate", qty: 1, material: "SS316", inputs: { length: 1000, width: 500, thk: 4 } },
          { id: "ms", type: "plate", name: "MS plate", qty: 2, material: "MS", inputs: { length: 800, width: 800, thk: 8 } },
        ],
      },
    ],
  };
}

export function exportData(input: CostingInput): ExportData {
  return {
    company: { companyName: "Shubhangi Engineers", address: "MIDC Bhosari", email: "a@b.c", phone: "123" },
    header: { clientName: "TEST Client", projectName: "Export test", poNo: "PO-1", drawingRef: "", createdBy: "Shubham", costingDate: "2026-10-19" },
    input,
    result: computeCosting(input),
  };
}
