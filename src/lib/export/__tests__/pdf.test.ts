import { describe, expect, it } from "vitest";
import { inr, kg } from "../../format";
import { buildCostingPdf } from "../pdf";
import { costingPdfBuffer } from "../pdf-render";
import { costing, exportData } from "./fixture";

// The PDF shows the engine's numbers as text. Check the document holds them, then
// that pdfmake prints it.

/** Every piece of text in a pdfmake document definition, in order. */
function texts(node: unknown, out: string[] = []): string[] {
  if (typeof node === "string") out.push(node);
  else if (Array.isArray(node)) node.forEach((n) => texts(n, out));
  else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) if (["text", "stack", "columns", "table", "body", "content"].includes(k)) texts(v, out);
  }
  return out;
}

describe("PDF export", () => {
  const data = exportData(costing());
  const doc = buildCostingPdf(data);
  const all = texts(doc.content);

  it("summary: header, missing rates, drawing totals, grand total", () => {
    expect(all).toContain("Costing summary");
    expect(all).toContain("TEST Client");
    expect(all.some((t) => t.startsWith(`Rates missing (${data.result.missing.length})`))).toBe(true);
    for (const m of data.result.missing) expect(all.join("\n")).toContain(`•  ${m.label}`);
    for (const d of data.result.drawings) expect(all).toContain(inr(d.total));
    expect(all).toContain(inr(data.result.subtotal));
    expect(all).toContain(inr(data.result.profit));
    expect(all).toContain(inr(data.result.grandTotal));
  });

  it("one section per drawing with every item's size, weights and cost", () => {
    for (const d of data.result.drawings) {
      expect(all).toContain(`Drawing ${d.drawing.drawingNo} — ${d.drawing.title}`);
      for (const it of d.items) {
        expect(all).toContain(it.item.name);
        if (!it.unit) continue;
        expect(all).toContain(inr(it.materialAmount + it.fixedAmount));
        if (it.unit.costedByWeight) expect(all).toContain(kg(it.processWt));
      }
      expect(all).toContain(inr(d.materialTotal));
      expect(all).toContain(inr(d.chargesTotal));
    }
    expect(all).toContain("10 THK × 400 × 500");
    expect(all).toContain("50 NB SCH 10S × 3000 L");
    expect(all).toContain("Plate / sheet (rectangular) · Frame × 2");
    expect(all.some((t) => t.startsWith("Error: "))).toBe(true);
  });

  it("rates page lists the price rows", () => {
    expect(all).toContain("Rates");
    for (const p of data.result.prices) expect(all).toContain(p.label);
  });

  it("prints with pdfmake", async () => {
    const pdf = await costingPdfBuffer(data);
    expect(Buffer.from(pdf.subarray(0, 5)).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5000);
  });
});
