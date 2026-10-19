import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import type { DrawingOutput, ItemOutput } from "../calc/costing";
import { familyOf } from "../calc/materials";
import { formatDate, inr, kg, num } from "../format";
import { appliesToLabel, familySums, GROUP_LABEL, itemLabels, itemRate, missingNote, type ExportData } from "./common";

// Costing PDF (Milestone 4.2): the same content as the Excel workbook, as fixed
// values — Summary, one section per drawing, Rates. The document definition is
// built here (pure, testable); `costingPdfBuffer` in pdf-render.ts prints it.

const INK = "#1a1a1a";
const MUTED = "#6b6b6b";
const LINE = "#d9d9d9";
const HEAD = "#eef2f6";
const MISSING = "#fde2e2";
const RED = "#9b1c1c";

type Row = TableCell[];

const right = (text: string, extra: Record<string, unknown> = {}): TableCell => ({ text, alignment: "right", ...extra });
const kgCell = (v: number | null | undefined) => right(v === null || v === undefined ? "" : kg(v));
const inrCell = (v: number | null | undefined) => right(v === null || v === undefined ? "" : inr(v));
/** Add properties to a cell (plain text becomes { text }). */
function withProps(c: TableCell, props: Record<string, unknown>): TableCell {
  const base = typeof c === "object" && c !== null && !Array.isArray(c) ? c : { text: String(c ?? "") };
  return { ...base, ...props } as TableCell;
}
const bold = (cells: Row): Row => cells.map((c) => withProps(c, { bold: true }));
/** Header cells: right-aligned from column `rightFrom`, except the `left` ones. */
const headRow = (labels: string[], rightFrom: number, left: number[] = []): Row =>
  labels.map((t, i) => ({ text: t, bold: true, fillColor: HEAD, alignment: i >= rightFrom && !left.includes(i) ? "right" : "left" }));

/** Thin rules between rows, a firmer one under the header and above totals. */
const tableLayout = (totalRow: boolean) => ({
  hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
    i === 1 || (totalRow && i === node.table.body.length - 1) ? 0.8 : i === 0 || i === node.table.body.length ? 0 : 0.3,
  vLineWidth: () => 0,
  hLineColor: (i: number) => (i === 1 ? INK : LINE),
  paddingLeft: () => 2.5,
  paddingRight: () => 2.5,
  paddingTop: () => 2.5,
  paddingBottom: () => 2.5,
});

function table(widths: (number | string)[], body: Row[], totalRow = false, headerRows = 1): Content {
  return { table: { headerRows, widths, body }, layout: tableLayout(totalRow) } as Content;
}

const heading = (text: string, extra: Record<string, unknown> = {}): Content => ({ text, style: "h2", ...extra });

// ---------- Summary ----------

