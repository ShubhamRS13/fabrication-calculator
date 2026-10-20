import type { NextRequest } from "next/server";
import { rawMaterialWorkbookBuffer } from "@/lib/export/raw-material-excel";
import { download, loadExportData } from "@/server/export-data";

/** Download the raw material list as an Excel workbook (Raw material, Pieces). */
export async function GET(_req: NextRequest, ctx: RouteContext<"/costings/[id]/export/raw-material-excel">) {
  const { id } = await ctx.params;
  const data = await loadExportData(id);
  if (!data) return new Response("Costing not found", { status: 404 });
  return download(
    await rawMaterialWorkbookBuffer(data),
    data,
    "xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Raw material",
  );
}
