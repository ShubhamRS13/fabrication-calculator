import type { NextRequest } from "next/server";
import { costingWorkbookBuffer } from "@/lib/export/excel";
import { download, loadExportData } from "@/server/export-data";

/** Download the costing as an Excel workbook (Summary, one sheet per drawing, Rates). */
export async function GET(_req: NextRequest, ctx: RouteContext<"/costings/[id]/export/excel">) {
  const { id } = await ctx.params;
  const data = await loadExportData(id);
  if (!data) return new Response("Costing not found", { status: 404 });
  return download(await costingWorkbookBuffer(data), data, "xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}
