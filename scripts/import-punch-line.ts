import "dotenv/config";
import { writeFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { computeCosting, defaultChargeLines, type CostingInput, type ItemInput } from "../src/lib/calc/costing";
import { DEFAULT_MATERIALS } from "../src/lib/calc/materials";
import { GOLDEN_ROWS, type GoldenStatus } from "../src/lib/calc/__tests__/punch-line.fixture";
import { itemSize } from "../src/lib/calc/size";
import { buildRegistry } from "../src/lib/calc/registry";
import type { ItemInputs } from "../src/lib/calc/types";

// Milestone 5: re-enter "Punch Line System.xlsx" as an app costing and compare.
//   npx tsx --tsconfig tsconfig.json scripts/import-punch-line.ts <workbook> <report.md> [--write]
// Without --write it only computes and writes the report. Rows already checked in
// the Punch Line golden test keep that mapping; the rest are mapped from name and sizes.

const TABS = [
  { tab: "Bag Filter", no: "2600121050/1" },
  { tab: "Storage Hopper", no: "2600121050/2" },
  { tab: "Pickup Hopper", no: "2600121050/3" },
  { tab: "Structure", no: "2600121050/4" },
];

interface WbRow {
  tab: string;
  row: number;
  srNo: string;
  qty: number | null;
  name: string;
  sheet: string;
  material: string;
  thk: number | null;
  width: number | null;
  length: number | null;
  od: number | null;
  id: number | null;
  wbProcess: number | null;
  wbFinish: number | null;
  formula: string;
}

type Mapped =
  | { kind: "item"; type: string; inputs: ItemInputs; status: GoldenStatus | "differs" | "new"; note: string }
  | { kind: "skip"; reason: string };

const num = (v: ExcelJS.CellValue): number | null => {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "result" in v && typeof v.result === "number") return v.result;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
};
const str = (v: ExcelJS.CellValue): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "richText" in v) return v.richText.map((t) => t.text).join("").trim();
  if (typeof v === "object" && "result" in v) return String(v.result ?? "").trim();
  return String(v).trim();
};
const formulaOf = (v: ExcelJS.CellValue) => (v && typeof v === "object" && "formula" in v ? String(v.formula) : "");

function readTab(ws: ExcelJS.Worksheet, tab: string): WbRow[] {
  const col: Record<string, number> = {};
  ws.getRow(10).eachCell((c, i) => (col[str(c.value).toUpperCase()] = i));
  const at = (row: ExcelJS.Row, h: string) => (col[h] ? row.getCell(col[h]).value : null);
  const out: WbRow[] = [];
  for (let r = 11; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    if (str(at(row, "SR.NO.")) === "Total") break;
    const name = str(at(row, "PART NO./ NAME"));
    if (!name) continue;
    const proc = at(row, "PROCESS WT");
    out.push({
      tab,
      row: r,
      srNo: str(at(row, "SR.NO.")),
      qty: num(at(row, "QTY.")),
      name: name.replace(/\s+/g, " "),
      sheet: str(at(row, "DWG SHEET NO.") ?? at(row, "DWG SHEET NO")),
      material: str(at(row, "MATERIAL")) || "SS304",
      thk: num(at(row, "THK")),
      width: num(at(row, "WIDTH")),
      length: num(at(row, "LENGTH")),
      od: num(at(row, "OD")),
      id: num(at(row, "ID")),
      wbProcess: num(proc),
      wbFinish: num(at(row, "FINISH WT")),
      formula: formulaOf(proc) || formulaOf(at(row, "FINISH WT")),
    });
  }
  return out;
}

const BOUGHT = /\b(NUT|BOLT|WASHER|SOCKET|ELBOW|GASKET|HOSE|PLUG|REDUCER|UNION|STUD|SPLIT PIN|WHEEL|THREADED ROD|CLAMP)\b|DISH END \d+ NB/;
const bought = (name: string): ItemInputs => ({ kind: "Other", desc: name });

