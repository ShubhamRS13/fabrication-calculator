import ExcelJS from "exceljs";
import { HyperFormula, type RawCellContent } from "hyperformula";
import { describe, expect, it } from "vitest";
import { computeCosting } from "../../calc/costing";
import { costingWorkbookBuffer, exportFileName, type ExcelExportData } from "../excel";
import { costing, exportData } from "./fixture";

// The workbook must give the app's numbers when Excel recalculates it, and keep
// giving them when a rate is changed on the Rates sheet. HyperFormula stands in
// for Excel here.

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
        // Material cost = by weight + bought-out / job work (the hidden helper columns).
        expect(Number(x.value(sheet, r, 17) ?? 0)).toBeCloseTo(it.materialAmount + it.fixedAmount, 6);
        expect(Number(x.value(sheet, r, 18) ?? 0)).toBeCloseTo(it.scrapCredit, 6);
        expect(Number(x.value(sheet, r, 20) ?? 0)).toBeCloseTo(it.materialAmount, 6);
        expect(Number(x.value(sheet, r, 21) ?? 0)).toBeCloseTo(it.fixedAmount, 6);
      });
      const matRow = x.find(sheet, 2, "Material total");
      expect(x.value(sheet, matRow, 19)).toBeCloseTo(d.materialTotal, 6);
      expect(x.value(sheet, x.find(sheet, 2, "Charges total"), 19)).toBeCloseTo(d.chargesTotal, 6);
      expect(x.value(sheet, x.find(sheet, 2, "Total", matRow), 19)).toBeCloseTo(d.total, 6);
    }

    // Size, total qty and the assembly with its qty.
    const frame = x.find("P-01", 2, "Frame plate");
    expect(x.value("P-01", frame, 4)).toBe("Frame × 2");
    expect(x.value("P-01", frame, 6)).toBe("10 THK × 400 × 500");
    expect(x.value("P-01", frame, 8)).toBe(6);
    expect(x.value("P-01", x.find("P-01", 2, "50 NB"), 6)).toBe("50 NB SCH 10S × 3000 L");

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
      expect(x.value(sheet, x.find(sheet, 2, "Total", matTotal), 19)).toBeCloseTo(d.total, 6);
    }
    expect(x.value("Summary", x.find("Summary", 9, "Grand total"), 12)).toBeCloseTo(app.grandTotal, 6);
  });

  it("lists missing rates on the Summary sheet and highlights the rows", async () => {
    const data = exportData(costing());
    expect(data.result.missing.length).toBeGreaterThan(0);
    const x = await recalc(data);
    const box = x.find("Summary", 2, `Rates missing (${data.result.missing.length}) — these amounts count as 0. Enter them on the Rates sheet here or the Rates page in the app.`);
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
