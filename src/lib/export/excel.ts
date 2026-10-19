import ExcelJS from "exceljs";
import { chargeApplies, UNITS_BY_GROUP, type DrawingOutput, type ItemOutput } from "../calc/costing";
import { familyOf } from "../calc/materials";
import { formatDate } from "../format";
import { appliesToLabel, GROUP_LABEL, itemLabels, missingNote, type ExportData } from "./common";

export type { ExportCompany, ExportHeader } from "./common";
export { exportFileName } from "./common";
export type ExcelExportData = ExportData;

// Costing workbook (Milestone 4.1). Weights are written as numbers, exactly as the
// engine computed them. Every rate lives on the Rates sheet; item amounts, cost
// blocks, charges, profit and the grand total are live formulas over it, so
// changing a rate in Excel updates the whole workbook. Each formula also carries
// the engine's result, so the file shows the right numbers before recalculation.

const KG = "#,##0.000";
/** Indian grouping: ₹1,23,45,678.00 */
const INR = String.raw`[>=10000000]"₹"##\,##\,##\,##0.00;[>=100000]"₹"##\,##\,##0.00;"₹"#,##0.00`;
const RATE = INR;

const FILL_INPUT = "FFFFF2CC";
const FILL_MISSING = "FFFDE2E2";
const FILL_HEAD = "FFEEF2F6";
const RED = "FF9B1C1C";

// ---------- small helpers ----------

type Formula = { formula: string; result: number | string };
const fx = (formula: string, result: number | string): Formula => ({
  formula,
  result: typeof result === "number" && !Number.isFinite(result) ? 0 : result,
});

/** `'Sheet'!$A$1` — absolute, so it can be pasted anywhere. */
function abs(sheet: string, row: number, col: number): string {
  return `'${sheet.replace(/'/g, "''")}'!$${colLetter(col)}$${row}`;
}

export function colLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const a1 = (row: number, col: number) => `${colLetter(col)}${row}`;

