import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { rmBuy, rmSizeNote, RM_GROUP_LABEL, type RmGroup, type RmRow } from "../calc/raw-material";
import { kg, num } from "../format";
import type { ExportData } from "./common";
import { bold, heading, headRow, MISSING, MUTED, pageFrame, RED, right, table, withProps, type Row } from "./pdf";
import { LENGTH_GROUPS, RM_NOTE, rmExport, skippedNote, WEIGHED_GROUPS } from "./raw-material-common";

// Raw material PDF (RM.3): the same list as the Excel workbook — what to buy, by
// group — then the piece list behind it. A4 portrait, company letterhead.

const mFmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const metres = (x: number) => mFmt.format(x);
const mm = (x: number) => num(Math.round(x));
/** A little space after a right-aligned number column. */
const GAP: [number, number, number, number] = [6, 0, 0, 0];

const buyText = (r: RmRow) => {
  const b = rmBuy(r);
  return b.unit === "kg" ? kg(b.qty) : b.unit === "m" ? metres(b.qty) : num(b.qty);
};

function listTable(group: RmGroup, rows: RmRow[], startSr: number): Content {
  const weighed = WEIGHED_GROUPS.includes(group);
  const body: Row[] = [
    headRow(["Sr", "Material", "Item / size", "Qty to buy", "Unit", "Pieces", "Largest / longest", "Buy kg", "Used in"], 3, [4, 6, 8]).map((c, i) =>
      i === 4 || i === 6 || i === 8 ? withProps(c, { margin: GAP }) : c,
    ),
    ...rows.map((r, i): Row => [
      String(startSr + i),
      r.material,
      { text: r.label, bold: true },
      right(buyText(r), { bold: true }),
      { text: rmBuy(r).unit, margin: GAP },
      right(num(r.pieces)),
      { text: rmSizeNote(r, mm), margin: GAP },
      right(weighed ? kg(r.buyKg) : ""),
      { text: r.drawings.join(", "), fontSize: 6.5, margin: GAP },
    ]),
  ];
  if (weighed) body.push(bold(["", "", "Total", "", "", "", "", right(kg(rows.reduce((a, r) => a + r.buyKg, 0))), ""]));
  return table([16, 34, "*", 52, 24, 30, 84, 50, 88], body, weighed);
}

function pieceTable(group: RmGroup, rows: RmRow[]): Content {
  const sheet = group === "sheet";
  const length = LENGTH_GROUPS.includes(group);
  const sizeHead = sheet ? "W × L mm" : length ? "Cut length mm" : "";
  const body: Row[] = [
    headRow(["Material · size", sizeHead, "Qty", "Total m", "kg", "Drawing", "Item"], 1, [5, 6]).map((c, i) => (i === 5 ? withProps(c, { margin: GAP }) : c)),
  ];
  for (const r of rows) {
    r.lines.forEach((l, i) => {
      body.push([
        i === 0 ? { text: `${r.material} · ${r.label}`, bold: true } : "",
        right(sheet ? `${mm(l.w ?? 0)} × ${mm(l.l ?? 0)}` : length ? mm(l.lengthMm ?? 0) : ""),
        right(num(l.qty)),
        right(length && l.lengthMm ? metres((l.lengthMm * l.qty) / 1000) : ""),
        right(l.kg ? kg(l.kg) : ""),
        { text: l.drawingNo, margin: GAP },
        `${l.itemNo ? `${l.itemNo} · ` : ""}${l.itemName}${l.assembly ? ` (${l.assembly})` : ""}`,
      ]);
    });
  }
  return table(["*", 70, 30, 44, 50, 70, 120], body);
}

export function buildRawMaterialPdf(data: ExportData): TDocumentDefinitions {
  const rm = rmExport(data);
  const footerText = [data.header.clientName, data.header.projectName].filter(Boolean).join(" · ");
  const content: Content[] = [
    { text: "Raw material list", style: "h1" },
    {
      table: { widths: [70, "*"], body: rm.info.map(([k, v]) => [{ text: k, bold: true }, v]) },
      layout: "noBorders",
      margin: [0, 0, 0, 4],
    } as Content,
    { text: RM_NOTE, italics: true, color: MUTED, margin: [0, 0, 0, 10] },
  ];

  if (rm.list.skipped.length) {
    content.push({
      table: {
        widths: ["*"],
        body: [
          [{ text: skippedNote(rm.list.skipped.length), bold: true, color: RED }],
          [{ text: rm.list.skipped.map((s) => `•  ${s.drawingNo} · ${s.itemNo ? `${s.itemNo} ` : ""}${s.itemName} — ${s.error}`).join("\n"), color: RED }],
        ],
      },
      layout: { fillColor: () => MISSING, hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 6, paddingTop: () => 3, paddingBottom: () => 3 },
      margin: [0, 0, 0, 10],
    } as Content);
  }

  if (rm.groups.length === 0) {
    content.push({ text: "No items yet.", color: MUTED });
  } else {
    content.push(heading("To buy", { margin: [0, 0, 0, 4] }));
    content.push(
      table(
        [120, 40, 70, 70, "*"],
        [
          headRow(["Group", "Lines", "Buy kg", "Total m", ""], 1),
          ...rm.groups.map(({ group, rows }): Row => [
            RM_GROUP_LABEL[group],
            right(String(rows.length)),
            right(WEIGHED_GROUPS.includes(group) ? kg(rows.reduce((a, r) => a + r.buyKg, 0)) : ""),
            right(LENGTH_GROUPS.includes(group) ? metres(rows.reduce((a, r) => a + r.lengthM, 0)) : ""),
            "",
          ]),
        ],
      ),
    );
    let sr = 1;
    for (const { group, rows } of rm.groups) {
      content.push(heading(RM_GROUP_LABEL[group], { margin: [0, 12, 0, 4] }));
      content.push(listTable(group, rows, sr));
      sr += rows.length;
    }

    content.push({ text: "Piece list", style: "h1", pageBreak: "before" });
    content.push({ text: "Every sheet piece and cut length behind the list above.", color: MUTED, margin: [0, 0, 0, 6] });
    for (const { group, rows } of rm.groups) {
      content.push(heading(RM_GROUP_LABEL[group], { margin: [0, 10, 0, 4] }));
      content.push(pieceTable(group, rows));
    }
  }

  return {
    ...pageFrame(data, { title: `Raw material — ${footerText}`, footer: `Raw material · ${footerText}`, orientation: "portrait" }),
    content,
  };
}
