import ExcelJS from "exceljs";
import { rmBuy, rmSizeNote, RM_GROUP_LABEL, type RmRow } from "../calc/raw-material";
import { num } from "../format";
import type { ExportData } from "./common";
import { FILL_HEAD, FILL_MISSING, head, KG, letterhead, pageSetup, RED, totalRow } from "./excel";
import { LENGTH_GROUPS, RM_NOTE, rmExport, skippedNote, WEIGHED_GROUPS } from "./raw-material-common";

// Raw material workbook (RM.3): "Raw material" — what to buy, one row per material
// and size, grouped as it is ordered — and "Pieces" — every sheet piece and cut
// length behind those rows, with filters. Plain values; nothing to recalculate.

const M = "#,##0.00";
const PCS = "#,##0";

const LIST_COLS = [
  { label: "Sr", width: 5 },
  { label: "Material", width: 9 },
  { label: "Item / size", width: 34 },
  { label: "Qty to buy", width: 12 },
  { label: "Unit", width: 6 },
  { label: "Pieces", width: 8 },
  { label: "Largest / longest", width: 22 },
  { label: "Process kg", width: 12 },
  { label: "Burning kg", width: 11 },
  { label: "Buy kg", width: 12 },
  { label: "Used in drawings", width: 28 },
  { label: "Remarks / vendor", width: 24 },
];
const LAST = LIST_COLS.length;

function fillList(ws: ExcelJS.Worksheet, data: ExportData, rm: ReturnType<typeof rmExport>, logoId: number | undefined) {
  ws.columns = LIST_COLS.map((c) => ({ width: c.width }));
  let r = letterhead(ws, data, LAST, logoId);

  ws.getCell(r, 1).value = "Raw material list";
  ws.getCell(r, 1).font = { bold: true, size: 14 };
  r++;
  for (const [label, value] of rm.info) {
    ws.getCell(r, 1).value = label;
    ws.getCell(r, 1).font = { bold: true };
    ws.mergeCells(r, 1, r, 2);
    ws.getCell(r, 3).value = value;
    r++;
  }
  ws.mergeCells(r, 1, r, LAST);
  ws.getCell(r, 1).value = RM_NOTE;
  ws.getCell(r, 1).font = { italic: true, size: 9 };
  r += 2;

  if (rm.list.skipped.length) {
    const box = (text: string, bold = false) => {
      ws.mergeCells(r, 1, r, LAST);
      const cell = ws.getCell(r, 1);
      cell.value = text;
      cell.font = { color: { argb: RED }, bold };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL_MISSING } };
      r++;
    };
    box(skippedNote(rm.list.skipped.length), true);
    for (const s of rm.list.skipped) box(`•  ${s.drawingNo} · ${s.itemNo ? `${s.itemNo} ` : ""}${s.itemName} — ${s.error}`);
    r++;
  }

  // To buy, at a glance
  ws.getCell(r, 1).value = "To buy";
  ws.getCell(r, 1).font = { bold: true, size: 12 };
  r++;
  const sumHead = ws.getRow(r);
  ["", "", "Group", "Lines", "", "", "", "", "", "Buy kg", "Total m"].forEach((t, i) => (sumHead.getCell(i + 1).value = t || null));
  head(sumHead, 3, 11);
  r++;
  for (const { group, rows } of rm.groups) {
    const row = ws.getRow(r++);
    row.getCell(3).value = RM_GROUP_LABEL[group];
    row.getCell(4).value = rows.length;
    if (WEIGHED_GROUPS.includes(group)) {
      row.getCell(10).value = rows.reduce((a, x) => a + x.buyKg, 0);
      row.getCell(10).numFmt = KG;
    }
    if (LENGTH_GROUPS.includes(group)) {
      row.getCell(11).value = rows.reduce((a, x) => a + x.lengthM, 0);
      row.getCell(11).numFmt = M;
    }
  }
  r++;

  let sr = 0;
  for (const { group, rows } of rm.groups) {
    ws.getCell(r, 1).value = RM_GROUP_LABEL[group];
    ws.getCell(r, 1).font = { bold: true, size: 12 };
    r++;
    const h = ws.getRow(r++);
    LIST_COLS.forEach((c, i) => (h.getCell(i + 1).value = c.label));
    head(h, 1, LAST);
    for (const x of rows) writeRow(ws.getRow(r++), x, ++sr);
    if (WEIGHED_GROUPS.includes(group)) {
      const t = ws.getRow(r++);
      t.getCell(3).value = `${RM_GROUP_LABEL[group]} total`;
      const set = (col: number, v: number) => {
        t.getCell(col).value = v;
        t.getCell(col).numFmt = KG;
      };
      set(8, rows.reduce((a, x) => a + x.processKg, 0));
      set(9, rows.reduce((a, x) => a + x.burningKg, 0));
      set(10, rows.reduce((a, x) => a + x.buyKg, 0));
      totalRow(t, 1, LAST);
    }
    r++;
  }
  pageSetup(ws, "portrait");
}