/** Excel sheet names: ≤ 31 chars, none of []:*?/\ and unique. */
function sheetNames(drawings: DrawingOutput[]): string[] {
  const used = new Set(["summary", "rates"]);
  return drawings.map((d, i) => {
    const base = (d.drawing.drawingNo || `Drawing ${i + 1}`).replace(/[[\]:*?/\\']/g, "-").trim().slice(0, 31) || `Drawing ${i + 1}`;
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base.slice(0, 31 - String(n).length - 1)}~${n}`;
    used.add(name.toLowerCase());
    return name;
  });
}

function head(row: ExcelJS.Row, from: number, to: number) {
  for (let c = from; c <= to; c++) {
    const cell = row.getCell(c);
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL_HEAD } };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = { bottom: { style: "thin" } };
  }
}

function fill(row: ExcelJS.Row, from: number, to: number, argb: string) {
  for (let c = from; c <= to; c++) row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function input(cell: ExcelJS.Cell) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL_INPUT } };
  cell.border = { top: { style: "hair" }, bottom: { style: "hair" }, left: { style: "hair" }, right: { style: "hair" } };
}

function totalRow(row: ExcelJS.Row, from: number, to: number) {
  for (let c = from; c <= to; c++) {
    const cell = row.getCell(c);
    cell.font = { bold: true };
    cell.border = { top: { style: "thin" }, bottom: { style: "double" } };
  }
}

/** Company letterhead: logo on the left, details centred across columns 1..lastCol. Returns the next free row. */
function letterhead(ws: ExcelJS.Worksheet, data: ExcelExportData, lastCol: number, logoId: number | undefined): number {
  const lines: [string, Partial<ExcelJS.Font>][] = [
    [data.company.companyName, { bold: true, size: 16 }],
    [data.company.address, { size: 10 }],
    [[data.company.phone && `Phone ${data.company.phone}`, data.company.email].filter(Boolean).join(" · "), { size: 10 }],
  ];
  lines.forEach(([text, font], i) => {
    ws.mergeCells(i + 1, 1, i + 1, lastCol);
    const cell = ws.getCell(i + 1, 1);
    cell.value = text;
    cell.font = font;
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
  ws.getRow(1).height = 24;
  if (logoId !== undefined) ws.addImage(logoId, { tl: { col: 0.1, row: 0.1 }, ext: { width: 56, height: 56 } });
  for (let c = 1; c <= lastCol; c++) ws.getCell(4, c).border = { bottom: { style: "medium" } };
  return 6;
}

function pageSetup(ws: ExcelJS.Worksheet) {
  ws.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };
}

// ---------- Rates sheet ----------

interface RateRefs {
  material: Map<string, { rate: string; scrap: string }>;
  price: Map<string, { rate: string; unit: string }>;
  charge: Map<string, string>;
  profit: string;
}

function fillRates(ws: ExcelJS.Worksheet, data: ExcelExportData, logoId: number | undefined): RateRefs {
  const { input: c, result } = data;
  const name = ws.name;
  ws.columns = [{ width: 20 }, { width: 12 }, { width: 34 }, { width: 10 }, { width: 13 }, { width: 13 }, { width: 11 }, { width: 10 }, { width: 22 }, { width: 30 }];
  let r = letterhead(ws, data, 10, logoId);
  const refs: RateRefs = { material: new Map(), price: new Map(), charge: new Map(), profit: "" };

  ws.getCell(r, 1).value = "Rates";
  ws.getCell(r, 1).font = { bold: true, size: 14 };
  r++;
  ws.getCell(r, 1).value = "Yellow cells are rates. Change one and every amount in the workbook updates. A blank rate is missing; 0 means free.";
  ws.getCell(r, 1).font = { italic: true, size: 10 };
  r += 2;

  // Material rates
  ws.getCell(r, 1).value = "Material rates";
  ws.getCell(r, 1).font = { bold: true, size: 12 };
  r++;
  ws.getRow(r).values = ["Material", "Family", "", "", "Rate ₹/kg", "Scrap ₹/kg"];
  head(ws.getRow(r), 1, 6);
  r++;
  const used = new Set<string>();
  for (const d of result.drawings) for (const it of d.items) if (it.unit?.costedByWeight) used.add(it.material);
  for (const m of [...used].sort()) {
    const rate = c.rates[m];
    ws.getCell(r, 1).value = m;
    ws.getCell(r, 2).value = familyOf(m);
    for (const [col, v] of [[5, rate?.rate], [6, rate?.scrapRate]] as const) {
      const cell = ws.getCell(r, col);
      if (v !== null && v !== undefined) cell.value = v;
      cell.numFmt = RATE;
      input(cell);
    }
    refs.material.set(m, { rate: abs(name, r, 5), scrap: abs(name, r, 6) });
    r++;
  }
  r++;

  // Price rows (Pricing page)
  ws.getCell(r, 1).value = "Prices (from the Rates page)";
  ws.getCell(r, 1).font = { bold: true, size: 12 };
  r++;
  ws.getRow(r).values = ["Priced as", "Material", "Item / size", "Unit", "Rate ₹", "Process kg", "Metres", "Pieces", "Drawings", "Note"];
  head(ws.getRow(r), 1, 10);
  r++;
  for (const p of result.prices) {
    const row = ws.getRow(r);
    row.values = [GROUP_LABEL[p.group], p.material, p.label, p.unit, p.rate ?? null, p.kg || null, p.m || null, p.pieces, p.drawings.join(", ")];
    const unit = row.getCell(4);
    input(unit);
    unit.dataValidation = { type: "list", allowBlank: false, formulae: [`"${UNITS_BY_GROUP[p.group].join(",")}"`] };
    input(row.getCell(5));
    row.getCell(5).numFmt = RATE;
    row.getCell(6).numFmt = KG;
    row.getCell(7).numFmt = "#,##0.00";
    if (p.missing) {
      row.getCell(10).value = "Rate missing";
      row.getCell(10).font = { color: { argb: RED }, bold: true };
      fill(row, 1, 3, FILL_MISSING);
    } else if (p.rate === null) {
      row.getCell(10).value = "Blank: uses the material rate";
    }
    refs.price.set(p.key, { rate: abs(name, r, 5), unit: abs(name, r, 4) });
    r++;
  }
  if (!result.prices.length) {
    ws.getCell(r, 1).value = "No price rows.";
    r++;
  }
  r++;

  // Charge lines
  ws.getCell(r, 1).value = "Charge lines";
  ws.getCell(r, 1).font = { bold: true, size: 12 };
  r++;
  ws.getRow(r).values = ["Charge", "Basis", "Applies to", "", "Rate ₹/kg"];
  head(ws.getRow(r), 1, 5);
  r++;
  for (const line of c.chargeLines) {
    ws.getRow(r).values = [line.name, line.basis === "process" ? "Process wt" : "Finish wt", appliesToLabel(line.appliesTo), "", line.rate ?? null];
    input(ws.getCell(r, 5));
    ws.getCell(r, 5).numFmt = RATE;
    refs.charge.set(line.id, abs(name, r, 5));
    r++;
  }
  r++;

  ws.getCell(r, 1).value = "Profit %";
  ws.getCell(r, 1).font = { bold: true };
  ws.getCell(r, 5).value = c.profitPct;
  input(ws.getCell(r, 5));
  refs.profit = abs(name, r, 5);
  pageSetup(ws);
  return refs;
}

// ---------- Drawing sheets ----------

// Item table columns. Cost is one visible column; two hidden helper columns keep
// its by-weight part and its bought-out / job-work part apart, because the cost
// by material and the Summary sheet's Bought ₹ need them separately.
const C = {
  no: 1, name: 2, type: 3, asm: 4, mat: 5, size: 6, qty: 7, pcs: 8,
  finish: 9, process: 10, scrap: 11, burnPct: 12, burn: 13,
  priced: 14, unit: 15, rate: 16, cost: 17, credit: 18,
  /** Money column of the cost blocks below the items. */
  net: 19,
  /** Hidden helpers */
  wtAmt: 20, fixed: 21,
} as const;
const LAST = C.credit;

interface DrawingRefs {
  materials: { material: string; process: string; finish: string; scrap: string }[];
  finishTotal: string;
  materialTotal: string;
  chargesTotal: string;
  boughtTotal: string;
  total: string;
}

function fillDrawing(
  ws: ExcelJS.Worksheet,
  d: DrawingOutput,
  data: ExcelExportData,
  rates: RateRefs,
  typeLabel: (id: string) => string,
  sizeOf: (it: ItemOutput) => string,
  logoId: number | undefined,
): DrawingRefs {
  const name = ws.name;
  const { header } = data;
  ws.columns = [
    { width: 6 }, { width: 28 }, { width: 24 }, { width: 18 }, { width: 9 }, { width: 30 }, { width: 6 }, { width: 8 },
    { width: 11 }, { width: 11 }, { width: 10 }, { width: 9 }, { width: 10 },
    { width: 24 }, { width: 7 }, { width: 11 }, { width: 15 }, { width: 13 }, { width: 15 },
    { width: 13, hidden: true }, { width: 13, hidden: true },
  ];
  let r = letterhead(ws, data, C.net, logoId);
  ws.getCell(r, 1).value = `Drawing ${d.drawing.drawingNo}${d.drawing.title ? ` — ${d.drawing.title}` : ""}`;
  ws.getCell(r, 1).font = { bold: true, size: 14 };
  r++;
  ws.getCell(r, 1).value = [header.clientName, header.projectName, header.poNo && `PO ${header.poNo}`].filter(Boolean).join(" · ");
  r += 2;

  const hr = ws.getRow(r);
  hr.values = [
    "No", "Item", "Type", "Assembly", "Material", "Size", "Qty", "Total qty",
    "Finish kg", "Process kg", "Scrap kg", "Burning %", "Burning kg",
    "Priced as", "Unit", "Rate ₹", "Material cost ₹", "Scrap credit ₹", "",
    "By weight ₹ (helper)", "Bought / job ₹ (helper)",
  ];
  head(hr, 1, LAST);
  head(hr, C.wtAmt, C.fixed);
  hr.height = 30;
  r++;

  const first = r;
  const asmById = new Map((d.drawing.assemblies ?? []).map((a) => [a.id, a]));
  for (const it of d.items) {
    writeItem(ws.getRow(r), it, asmById.get(it.item.assemblyId ?? ""), rates, typeLabel, sizeOf, data);
    alignItemRow(ws.getRow(r));
    r++;
  }
  const last = r - 1;
  const span = (col: number) => `${colLetter(col)}${first}:${colLetter(col)}${Math.max(first, last)}`;

  // Totals of the item table (bought-outs have no kg, as in the app)
  const weighed = d.items.filter((i) => i.unit?.costedByWeight);
  const tr = ws.getRow(r);
  tr.getCell(C.name).value = "Total";
  const sums: [number, number, string][] = [
    [C.finish, weighed.reduce((a, i) => a + i.finishWt, 0), KG],
    [C.process, weighed.reduce((a, i) => a + i.processWt, 0), KG],
    [C.scrap, weighed.reduce((a, i) => a + i.scrap, 0), KG],
    [C.burn, weighed.reduce((a, i) => a + i.burning, 0), KG],
    [C.cost, d.items.reduce((a, i) => a + i.materialAmount + i.fixedAmount, 0), INR],
    [C.credit, d.items.reduce((a, i) => a + i.scrapCredit, 0), INR],
    [C.wtAmt, d.items.reduce((a, i) => a + i.materialAmount, 0), INR],
    [C.fixed, d.boughtTotal, INR],
  ];
  for (const [col, result, fmt] of sums) {
    tr.getCell(col).value = d.items.length ? fx(`SUM(${span(col)})`, result) : 0;
    tr.getCell(col).numFmt = fmt;
  }
  totalRow(tr, 1, LAST);
  const boughtTotal = a1(r, C.fixed);
  r += 3;

  // Cost blocks sit under the item columns they add up (kg under kg, material cost
  // and scrap credit under theirs); their ₹ results go in the column after.
  const L = C.name;
  const M = C.net;
  const title = (text: string) => {
    ws.getCell(r, L).value = text;
    ws.getCell(r, L).font = { bold: true, size: 12 };
    r++;
  };
  const labels = (cells: [number, string][]) => {
    const row = ws.getRow(r);
    for (const [col, text] of cells) row.getCell(col).value = text;
    head(row, L, M);
    r++;
  };

  // Cost by material (weight-costed items only, as in the app)
  title("Cost by material");
  labels([[L, "Material"], [C.finish, "Finish kg"], [C.process, "Process kg"], [C.scrap, "Scrap kg"], [C.burn, "Burning kg"], [C.cost, "Material cost ₹"], [C.credit, "Scrap credit ₹"], [M, "Net ₹"]]);
  const matRows: { material: string; row: number }[] = [];
  const ifs = (col: number, row: number) => `SUMIFS(${span(col)},${span(C.mat)},$${colLetter(L)}$${row})`;
  for (const t of d.byMaterial) {
    const row = ws.getRow(r);
    row.getCell(L).value = t.material;
    const cells: [number, Formula, string][] = [
      [C.finish, fx(ifs(C.finish, r), t.finish), KG],
      [C.process, fx(ifs(C.process, r), t.process), KG],
      [C.scrap, fx(ifs(C.scrap, r), t.scrap), KG],
      [C.burn, fx(ifs(C.burn, r), t.burning), KG],
      [C.cost, fx(ifs(C.wtAmt, r), t.amount), INR],
      [C.credit, fx(ifs(C.credit, r), t.scrapCredit), INR],
      [M, fx(`${a1(r, C.cost)}-${a1(r, C.credit)}`, t.net), INR],
    ];
    for (const [col, value, fmt] of cells) {
      row.getCell(col).value = value;
      row.getCell(col).numFmt = fmt;
    }
    matRows.push({ material: t.material, row: r });
    r++;
  }
  const mt = ws.getRow(r);
  mt.getCell(L).value = "Material total";
  const finishTotalVal = d.byMaterial.reduce((a, t) => a + t.finish, 0);
  const colSum = (col: number, result: number) =>
    matRows.length ? fx(`SUM(${a1(matRows[0].row, col)}:${a1(matRows[matRows.length - 1].row, col)})`, result) : 0;
  mt.getCell(C.finish).value = colSum(C.finish, finishTotalVal);
  mt.getCell(M).value = colSum(M, d.materialTotal);
  mt.getCell(C.finish).numFmt = KG;
  mt.getCell(M).numFmt = INR;
  totalRow(mt, L, M);
  const finishTotal = a1(r, C.finish);
  const materialTotal = a1(r, M);
  r += 2;

  // Charges
  title("Charges");
  labels([[L, "Charge"], [C.type, "Basis"], [C.asm, "Applies to"], [C.process, "Weight kg"], [C.rate, "Rate ₹/kg"], [M, "Amount ₹"]]);
  const chargeTop = r;
  for (const ch of d.charges) {
    const row = ws.getRow(r);
    const col = ch.line.basis === "process" ? C.process : C.finish;
    const cells = matRows.filter((m) => chargeApplies(ch.line.appliesTo, m.material)).map((m) => a1(m.row, col));
    row.getCell(L).value = ch.line.name;
    row.getCell(C.type).value = ch.line.basis === "process" ? "Process wt" : "Finish wt";
    row.getCell(C.asm).value = appliesToLabel(ch.line.appliesTo);
    row.getCell(C.process).value = cells.length ? fx(cells.join("+"), ch.weight) : 0;
    const rateRef = rates.charge.get(ch.line.id);
    row.getCell(C.rate).value = rateRef ? fx(rateRef, ch.line.rate ?? 0) : (ch.line.rate ?? 0);
    row.getCell(M).value = fx(`${a1(r, C.process)}*${a1(r, C.rate)}`, ch.amount);
    row.getCell(C.process).numFmt = KG;
    row.getCell(C.rate).numFmt = RATE;
    row.getCell(M).numFmt = INR;
    r++;
  }
  const ct = ws.getRow(r);
  ct.getCell(L).value = "Charges total";
  ct.getCell(M).value = d.charges.length ? fx(`SUM(${a1(chargeTop, M)}:${a1(r - 1, M)})`, d.chargesTotal) : 0;
  ct.getCell(M).numFmt = INR;
  totalRow(ct, L, M);
  const chargesTotal = a1(r, M);
  r += 2;

  // Drawing total
  title("Drawing total");
  const lines: [string, Formula][] = [
    ["Material (net of scrap credit)", fx(materialTotal, d.materialTotal)],
    ["Charges", fx(chargesTotal, d.chargesTotal)],
    ["Bought-outs & job work", fx(boughtTotal, d.boughtTotal)],
  ];
  const linesTop = r;
  for (const [label, value] of lines) {
    ws.getCell(r, L).value = label;
    ws.getCell(r, M).value = value;
    ws.getCell(r, M).numFmt = INR;
    r++;
  }
  const tt = ws.getRow(r);
  tt.getCell(L).value = "Total";
  tt.getCell(M).value = fx(`SUM(${a1(linesTop, M)}:${a1(r - 1, M)})`, d.total);
  tt.getCell(M).numFmt = INR;
  totalRow(tt, L, M);
  tt.getCell(L).font = { bold: true, size: 12 };
  tt.getCell(M).font = { bold: true, size: 12 };
  const total = a1(r, M);

  pageSetup(ws);
  const ref = (addr: string) => `'${name.replace(/'/g, "''")}'!${addr}`;
  return {
    materials: matRows.map((m) => ({
      material: m.material,
      process: ref(a1(m.row, C.process)),
      finish: ref(a1(m.row, C.finish)),
      scrap: ref(a1(m.row, C.scrap)),
    })),
    finishTotal: ref(finishTotal),
    materialTotal: ref(materialTotal),
    chargesTotal: ref(chargesTotal),
    boughtTotal: ref(boughtTotal),
    total: ref(total),
  };
}

function writeItem(
  row: ExcelJS.Row,
  it: ItemOutput,
  asm: { name: string; qty: number } | undefined,
  rates: RateRefs,
  typeLabel: (id: string) => string,
  sizeOf: (it: ItemOutput) => string,
  data: ExcelExportData,
) {
  const r = row.number;
  const cell = (col: number) => row.getCell(col);
  const at = (col: number) => a1(r, col);
  cell(C.no).value = it.item.itemNo ?? "";
  cell(C.name).value = it.item.name;
  cell(C.type).value = typeLabel(it.item.type);
  cell(C.asm).value = asm ? `${asm.name} × ${asm.qty}` : "";
  cell(C.mat).value = it.material;
  cell(C.size).value = sizeOf(it);
  cell(C.qty).value = it.item.qty;
  cell(C.pcs).value = it.multiplier;

  const u = it.unit;
  if (!u || it.error) {
    cell(C.priced).value = `Error: ${it.error ?? "not computed"}`;
    cell(C.priced).font = { color: { argb: RED } };
    fill(row, 1, LAST, FILL_MISSING);
    return;
  }

  const n = it.multiplier;
  const price = it.price ? rates.price.get(it.price.key) : undefined;
  const stored = it.price ? data.input.prices?.[it.price.key] : undefined;
  const mat = rates.material.get(it.material);
  cell(C.priced).value = [it.price?.label, it.job && `+ ${it.job.label}`].filter(Boolean).join(" ");

  // Bought-out / job-work part of the cost, as the engine works it out.
  const fixed: string[] = [];

  if (u.costedByWeight) {
    cell(C.finish).value = it.finishWt;
    cell(C.process).value = it.processWt;
    cell(C.scrap).value = it.scrap;
    cell(C.burnPct).value = it.burningPct;
    cell(C.burn).value = fx(`${at(C.process)}*${at(C.burnPct)}/100`, it.burning);
    const mRate = mat?.rate ?? "0";
    const rateResult = it.pricedBy === "material" ? (data.input.rates[it.material]?.rate ?? 0) : (stored?.rate ?? 0);
    const unitResult = it.pricedBy === "material" ? "kg" : (stored?.unit ?? "kg");
    if (price) {
      cell(C.unit).value = fx(`IF(${price.rate}="","kg",${price.unit})`, unitResult);
      cell(C.rate).value = fx(`IF(${price.rate}="",${mRate},${price.rate})`, rateResult);
    } else {
      cell(C.unit).value = "kg";
      cell(C.rate).value = fx(mRate, rateResult);
    }
    // ₹/kg on process + burning; ₹/m on the cut metres; ₹/piece on the total qty.
    cell(C.wtAmt).value = fx(
      `IF(${at(C.unit)}="kg",(${at(C.process)}+${at(C.burn)})*${at(C.rate)},IF(${at(C.unit)}="m",${it.lengthM ?? 0}*${at(C.rate)},${at(C.pcs)}*${at(C.rate)}))`,
      it.materialAmount,
    );
    cell(C.credit).value = fx(`${at(C.scrap)}*${mat?.scrap ?? "0"}`, it.scrapCredit);
  } else if (it.price?.group === "bought" && price) {
    const perKg = Number(it.item.inputs.weight) || 0;
    const perM = (Number(it.item.inputs.pieceLength) || 0) / 1000;
    const unitResult = stored?.unit ?? data.result.prices.find((p) => p.key === it.price!.key)?.unit ?? "piece";
    cell(C.unit).value = fx(price.unit, unitResult);
    cell(C.rate).value = fx(price.rate, stored?.rate ?? 0);
    fixed.push(
      `IF(${at(C.unit)}="kg",${n * perKg}*${at(C.rate)},IF(${at(C.unit)}="m",${n * perM}*${at(C.rate)},${at(C.pcs)}*${at(C.rate)}))`,
    );
  } else {
    // Older bought items carry their own rate: fixed value.
    cell(C.fixed).value = it.fixedAmount;
  }

  if (it.job && cell(C.fixed).value === null) {
    const job = rates.price.get(it.job.key);
    const fallback = u.fixedCost * n;
    fixed.push(job ? `IF(${job.rate}="",${fallback},${at(C.pcs)}*${job.rate})` : String(fallback));
  }
  if (fixed.length) cell(C.fixed).value = fx(fixed.join("+"), it.fixedAmount);
  cell(C.cost).value = fx(`${at(C.wtAmt)}+${at(C.fixed)}`, it.materialAmount + it.fixedAmount);

  for (const col of [C.finish, C.process, C.scrap, C.burn]) cell(col).numFmt = KG;
  cell(C.burnPct).numFmt = "0.##";
  cell(C.rate).numFmt = RATE;
  for (const col of [C.cost, C.credit, C.wtAmt, C.fixed]) cell(col).numFmt = INR;
  if (it.missing) fill(row, 1, LAST, FILL_MISSING);
}

/** Long names and sizes wrap; every cell stays at the top of its row. */
function alignItemRow(row: ExcelJS.Row) {
  for (let c = 1; c <= LAST; c++) {
    const wrap = c === C.name || c === C.type || c === C.asm || c === C.size || c === C.priced;
    // Text after a number column gets a small indent so they don't run together.
    const indent = c === C.size || c === C.priced ? 1 : 0;
    row.getCell(c).alignment = { vertical: "top", wrapText: wrap, indent };
  }
}

// ---------- Summary sheet ----------

function fillSummary(
  ws: ExcelJS.Worksheet,
  data: ExcelExportData,
  drawings: { d: DrawingOutput; refs: DrawingRefs; sheet: string }[],
  rates: RateRefs,
  logoId: number | undefined,
) {
  const { header, result } = data;
  ws.columns = [{ width: 5 }, { width: 22 }, { width: 30 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 16 }];
  let r = letterhead(ws, data, 12, logoId);

  ws.getCell(r, 2).value = "Costing summary";
  ws.getCell(r, 2).font = { bold: true, size: 14 };
  r++;
  const info: [string, string][] = [
    ["Client", header.clientName],
    ["Project", header.projectName],
    ["PO no.", header.poNo],
    ["Drawing ref.", header.drawingRef],
    ["Date", header.costingDate ? formatDate(header.costingDate) : ""],
    ["Prepared by", header.createdBy],
  ];
  for (const [label, value] of info) {
    if (!value) continue;
    ws.getCell(r, 2).value = label;
    ws.getCell(r, 2).font = { bold: true };
    ws.getCell(r, 3).value = value;
    r++;
  }
  r++;

  if (result.missing.length) {
    const box = (text: string, bold = false) => {
      ws.mergeCells(r, 2, r, 12);
      const cell = ws.getCell(r, 2);
      cell.value = text;
      cell.font = { color: { argb: RED }, bold };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL_MISSING } };
      r++;
    };
    box(missingNote(result.missing.length, "the Rates sheet here or the Rates page in the app"), true);
    for (const m of result.missing) box(`•  ${m.label}`);
    r++;
  }

  const hr = ws.getRow(r);
  hr.values = ["#", "Drawing", "Title", "SS process kg", "SS scrap kg", "MS process kg", "MS scrap kg", "Finish kg", "Material ₹", "Charges ₹", "Bought ₹", "Total ₹"];
  head(hr, 1, 12);
  hr.height = 30;
  r++;
  const top = r;
  drawings.forEach(({ d, refs }, i) => {
    const row = ws.getRow(r);
    const fam = (f: string, key: "process" | "scrap") => {
      const ms = refs.materials.filter((m) => familyOf(m.material) === f);
      const value = d.byMaterial.filter((t) => familyOf(t.material) === f).reduce((a, t) => a + t[key], 0);
      return ms.length ? fx(ms.map((m) => m[key]).join("+"), value) : 0;
    };
    row.getCell(1).value = i + 1;
    row.getCell(2).value = d.drawing.drawingNo;
    row.getCell(3).value = d.drawing.title;
    row.getCell(4).value = fam("SS", "process");
    row.getCell(5).value = fam("SS", "scrap");
    row.getCell(6).value = fam("MS", "process");
    row.getCell(7).value = fam("MS", "scrap");
    row.getCell(8).value = fx(refs.finishTotal, d.byMaterial.reduce((a, t) => a + t.finish, 0));
    row.getCell(9).value = fx(refs.materialTotal, d.materialTotal);
    row.getCell(10).value = fx(refs.chargesTotal, d.chargesTotal);
    row.getCell(11).value = fx(refs.boughtTotal, d.boughtTotal);
    row.getCell(12).value = fx(refs.total, d.total);
    for (let c = 4; c <= 8; c++) row.getCell(c).numFmt = KG;
    for (let c = 9; c <= 12; c++) row.getCell(c).numFmt = INR;
    r++;
  });
  const tr = ws.getRow(r);
  tr.getCell(2).value = "Total";
  for (let c = 4; c <= 12; c++) {
    const L = colLetter(c);
    let cached = 0;
    for (let row = top; row < r; row++) cached += cachedValue(ws.getCell(row, c).value);
    tr.getCell(c).value = drawings.length ? fx(`SUM(${L}${top}:${L}${r - 1})`, cached) : 0;
    tr.getCell(c).numFmt = c <= 8 ? KG : INR;
  }
  totalRow(tr, 1, 12);
  const subtotalCell = `L${r}`;
  r += 2;

  const totals: [string, Formula, string][] = [
    ["Subtotal", fx(subtotalCell, result.subtotal), INR],
    ["Profit %", fx(rates.profit, data.input.profitPct), "0.##"],
    ["Profit", fx(`L${r}*L${r + 1}/100`, result.profit), INR],
    ["Grand total", fx(`L${r}+L${r + 2}`, result.grandTotal), INR],
  ];
  for (const [label, value, fmt] of totals) {
    ws.mergeCells(r, 9, r, 11);
    ws.getCell(r, 9).value = label;
    ws.getCell(r, 9).alignment = { horizontal: "right" };
    ws.getCell(r, 12).value = value;
    ws.getCell(r, 12).numFmt = fmt;
    if (label === "Grand total") {
      ws.getCell(r, 9).font = { bold: true, size: 12 };
      ws.getCell(r, 12).font = { bold: true, size: 12 };
      ws.getCell(r, 12).border = { top: { style: "thin" }, bottom: { style: "double" } };
    }
    r++;
  }
  r++;
  ws.getCell(r, 2).value = "GST and transport not included. Weights are fixed at export; rates are on the Rates sheet and every amount follows them.";
  ws.getCell(r, 2).font = { italic: true, size: 10 };
  pageSetup(ws);
}

