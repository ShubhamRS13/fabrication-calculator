import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { rawMaterialList, rmBuy, RM_GROUP_LABEL } from "../../calc/raw-material";
import { kg } from "../../format";
import { exportFileName } from "../common";
import { rawMaterialPdfBuffer } from "../pdf-render";
import { rawMaterialWorkbookBuffer } from "../raw-material-excel";
import { buildRawMaterialPdf } from "../raw-material-pdf";
import { costing, exportData } from "./fixture";

// The raw material exports show the same list as the app's Raw material page.

function texts(node: unknown, out: string[] = []): string[] {
  if (typeof node === "string") out.push(node);
  else if (Array.isArray(node)) node.forEach((n) => texts(n, out));
  else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) if (["text", "stack", "columns", "table", "body", "content"].includes(k)) texts(v, out);
  }
  return out;
}

const data = exportData(costing());
const list = rawMaterialList(data.input, data.result);

describe("raw material Excel", () => {
  async function load() {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await rawMaterialWorkbookBuffer(data)) as unknown as ExcelJS.Buffer);
    return wb;
  }
  const cellText = (v: ExcelJS.CellValue) => (v === null || v === undefined ? "" : String(v));

  it("lists every row with its quantity to buy", async () => {
    const wb = await load();
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Raw material", "Pieces"]);
    const ws = wb.getWorksheet("Raw material")!;
    const rows: ExcelJS.CellValue[][] = [];
    ws.eachRow((row) => rows.push((row.values as ExcelJS.CellValue[]).slice(1)));
    expect(list.rows.length).toBeGreaterThan(5);
    for (const r of list.rows) {
      const found = rows.find((v) => v[1] === r.material && v[2] === r.label);
      expect(found, `${r.material} ${r.label}`).toBeDefined();
      const b = rmBuy(r);
      expect(found![3] as number).toBeCloseTo(b.qty, 9);
      expect(found![4]).toBe(b.unit);
      expect(found![10]).toBe(r.drawings.join(", "));
    }
    for (const g of new Set(list.rows.map((r) => r.group))) expect(rows.some((v) => v[0] === RM_GROUP_LABEL[g])).toBe(true);
    // Sheets total = sum of buy kg.
    const sheetTotal = rows.find((v) => v[2] === "Sheets / plates total")!;
    const want = list.rows.filter((r) => r.group === "sheet").reduce((a, r) => a + r.buyKg, 0);
    expect(sheetTotal[9] as number).toBeCloseTo(want, 9);
  });

  it("warns about items that are not included", async () => {
    const ws = (await load()).getWorksheet("Raw material")!;
    const all: string[] = [];
    ws.eachRow((row) => row.eachCell((c) => all.push(cellText(c.value))));
    expect(list.skipped.length).toBe(1);
    expect(all.some((t) => t.startsWith("1 item not included"))).toBe(true);
    expect(all.some((t) => t.includes("Bad") && t.includes(list.skipped[0].error))).toBe(true);
  });

  it("Pieces sheet has one row per piece, with filters", async () => {
    const ws = (await load()).getWorksheet("Pieces")!;
    const lines = list.rows.reduce((a, r) => a + r.lines.length, 0);
    expect(ws.rowCount - 3).toBe(lines);
    expect(ws.autoFilter).toBeTruthy();
    const qty = (ws.getColumn(6).values as ExcelJS.CellValue[]).slice(4).reduce<number>((a, v) => a + (Number(v) || 0), 0);
    expect(qty).toBe(list.rows.reduce((a, r) => a + r.lines.reduce((b, l) => b + l.qty, 0), 0));
  });

  it("file name starts with Raw material", () => {
    expect(exportFileName(data.header, "xlsx", "Raw material")).toBe("Raw material - TEST Client - Export test.xlsx");
  });
});

describe("raw material PDF", () => {
  const all = texts(buildRawMaterialPdf(data).content);

  it("holds every row, its buy kg and its pieces", () => {
    expect(all).toContain("Raw material list");
    expect(all).toContain("Piece list");
    for (const r of list.rows) {
      expect(all).toContain(r.label);
      if (r.group === "sheet") expect(all).toContain(kg(r.buyKg));
    }
    for (const r of list.rows) for (const l of r.lines) expect(all.join("\n")).toContain(l.itemName);
    expect(all.some((t) => t.startsWith("1 item not included"))).toBe(true);
  });

  it("prints with pdfmake", async () => {
    const pdf = await rawMaterialPdfBuffer(data);
    expect(Buffer.from(pdf.subarray(0, 5)).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5000);
  });
});
