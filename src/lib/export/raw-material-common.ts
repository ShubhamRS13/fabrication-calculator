import { rawMaterialList, RM_GROUP_ORDER, type RawMaterialList, type RmGroup, type RmRow } from "../calc/raw-material";
import { formatDate } from "../format";
import type { ExportData } from "./common";

// Shared by the raw material Excel and PDF, so both list the same things.

export const LENGTH_GROUPS: RmGroup[] = ["pipe", "flat", "section"];
export const WEIGHED_GROUPS: RmGroup[] = ["sheet", "pipe", "flat", "section", "other"];

export interface RmExport {
  list: RawMaterialList;
  groups: { group: RmGroup; rows: RmRow[] }[];
  /** Header lines: [label, value], blanks left out. */
  info: [string, string][];
}

export function rmExport(data: ExportData): RmExport {
  const list = rawMaterialList(data.input, data.result);
  const groups = RM_GROUP_ORDER.map((group) => ({ group, rows: list.rows.filter((r) => r.group === group) })).filter((g) => g.rows.length > 0);
  const { header } = data;
  const info: [string, string][] = (
    [
      ["Client", header.clientName],
      ["Project", header.projectName],
      ["PO no.", header.poNo],
      ["Drawing ref.", header.drawingRef],
      ["Costing date", header.costingDate ? formatDate(header.costingDate) : ""],
      ["Prepared by", header.createdBy],
    ] as [string, string][]
  ).filter(([, v]) => v);
  return { list, groups, info };
}

export const RM_NOTE =
  "Quantities include item qty × assembly qty. Sheets: buy kg = process (sheet rectangle) + burning. Pipes, flats and sections: total cut length.";

export const skippedNote = (n: number) => `${n} item${n === 1 ? "" : "s"} not included — fix the error in the app to add ${n === 1 ? "it" : "them"}:`;