/** The golden-test mapping, with older bought types moved to the catalogue "Other". */
function fromFixture(r: WbRow): Mapped | null {
  const g = GOLDEN_ROWS.find((x) => x.tab === r.tab && x.row === r.row);
  if (!g) return null;
  if (g.type === "bought-misc") return { kind: "item", type: "bought", inputs: bought(r.name), status: "bought", note: g.note ?? "" };
  return { kind: "item", type: g.type, inputs: g.inputs as ItemInputs, status: g.status, note: g.note ?? "" };
}

function classify(r: WbRow): Mapped {
  const n = r.name.toUpperCase();
  const need = (...v: (number | null)[]) => v.every((x) => x !== null && x > 0);
  let m: RegExpMatchArray | null;
  if (BOUGHT.test(n) && !/BAG CLAMP/.test(n)) return { kind: "item", type: "bought", inputs: bought(r.name), status: "bought", note: "" };
  if ((m = n.match(/SQ TUBE \((\d+)\s*X\s*(\d+)\)/)) && need(r.thk, r.length))
    return { kind: "item", type: "rect-tube", inputs: { a: +m[1], b: +m[2], thk: r.thk!, length: r.length! }, status: "new", note: "" };
  if ((m = n.match(/PIPE (\d+) NB SCH (\w+)/)) && need(r.length))
    return { kind: "item", type: "pipe-sch", inputs: { nb: m[1], sch: m[2], length: r.length! }, status: "new", note: "" };
  if ((m = n.match(/PIPE (\d+) NB ERW MEDIUM/)) && need(r.length))
    return { kind: "item", type: "pipe-is1239", inputs: { nb: m[1], cls: "M", length: r.length! }, status: "new", note: "ERW medium gauge taken as IS 1239 Medium" };
  if ((m = n.match(/PIN OD (\d+)/)) && need(r.length))
    return { kind: "item", type: "round-bar", inputs: { dia: +m[1], length: r.length! }, status: "new", note: "" };
  if (/^ANGLE/.test(n) && need(r.thk, r.width, r.length))
    return { kind: "item", type: "angle-custom", inputs: { width: r.width!, thk: r.thk!, length: r.length! }, status: "new", note: "" };
  if (/^FLAT/.test(n) && need(r.thk, r.width, r.length)) {
    const fixed = r.formula.includes("+0.5");
    return { kind: "item", type: "flat", inputs: { width: r.width!, thk: r.thk!, length: r.length! }, status: fixed ? "fixed" : "new", note: fixed ? "Workbook added 0.5 mm to a flat (a mistake, confirmed)" : "" };
  }
  if (/PLATE/.test(n) && need(r.thk, r.width, r.length)) {
    const chq = /CHQ/.test(n);
    const fixed = !chq && r.formula.includes("+0.5");
    return {
      kind: "item",
      type: "plate",
      inputs: { length: r.length!, width: r.width!, thk: r.thk!, ...(chq ? { thkAllowance: 0.5 } : {}) },
      status: fixed ? "fixed" : "new",
      note: chq ? "Chequered plate: THK + 0.5" : fixed ? "Workbook added 0.5 mm to a plain plate (a mistake, confirmed)" : "",
    };
  }
  return { kind: "skip", reason: "could not be placed automatically" };
}

function mapRow(r: WbRow): Mapped {
  if (r.qty === null || r.qty <= 0) return { kind: "skip", reason: "no quantity in the workbook" };
  return fromFixture(r) ?? classify(r);
}

// ---------- run ----------

