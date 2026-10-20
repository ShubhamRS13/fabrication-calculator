import type { NextRequest } from "next/server";
import { rawMaterialPdfBuffer } from "@/lib/export/pdf-render";
import { download, loadExportData } from "@/server/export-data";

/** Download the raw material list as a PDF (list by group, then the piece list). */
export async function GET(_req: NextRequest, ctx: RouteContext<"/costings/[id]/export/raw-material-pdf">) {
  const { id } = await ctx.params;
  const data = await loadExportData(id);
  if (!data) return new Response("Costing not found", { status: 404 });
  return download(await rawMaterialPdfBuffer(data), data, "pdf", "application/pdf", "Raw material");
}
