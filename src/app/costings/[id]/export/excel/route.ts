import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { costingWorkbookBuffer, exportFileName } from "@/lib/export/excel";
import { getComputedCosting, getSettings } from "@/server/queries";

/** Download the costing as an Excel workbook (Summary, one sheet per drawing, Rates). */
export async function GET(_req: NextRequest, ctx: RouteContext<"/costings/[id]/export/excel">) {
  const { id } = await ctx.params;
  const [data, company] = await Promise.all([getComputedCosting(id), getSettings()]);
  if (!data) return new Response("Costing not found", { status: 404 });

  const c = data.tree.costing;
  const header = {
    clientName: c.clientName,
    projectName: c.projectName,
    poNo: c.poNo,
    drawingRef: c.drawingRef,
    createdBy: c.createdBy,
    costingDate: String(c.costingDate),
  };
  const body = await costingWorkbookBuffer({
    company,
    header,
    input: data.input,
    result: data.result,
    logo: await readLogo(company.logoPath),
  });
  const name = exportFileName(header, "xlsx");
  return new Response(body as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}

/** The letterhead logo from /public; the export still works without it. */
async function readLogo(logoPath: string): Promise<Uint8Array | undefined> {
  const root = path.join(process.cwd(), "public");
  const file = path.join(root, logoPath);
  if (!file.startsWith(root + path.sep) || !file.toLowerCase().endsWith(".png")) return undefined;
  try {
    return await readFile(file);
  } catch {
    return undefined;
  }
}
