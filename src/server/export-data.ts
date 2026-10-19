import { readFile } from "node:fs/promises";
import path from "node:path";
import { exportFileName, type ExportData } from "@/lib/export/common";
import { getComputedCosting, getSettings } from "./queries";

/** Everything an export needs: computed costing, company details, letterhead logo. */
export async function loadExportData(id: string): Promise<ExportData | null> {
  const [data, company] = await Promise.all([getComputedCosting(id), getSettings()]);
  if (!data) return null;
  const c = data.tree.costing;
  return {
    company,
    header: {
      clientName: c.clientName,
      projectName: c.projectName,
      poNo: c.poNo,
      drawingRef: c.drawingRef,
      createdBy: c.createdBy,
      costingDate: String(c.costingDate),
    },
    input: data.input,
    result: data.result,
    logo: await readLogo(company.logoPath),
  };
}

/** A file download response with a safe file name. */
export function download(body: Uint8Array, data: ExportData, ext: string, contentType: string): Response {
  const name = exportFileName(data.header, ext);
  return new Response(body as BodyInit, {
    headers: {
      "Content-Type": contentType,
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