async function main() {
  const [wbPath, reportPath] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const write = process.argv.includes("--write");
  if (!wbPath || !reportPath) throw new Error("Usage: import-punch-line.ts <workbook.xlsx> <report.md> [--write]");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(wbPath);

  const drawings = TABS.map(({ tab, no }) => {
    const rows = readTab(wb.getWorksheet(tab)!, tab).map((r) => ({ r, m: mapRow(r) }));
    const totalRow = wb.getWorksheet(tab)!.getRows(11, 300)?.find((row) => str(row.getCell(1).value) === "Total");
    return { tab, no, rows, totalRow };
  });

  const input: CostingInput = {
    defaultMaterial: "SS304",
    burningPct: 3,
    profitPct: 0,
    materials: DEFAULT_MATERIALS,
    rates: {},
    chargeLines: defaultChargeLines(),
    drawings: drawings.map((d) => ({
      id: d.no,
      drawingNo: d.no,
      title: d.tab,
      items: d.rows.flatMap(({ r, m }, i): ItemInput[] =>
        m.kind === "item"
          ? [{ id: `${d.tab}-${r.row}-${i}`, itemNo: r.srNo, type: m.type, name: r.name, dwgSheet: r.sheet, qty: r.qty!, material: r.material, inputs: m.inputs }]
          : [],
      ),
    })),
  };
  const out = computeCosting(input);
  const registry = buildRegistry();

  // Rows the golden test didn't cover: compare with the workbook weight now.
  const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.001, 0.001 * Math.abs(b));
  const k3 = (v: number | null | undefined) => (v === null || v === undefined ? "–" : v.toFixed(3));
  const lines: string[] = [];
  const counts: Record<string, number> = {};
  const review: string[] = [];
  const summary: string[] = [];

  drawings.forEach((d, di) => {
    const dOut = out.drawings[di];
    let k = 0;
    const tableRows: string[] = [];
    let appProcess = 0;
    let appFinish = 0;
    for (const { r, m } of d.rows) {
      if (m.kind === "skip") {
        counts.skipped = (counts.skipped ?? 0) + 1;
        review.push(`| ${d.tab} | ${r.row} | ${r.name} | Not imported: ${m.reason} |`);
        tableRows.push(`| ${r.row} | ${r.srNo} | ${r.name} | ${r.qty ?? "–"} | – | ${k3(r.wbProcess)} | ${k3(r.wbFinish)} | – | – | – | skipped | ${m.reason} |`);
        continue;
      }
      const it = dOut.items[k++];
      let status: string = m.status;
      let note = m.note;
      if (it.error) {
        status = "error";
        note = it.error;
        review.push(`| ${d.tab} | ${r.row} | ${r.name} | App error: ${it.error} |`);
      } else if (status === "new") {
        const wb = r.wbProcess ?? r.wbFinish;
        if (wb === null) status = "missing";
        else if (close(it.processWt, wb)) status = "match";
        else if (close(it.finishWt, wb)) {
          status = "match";
          note = note || "Workbook's process = app finish (app process is the sheet rectangle)";
        } else if (/^[\d.]+$|^\{?[\d.]+\*[\d.]+\}?$/.test(String(r.formula || wb)) || !r.formula) {
          status = "typed";
          note = note || `Typed ${wb} kg; app works it out from the sizes`;
        } else {
          status = "differs";
          review.push(`| ${d.tab} | ${r.row} | ${r.name} | Workbook ${wb.toFixed(3)} kg, app ${it.processWt.toFixed(3)} kg (formula ${r.formula}) |`);
        }
        if (status === "missing") note = note || "No weight in the workbook; app works it out";
      }
      // Assumptions worth a second look.
      if (note.includes("taken as")) review.push(`| ${d.tab} | ${r.row} | ${r.name} | ${note} (${k3(it.processWt)} kg) |`);
      const twin = d.rows.find((o) => o.r !== r && o.r.name === r.name && o.r.thk === r.thk && o.r.width === r.width && o.r.length === r.length && o.r.od === r.od && o.r.sheet !== r.sheet && (o.r.wbProcess ?? o.r.wbFinish) !== null);
      if (status === "missing" && twin)
        review.push(`| ${d.tab} | ${r.row} | ${r.name} (sheet ${r.sheet}, qty ${r.qty}) | Same size as row ${twin.r.row} on sheet ${twin.r.sheet}, which has a weight; this one has none. Separate parts, or the same part drawn twice? Imported as separate. |`);
      counts[status] = (counts[status] ?? 0) + 1;
      if (it.unit?.costedByWeight) {
        appProcess += it.processWt;
        appFinish += it.finishWt;
      }
      const size = itemSize(registry.get(m.type), m.inputs);
      tableRows.push(
        `| ${r.row} | ${r.srNo} | ${r.name} | ${r.qty} | ${size || "–"} | ${k3(r.wbProcess)} | ${k3(r.wbFinish)} | ${it.unit?.costedByWeight ? k3(it.processWt) : "–"} | ${it.unit?.costedByWeight ? k3(it.finishWt) : "–"} | ${registry.get(m.type)?.label ?? m.type} | ${status} | ${note} |`,
      );
    }
    const wbTotP = d.totalRow ? num(d.totalRow.getCell(d.tab === "Pickup Hopper" ? 16 : 17).value) : null;
    const wbTotF = d.totalRow ? num(d.totalRow.getCell(d.tab === "Pickup Hopper" ? 17 : 18).value) : null;
    summary.push(`| ${d.no} | ${d.tab} | ${d.rows.length} | ${k3(wbTotP)} | ${k3(wbTotF)} | ${k3(appProcess)} | ${k3(appFinish)} | ${dOut.items.filter((i) => i.unit && !i.unit.costedByWeight).length} |`);
    lines.push(
      `\n## ${d.no} — ${d.tab}\n`,
      "| Row | Sr | Item | Qty | Size | WB process | WB finish | App process | App finish | App type | Status | Note |",
      "|---|---|---|---|---|---|---|---|---|---|---|---|",
      ...tableRows,
    );
  });

  const report = [
    "# Punch Line System — acceptance re-entry (Milestone 5)",
    "",
    `Generated ${new Date().toISOString().slice(0, 10)} by \`scripts/import-punch-line.ts\` from \`Punch Line System.xlsx\`. Weights in kg, totals for the quantity, density 8 for SS.`,
    "",
    "Statuses: **match** = same as the workbook's formula · **fixed** = workbook formula was wrong · **typed** = workbook weight typed by hand, app works it out · **missing** = workbook has no weight, app works it out · **bought** = priced on the Rates page, no weight · **differs** = needs a look.",
    "",
    "## Totals per drawing",
    "",
    "Workbook totals only add the rows that have a weight, so they are lower wherever the workbook left weights blank. The app's process for discs and flanges is the square sheet, where the workbook used the round part.",
    "",
    "| Drawing | Tab | Rows | WB process total | WB finish total | App process | App finish | Bought-outs |",
    "|---|---|---|---|---|---|---|---|",
    ...summary,
    "",
    "## Row counts",
    "",
    Object.entries(counts).map(([s, c]) => `${s}: ${c}`).join(" · "),
    "",
    "## For Shubham to check",
    "",
    review.length ? ["| Tab | Row | Item | What |", "|---|---|---|---|", ...review].join("\n") : "Nothing.",
    ...lines,
    "",
  ].join("\n");
  writeFileSync(reportPath, report);
  console.log(`Report: ${reportPath}`);
  console.log(Object.entries(counts).map(([s, c]) => `${s}: ${c}`).join(" · "));
  console.log(summary.join("\n"));

  if (!write) return;
  const { getDb } = await import("../src/db");
  const dal = await import("../src/server/costings");
  const db = getDb();
  const costingId = await dal.createCosting(db, {
    clientName: "KnitCon Solutions Pvt. Ltd.",
    projectName: "Punch Line System",
    drawingRef: "2600121050",
    createdBy: "Shubham Shinde",
    defaultMaterial: "SS304",
    burningPct: 3,
    profitPct: 0,
  });
  for (const d of input.drawings) {
    const drawingId = await dal.addDrawing(db, costingId, { drawingNo: d.drawingNo, title: d.title });
    for (const it of d.items) {
      await dal.addItem(db, drawingId, { itemNo: it.itemNo, type: it.type, name: it.name, dwgSheet: it.dwgSheet ?? "", qty: it.qty, material: it.material, inputs: it.inputs as Record<string, number | string | boolean> });
    }
  }
  console.log(`Created costing ${costingId}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