function cachedValue(v: ExcelJS.CellValue): number {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "result" in v && typeof v.result === "number") return v.result;
  return 0;
}

// ---------- Workbook ----------

export function buildCostingWorkbook(data: ExcelExportData): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = data.company.companyName;
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;

  const logoId = data.logo
    ? wb.addImage({ buffer: Buffer.from(data.logo) as unknown as ExcelJS.Buffer, extension: "png" })
    : undefined;
  const { typeLabel, sizeOf } = itemLabels(data.input);

  const summary = wb.addWorksheet("Summary", { properties: { tabColor: { argb: "FF1F4E79" } } });
  const names = sheetNames(data.result.drawings);
  const sheets = names.map((n) => wb.addWorksheet(n));
  const ratesWs = wb.addWorksheet("Rates", { properties: { tabColor: { argb: "FFBF9000" } } });

  const rates = fillRates(ratesWs, data, logoId);
  const drawings = data.result.drawings.map((d, i) => ({
    d,
    sheet: names[i],
    refs: fillDrawing(sheets[i], d, data, rates, typeLabel, sizeOf, logoId),
  }));
  fillSummary(summary, data, drawings, rates, logoId);
  return wb;
}

export async function costingWorkbookBuffer(data: ExcelExportData): Promise<Uint8Array> {
  const buf = await buildCostingWorkbook(data).xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}
