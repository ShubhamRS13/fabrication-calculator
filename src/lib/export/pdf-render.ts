import pdfMake from "pdfmake";
import Roboto from "pdfmake/fonts/Roboto";
import type { ExportData } from "./common";
import { buildCostingPdf } from "./pdf";
import { buildRawMaterialPdf } from "./raw-material-pdf";

// Prints the costing PDF with pdfmake (Node only). pdfmake is a server external
// package (next.config.ts), so its bundled Roboto font files load from node_modules.

export async function costingPdfBuffer(data: ExportData): Promise<Uint8Array> {
  pdfMake.setFonts(Roboto);
  // Everything the document needs is inline (the logo is a data URL): no downloads.
  pdfMake.setUrlAccessPolicy(() => false);
  const buf = await pdfMake.createPdf(buildCostingPdf(data)).getBuffer();
  return new Uint8Array(buf);
}

export async function rawMaterialPdfBuffer(data: ExportData): Promise<Uint8Array> {
  pdfMake.setFonts(Roboto);
  pdfMake.setUrlAccessPolicy(() => false);
  const buf = await pdfMake.createPdf(buildRawMaterialPdf(data)).getBuffer();
  return new Uint8Array(buf);
}