function summary(data: ExportData): Content[] {
  const { header, result, input } = data;
  const info: [string, string][] = [
    ["Client", header.clientName],
    ["Project", header.projectName],
    ["PO no.", header.poNo],
    ["Drawing ref.", header.drawingRef],
    ["Date", header.costingDate ? formatDate(header.costingDate) : ""],
    ["Prepared by", header.createdBy],
  ];
  const out: Content[] = [
    { text: "Costing summary", style: "h1" },
    {
      table: { widths: [70, "*"], body: info.filter(([, v]) => v).map(([k, v]) => [{ text: k, bold: true }, v]) },
      layout: "noBorders",
      margin: [0, 0, 0, 10],
    } as Content,
  ];
  if (result.missing.length) out.push(missingBox(data));

  const rows = result.drawings.map((d, i) => ({ d, s: familySums(d), i }));
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
  const cols: { label: string; get: (r: (typeof rows)[number]) => number; money?: boolean }[] = [
    { label: "SS process kg", get: (r) => r.s.ssProcess },
    { label: "SS scrap kg", get: (r) => r.s.ssScrap },
    { label: "MS process kg", get: (r) => r.s.msProcess },
    { label: "MS scrap kg", get: (r) => r.s.msScrap },
    { label: "Finish kg", get: (r) => r.s.finish },
    { label: "Material ₹", get: (r) => r.d.materialTotal, money: true },
    { label: "Charges ₹", get: (r) => r.d.chargesTotal, money: true },
    { label: "Bought ₹", get: (r) => r.d.boughtTotal, money: true },
    { label: "Total ₹", get: (r) => r.d.total, money: true },
  ];
  const cell = (col: (typeof cols)[number], v: number) => (col.money ? inrCell(v) : kgCell(v));
  out.push(
    table(
      [16, 70, "*", ...cols.map((c) => (c.money ? 68 : 56))],
      [
        headRow(["#", "Drawing", "Title", ...cols.map((c) => c.label)], 3),
        ...rows.map((r) => [String(r.i + 1), r.d.drawing.drawingNo, r.d.drawing.title, ...cols.map((c) => cell(c, c.get(r)))]),
        bold(["", "Total", "", ...cols.map((c) => cell(c, sum(c.get)))]),
      ],
      true,
    ),
  );

  out.push({
    columns: [
      { width: "*", text: "" },
      {
        width: 230,
        margin: [0, 12, 0, 0],
        table: {
          widths: ["*", 90],
          body: [
            ["Subtotal", inrCell(result.subtotal)],
            [`Profit ${num(input.profitPct)}%`, inrCell(result.profit)],
            [{ text: "Grand total", bold: true, fontSize: 11 }, right(inr(result.grandTotal), { bold: true, fontSize: 11 })],
          ],
        },
        layout: { hLineWidth: (i: number) => (i === 2 ? 0.8 : 0), vLineWidth: () => 0, paddingTop: () => 3, paddingBottom: () => 3 },
      },
    ],
  } as Content);
  out.push({ text: "GST and transport not included.", italics: true, color: MUTED, margin: [0, 10, 0, 0] });
  return out;
}

function missingBox(data: ExportData): Content {
  const { missing } = data.result;
  return {
    table: {
      widths: ["*"],
      body: [
        [{ text: missingNote(missing.length, "the Rates page in the app"), bold: true, color: RED }],
        [{ text: missing.map((m) => `•  ${m.label}`).join("\n"), color: RED }],
      ],
    },
    layout: { fillColor: () => MISSING, hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 6, paddingTop: () => 3, paddingBottom: () => 3 },
    margin: [0, 0, 0, 10],
  } as Content;
}

// ---------- Drawings ----------

