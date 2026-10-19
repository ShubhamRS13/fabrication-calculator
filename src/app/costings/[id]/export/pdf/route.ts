import type { NextRequest } from "next/server";
import { costingPdfBuffer } from "@/lib/export/pdf-render";
import { download, loadExportData } from "@/server/export-data";

/** Download the costing as a PDF (Summary, one section per drawing, Rates). */
export async function GET(_req: NextRequest, ctx: RouteContext<"/costings/[id]/export/pdf">) {
  const { id } = await ctx.params;
  const data = await loadExportData(id);
  if (!data) return new Response("Costing not found", { status: 404 });
  return download(await costingPdfBuffer(data), data, "pdf", "application/pdf");
}
