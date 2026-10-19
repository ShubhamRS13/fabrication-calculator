import ExcelJS from "exceljs";
import { HyperFormula, type RawCellContent } from "hyperformula";
import { describe, expect, it } from "vitest";
import { computeCosting, defaultChargeLines, type CostingInput } from "../../calc/costing";
import { DEFAULT_MATERIALS } from "../../calc/materials";
import { costingWorkbookBuffer, exportFileName, type ExcelExportData } from "../excel";

// The workbook must give the app's numbers when Excel recalculates it, and keep
// giving them when a rate is changed on the Rates sheet. HyperFormula stands in
// for Excel here.

function costing(): CostingInput {
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

function exportData(input: CostingInput): ExcelExportData {
  return {
    company: { companyName: "Shubhangi Engineers", address: "MIDC Bhosari", email: "a@b.c", phone: "123" },
    header: { clientName: "TEST Client", projectName: "Export test", poNo: "PO-1", drawingRef: "", createdBy: "Shubham", costingDate: "2026-10-19" },
    input,
    result: computeCosting(input),
  };
}

/** Load the saved file back and hand every sheet (values + formulas) to HyperFormula. */
async function recalc(data: ExcelExportData) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await costingWorkbookBuffer(data)) as unknown as ExcelJS.Buffer);
  const sheets: Record<string, RawCellContent[][]> = {};
  wb.eachSheet((ws) => {
    const rows: RawCellContent[][] = [];
    ws.eachRow({ includeEmpty: true }, (row, r) => {
      const cells: RawCellContent[] = [];
      row.eachCell({ includeEmpty: true }, (cell, c) => {
        const v = cell.isMerged && cell.master.address !== cell.address ? null : cell.value;
        let out: RawCellContent = null;
        if (v && typeof v === "object" && "formula" in v) out = `=${v.formula}`;
        else if (typeof v === "number" || typeof v === "string") out = v;
        else if (v && typeof v === "object" && "richText" in v) out = v.richText.map((t) => t.text).join("");
        cells[c - 1] = out;
      });
      rows[r - 1] = Array.from(cells, (x) => x ?? null);
    });
    sheets[ws.name] = Array.from(rows, (x) => x ?? []);
  });
  const hf = HyperFormula.buildFromSheets(sheets, { licenseKey: "gpl-v3", smartRounding: false });
  const id = (sheet: string) => hf.getSheetId(sheet)!;
  const value = (sheet: string, row: number, col: number) => hf.getCellValue({ sheet: id(sheet), row: row - 1, col: col - 1 });
  /** First row (1-based) whose cell in `col` equals `text`, after `from`. */
  const find = (sheet: string, col: number, text: string, from = 1) => {
    const h = hf.getSheetDimensions(id(sheet)).height;
    for (let r = from; r <= h; r++) if (value(sheet, r, col) === text) return r;
    throw new Error(`"${text}" not found in ${sheet}`);
  };
  const set = (sheet: string, row: number, col: number, v: RawCellContent) => hf.setCellContents({ sheet: id(sheet), row: row - 1, col: col - 1 }, v);
  return { wb, hf, value, find, set };
}