function drawing(d: DrawingOutput, data: ExportData, labels: ReturnType<typeof itemLabels>): Content[] {
  const { header } = data;
  const asmById = new Map((d.drawing.assemblies ?? []).map((a) => [a.id, a]));
  const out: Content[] = [
    { text: `Drawing ${d.drawing.drawingNo}${d.drawing.title ? ` — ${d.drawing.title}` : ""}`, style: "h1", pageBreak: "before" },
    { text: [header.clientName, header.projectName, header.poNo && `PO ${header.poNo}`].filter(Boolean).join(" · "), color: MUTED, margin: [0, 0, 0, 8] },
  ];

  const itemRow = (it: ItemOutput): Row => {
    const asm = asmById.get(it.item.assemblyId ?? "");
    const sub = [labels.typeLabel(it.item.type), asm && `${asm.name} × ${num(asm.qty)}`].filter(Boolean).join(" · ");
    const name: TableCell = { stack: [{ text: it.item.name, bold: true }, { text: sub, color: MUTED, fontSize: 6.5 }] };
    const base: Row = [it.item.itemNo ?? "", name, it.material, labels.sizeOf(it), right(num(it.item.qty)), right(num(it.multiplier))];
    if (!it.unit || it.error) {
      return [...base, "", "", "", "", "", { text: `Error: ${it.error ?? "not computed"}`, color: RED, colSpan: 5 }, "", "", "", ""];
    }
    const w = it.unit.costedByWeight;
    const { rate, unit } = itemRate(it, data);
    const priced = [it.price?.label, it.job && `+ ${it.job.label}`].filter(Boolean).join(" ");
    return [
      ...base,
      kgCell(w ? it.finishWt : null),
      kgCell(w ? it.processWt : null),
      kgCell(w ? it.scrap : null),
      right(w ? num(it.burningPct) : ""),
      kgCell(w ? it.burning : null),
      priced,
      unit,
      inrCell(rate),
      inrCell(it.materialAmount + it.fixedAmount),
      inrCell(w ? it.scrapCredit : null),
    ];
  };
  const tint = (row: Row, on: boolean): Row => (on ? row.map((c) => withProps(c, { fillColor: MISSING })) : row);

  const weighed = d.items.filter((i) => i.unit?.costedByWeight);
  const t = (f: (i: ItemOutput) => number, items = weighed) => items.reduce((a, i) => a + f(i), 0);
  out.push(
    table(
      [14, "*", 32, 100, 18, 24, 38, 38, 34, 22, 32, 76, 20, 42, 56, 46],
      [
        headRow(["No", "Item", "Material", "Size", "Qty", "Total qty", "Finish kg", "Process kg", "Scrap kg", "Burn %", "Burning kg", "Priced as", "Unit", "Rate ₹", "Material cost ₹", "Scrap credit ₹"], 4, [11, 12]),
        ...d.items.map((it) => tint(itemRow(it), !!it.missing || !!it.error)),
        bold([
          "", "Total", "", "", "", "",
          kgCell(t((i) => i.finishWt)), kgCell(t((i) => i.processWt)), kgCell(t((i) => i.scrap)), "", kgCell(t((i) => i.burning)),
          "", "", "",
          inrCell(t((i) => i.materialAmount + i.fixedAmount, d.items)), inrCell(t((i) => i.scrapCredit, d.items)),
        ]),
      ],
      true,
    ),
  );

  // Cost by material, charges and the drawing total stay together.
  const blocks: Content[] = [
    heading("Cost by material", { margin: [0, 12, 0, 4] }),
    table(
      ["*", 60, 60, 60, 60, 80, 80, 80],
      [
        headRow(["Material", "Finish kg", "Process kg", "Scrap kg", "Burning kg", "Material cost ₹", "Scrap credit ₹", "Net ₹"], 1),
        ...d.byMaterial.map((m) => [m.material, kgCell(m.finish), kgCell(m.process), kgCell(m.scrap), kgCell(m.burning), inrCell(m.amount), inrCell(m.scrapCredit), inrCell(m.net)]),
        bold(["Material total", kgCell(d.byMaterial.reduce((a, m) => a + m.finish, 0)), "", "", "", "", "", inrCell(d.materialTotal)]),
      ],
      true,
    ),
    heading("Charges", { margin: [0, 10, 0, 4] }),
    table(
      ["*", 70, 90, 70, 70, 80],
      [
        headRow(["Charge", "Basis", "Applies to", "Weight kg", "Rate ₹/kg", "Amount ₹"], 3),
        ...d.charges.map((c) => [c.line.name, c.line.basis === "process" ? "Process wt" : "Finish wt", appliesToLabel(c.line.appliesTo), kgCell(c.weight), inrCell(c.line.rate), inrCell(c.amount)]),
        bold(["Charges total", "", "", "", "", inrCell(d.chargesTotal)]),
      ],
      true,
    ),
    {
      columns: [
        { width: "*", text: "" },
        {
          width: 260,
          margin: [0, 10, 0, 0],
          table: {
            widths: ["*", 90],
            body: [
              ["Material (net of scrap credit)", inrCell(d.materialTotal)],
              ["Charges", inrCell(d.chargesTotal)],
              ["Bought-outs & job work", inrCell(d.boughtTotal)],
              [{ text: "Drawing total", bold: true, fontSize: 10 }, right(inr(d.total), { bold: true, fontSize: 10 })],
            ],
          },
          layout: { hLineWidth: (i: number) => (i === 3 ? 0.8 : 0), vLineWidth: () => 0, paddingTop: () => 2.5, paddingBottom: () => 2.5 },
        },
      ],
    } as Content,
  ];
  out.push({ stack: blocks, unbreakable: true } as Content);
  return out;
}

// ---------- Rates ----------