function writeRow(row: ExcelJS.Row, x: RmRow, sr: number) {
  const buy = rmBuy(x);
  const weighed = WEIGHED_GROUPS.includes(x.group);
  const values: (string | number | null)[] = [
    sr,
    x.material,
    x.label,
    buy.qty,
    buy.unit,
    x.pieces,
    rmSizeNote(x, (n) => num(Math.round(n))),
    weighed ? x.processKg : null,
    weighed ? x.burningKg : null,
    weighed ? x.buyKg : null,
    x.drawings.join(", "),
    null,
  ];
  values.forEach((v, i) => (row.getCell(i + 1).value = v));
  row.getCell(4).numFmt = buy.unit === "kg" ? KG : buy.unit === "m" ? M : PCS;
  row.getCell(4).font = { bold: true };
  row.getCell(6).numFmt = PCS;
  for (const c of [8, 9, 10]) row.getCell(c).numFmt = KG;
  row.getCell(11).alignment = { wrapText: true, vertical: "top" };
  // Excel does not grow a row for wrapped text on its own; ~30 characters fit the column.
  const lines = Math.ceil(x.drawings.join(", ").length / 30);
  if (lines > 1) row.height = 15 * lines;
  for (const c of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) row.getCell(c).alignment = { ...row.getCell(c).alignment, vertical: "top" };
  row.getCell(12).border = { bottom: { style: "hair" } };
}

const PIECE_COLS = [
  { label: "Group", width: 16 },
  { label: "Material", width: 9 },
  { label: "Item / size", width: 30 },
  { label: "W mm", width: 9 },
  { label: "L / cut length mm", width: 12 },
  { label: "Qty", width: 7 },
  { label: "Total m", width: 9 },
  { label: "kg", width: 11 },
  { label: "Drawing", width: 16 },
  { label: "Item no", width: 8 },
  { label: "Item", width: 30 },
  { label: "Assembly", width: 16 },
];

function fillPieces(ws: ExcelJS.Worksheet, rm: ReturnType<typeof rmExport>) {
  ws.columns = PIECE_COLS.map((c) => ({ width: c.width }));
  ws.getCell(1, 1).value = "Pieces — every sheet piece and cut length in the raw material list";
  ws.getCell(1, 1).font = { bold: true, size: 12 };
  const h = ws.getRow(3);
  PIECE_COLS.forEach((c, i) => (h.getCell(i + 1).value = c.label));
  head(h, 1, PIECE_COLS.length);
  let r = 4;
  for (const { group, rows } of rm.groups) {
    for (const x of rows) {
      for (const l of x.lines) {
        const length = LENGTH_GROUPS.includes(group);
        const values: (string | number | null)[] = [
          RM_GROUP_LABEL[group],
          x.material,
          x.label,
          l.w ?? null,
          l.l ?? l.lengthMm ?? null,
          l.qty,
          length && l.lengthMm ? (l.lengthMm * l.qty) / 1000 : null,
          l.kg || null,
          l.drawingNo,
          l.itemNo ?? null,
          l.itemName,
          l.assembly ?? null,
        ];
        const row = ws.getRow(r++);
        values.forEach((v, i) => (row.getCell(i + 1).value = v));
        row.getCell(4).numFmt = PCS;
        row.getCell(5).numFmt = PCS;
        row.getCell(6).numFmt = PCS;
        row.getCell(7).numFmt = M;
        row.getCell(8).numFmt = KG;
      }
    }
  }
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: Math.max(3, r - 1), column: PIECE_COLS.length } };
  ws.views = [{ state: "frozen", ySplit: 3 }];
  pageSetup(ws, "landscape");
}

export function buildRawMaterialWorkbook(data: ExportData): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = data.company.companyName;
  wb.created = new Date();
  const logoId = data.logo
    ? wb.addImage({ buffer: Buffer.from(data.logo) as unknown as ExcelJS.Buffer, extension: "png" })
    : undefined;
  const rm = rmExport(data);
  fillList(wb.addWorksheet("Raw material", { properties: { tabColor: { argb: "FF1F4E79" } } }), data, rm, logoId);
  fillPieces(wb.addWorksheet("Pieces", { properties: { tabColor: { argb: FILL_HEAD } } }), rm);
  return wb;
}

export async function rawMaterialWorkbookBuffer(data: ExportData): Promise<Uint8Array> {
  const buf = await buildRawMaterialWorkbook(data).xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}