describe("Excel export", () => {
  it("recalculates to the app's numbers: items, drawings, summary", async () => {
    const data = exportData(costing());
    const { result } = data;
    const x = await recalc(data);
    expect(x.wb.worksheets.map((w) => w.name)).toEqual(["Summary", "P-01", "P-02", "Rates"]);

    for (const d of result.drawings) {
      const sheet = d.drawing.drawingNo;
      const first = x.find(sheet, 1, "No") + 1;
      d.items.forEach((it, i) => {
        const r = first + i;
        expect(x.value(sheet, r, 2)).toBe(it.item.name);
        expect(Number(x.value(sheet, r, 20) ?? 0)).toBeCloseTo(it.materialAmount, 6);
        expect(Number(x.value(sheet, r, 21) ?? 0)).toBeCloseTo(it.scrapCredit, 6);
        expect(Number(x.value(sheet, r, 22) ?? 0)).toBeCloseTo(it.fixedAmount, 6);
      });
      const matRow = x.find(sheet, 2, "Material total");
      expect(x.value(sheet, matRow, 22)).toBeCloseTo(d.materialTotal, 6);
      expect(x.value(sheet, x.find(sheet, 2, "Charges total"), 22)).toBeCloseTo(d.chargesTotal, 6);
      expect(x.value(sheet, x.find(sheet, 2, "Total", matRow), 22)).toBeCloseTo(d.total, 6);
    }

    const sub = x.find("Summary", 9, "Subtotal");
    expect(x.value("Summary", sub, 12)).toBeCloseTo(result.subtotal, 6);
    expect(x.value("Summary", sub + 2, 12)).toBeCloseTo(result.profit, 6);
    expect(x.value("Summary", x.find("Summary", 9, "Grand total"), 12)).toBeCloseTo(result.grandTotal, 6);
  });

  it("changing rates on the Rates sheet gives the same totals as the app with those rates", async () => {
    const input = costing();
    const x = await recalc(exportData(input));
    const S = "Rates";
    const matRow = (m: string) => x.find(S, 1, m);
    const priceRow = (label: string) => x.find(S, 3, label);

    // Material rate, a blank material rate filled in, a plate rate cleared (falls back),
    // a size rate switched to ₹/piece, a missing job-work rate, a charge rate and profit.
    x.set(S, matRow("SS304"), 5, 240);
    x.set(S, matRow("SS316"), 5, 310);
    x.set(S, matRow("SS316"), 6, 150);
    x.set(S, priceRow("6 mm"), 5, null);
    x.set(S, priceRow("Pipe 50 NB SCH 10S"), 4, "piece");
    x.set(S, priceRow("Pipe 50 NB SCH 10S"), 5, 2500);
    const jobLabel = "Torispherical dish forming – D 800 OD × 5";
    x.set(S, priceRow(jobLabel), 5, 3500);
    x.set(S, x.find(S, 1, "Labour – SS"), 5, 90);
    x.set(S, x.find(S, 1, "Profit %"), 5, 12);

    input.rates.SS304.rate = 240;
    input.rates.SS316 = { rate: 310, scrapRate: 150 };
    delete input.prices!["plate|SS304|6 mm"];
    input.prices!["size|SS304|Pipe 50 NB SCH 10S"] = { rate: 2500, unit: "piece" };
    input.prices![`jobwork|SS304|${jobLabel}`] = { rate: 3500, unit: "piece" };
    input.chargeLines.find((l) => l.id === "labour-ss")!.rate = 90;
    input.profitPct = 12;
    const app = computeCosting(input);

    for (const d of app.drawings) {
      const sheet = d.drawing.drawingNo;
      const matTotal = x.find(sheet, 2, "Material total");
      expect(x.value(sheet, x.find(sheet, 2, "Total", matTotal), 22)).toBeCloseTo(d.total, 6);
    }
    expect(x.value("Summary", x.find("Summary", 9, "Grand total"), 12)).toBeCloseTo(app.grandTotal, 6);
  });

  it("lists missing rates on the Summary sheet and highlights the rows", async () => {
    const data = exportData(costing());
    expect(data.result.missing.length).toBeGreaterThan(0);
    const x = await recalc(data);
    const box = x.find("Summary", 2, `Rates missing (${data.result.missing.length}) — these amounts count as 0. Enter them on the Rates sheet or the Pricing page.`);
    data.result.missing.forEach((m, i) => expect(x.value("Summary", box + 1 + i, 2)).toBe(`•  ${m.label}`));
    // The dish needs job work that has no rate: its row is tinted.
    const ws = x.wb.getWorksheet("P-01")!;
    const dishRow = x.find("P-01", 2, "TOP DISH");
    expect((ws.getCell(dishRow, 2).fill as ExcelJS.FillPattern).fgColor?.argb).toBe("FFFDE2E2");
  });

  it("file name is safe", () => {
    const h = exportData(costing()).header;
    expect(exportFileName({ ...h, clientName: 'A/B: "C"' }, "xlsx")).toBe("Costing - A-B- -C- - Export test.xlsx");
  });
});