function rates(data: ExportData): Content[] {
  const { input: c, result } = data;
  const used = new Set<string>();
  for (const d of result.drawings) for (const it of d.items) if (it.unit?.costedByWeight) used.add(it.material);
  const rateText = (v: number | null | undefined) => (v === null || v === undefined ? "" : inr(v));
  return [
    { text: "Rates", style: "h1", pageBreak: "before" },
    { text: "As entered on the costing's Rates page. A blank rate is missing; 0 means free.", color: MUTED, margin: [0, 0, 0, 8] },
    heading("Material rates", { margin: [0, 0, 0, 4] }),
    table(
      [90, 60, 80, 80, "*"],
      [
        headRow(["Material", "Family", "Rate ₹/kg", "Scrap ₹/kg", ""], 2),
        ...[...used].sort().map((m) => [m, familyOf(m), right(rateText(c.rates[m]?.rate)), right(rateText(c.rates[m]?.scrapRate)), ""]),
      ],
    ),
    heading("Prices", { margin: [0, 10, 0, 4] }),
    table(
      [80, 50, "*", 34, 64, 60, 50, 40, 90, 110],
      [
        headRow(["Priced as", "Material", "Item / size", "Unit", "Rate ₹", "Process kg", "Metres", "Pieces", "Drawings", "Note"], 4, [8, 9]),
        ...result.prices.map((p) => {
          const note = p.missing ? { text: "Rate missing", color: RED, bold: true } : p.rate === null ? "Blank: uses the material rate" : "";
          return [GROUP_LABEL[p.group], p.material, p.label, p.unit, right(rateText(p.rate)), right(p.kg ? kg(p.kg) : ""), right(p.m ? num(p.m) : ""), right(num(p.pieces)), p.drawings.join(", "), note];
        }),
      ],
    ),
    heading("Charge lines", { margin: [0, 10, 0, 4] }),
    table(
      [150, 70, 90, 80, "*"],
      [headRow(["Charge", "Basis", "Applies to", "Rate ₹/kg", ""], 3), ...c.chargeLines.map((l) => [l.name, l.basis === "process" ? "Process wt" : "Finish wt", appliesToLabel(l.appliesTo), right(rateText(l.rate)), ""])],
    ),
    { text: [{ text: "Profit  ", bold: true }, `${num(c.profitPct)}%`], margin: [0, 10, 0, 0] },
  ];
}

// ---------- Document ----------

export function buildCostingPdf(data: ExportData): TDocumentDefinitions {
  const { company, header } = data;
  const labels = itemLabels(data.input);
  const logo = data.logo ? `data:image/png;base64,${Buffer.from(data.logo).toString("base64")}` : undefined;
  const footerText = [header.clientName, header.projectName].filter(Boolean).join(" · ");
  return {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [28, 74, 28, 34],
    info: { title: `Costing — ${footerText}`, author: company.companyName, creator: company.companyName },
    defaultStyle: { font: "Roboto", fontSize: 7.5, color: INK },
    styles: {
      h1: { fontSize: 13, bold: true, margin: [0, 0, 0, 4] },
      h2: { fontSize: 10, bold: true },
    },
    images: logo ? { logo } : undefined,
    header: () =>
      ({
        margin: [28, 18, 28, 0],
        stack: [
          {
            columns: [
              logo ? { image: "logo", width: 40, height: 40 } : { text: "", width: 40 },
              {
                width: "*",
                alignment: "center",
                stack: [
                  { text: company.companyName, fontSize: 14, bold: true },
                  { text: company.address, fontSize: 8, color: MUTED },
                  { text: [company.phone && `Phone ${company.phone}`, company.email].filter(Boolean).join(" · "), fontSize: 8, color: MUTED },
                ],
              },
              { text: "", width: 40 },
            ],
          },
          { canvas: [{ type: "line", x1: 0, y1: 6, x2: 785.89, y2: 6, lineWidth: 1, lineColor: INK }] },
        ],
      }) as Content,
    footer: (page: number, pages: number) =>
      ({
        margin: [28, 10, 28, 0],
        columns: [
          { text: `Costing · ${footerText}`, color: MUTED, fontSize: 7 },
          { text: `Page ${page} of ${pages}`, alignment: "right", color: MUTED, fontSize: 7 },
        ],
      }) as Content,
    content: [...summary(data), ...data.result.drawings.flatMap((d) => drawing(d, data, labels)), ...rates(data)],
  };
}
