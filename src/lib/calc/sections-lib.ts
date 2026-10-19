import { IS1239_OD, IS1239_WALL, PIPE_OD, PIPE_WALL, STRUCTURAL, SWG } from "./data/sections";
import { DEFAULT_KINDS, type BoughtKind } from "./bought-catalogue";

// The section and pipe tables the engine reads. In the app it is built from the
// database (Settings → Section tables, where sizes can be edited and added); the
// built-in tables are its starting data and the fallback in tests.

export interface PipeSize {
  od: number;
  wall: number;
}

export interface SectionLibrary {
  /** Rolled sections by series (ISA, ISMC, …), size → kg/m for MS. */
  kgPerM: Record<string, Record<string, number>>;
  /** Pipe schedules: schedule → NB → OD and wall. */
  pipeSch: Record<string, Record<string, PipeSize>>;
  /** IS 1239 classes: L / M / H → NB → OD and wall. */
  is1239: Record<string, Record<string, PipeSize>>;
  /** Gauge → thickness mm. */
  swg: Record<string, number>;
  /** Bought-out catalogue kinds (built-in + added in Settings). */
  boughtKinds: BoughtKind[];
}

export type SectionKind = "kgPerM" | "pipeSch" | "is1239" | "swg";

/** Database series name → which table it belongs to. */
export function kindOf(series: string): { kind: SectionKind; key: string } {
  if (series.startsWith("PIPE-SCH-")) return { kind: "pipeSch", key: series.slice(9) };
  if (series.startsWith("PIPE-IS1239-")) return { kind: "is1239", key: series.slice(12) };
  if (series === "SWG") return { kind: "swg", key: "SWG" };
  return { kind: "kgPerM", key: series };
}

export interface SectionRow {
  series: string;
  size: string;
  data: Record<string, number>;
}

export function libraryFromRows(rows: SectionRow[], boughtKinds: BoughtKind[] = DEFAULT_KINDS): SectionLibrary {
  const lib: SectionLibrary = { kgPerM: {}, pipeSch: {}, is1239: {}, swg: {}, boughtKinds };
  for (const r of rows) {
    const { kind, key } = kindOf(r.series);
    if (kind === "kgPerM") {
      if (r.data.kgPerM > 0) (lib.kgPerM[key] ??= {})[r.size] = r.data.kgPerM;
    } else if (kind === "swg") {
      if (r.data.thk > 0) lib.swg[String(r.data.gauge)] = r.data.thk;
    } else if (r.data.od > 0 && r.data.wall > 0) {
      (lib[kind][key] ??= {})[String(r.data.nb)] = { od: r.data.od, wall: r.data.wall };
    }
  }
  return lib;
}

/** Built-in tables as database rows (also used to seed the database). */
export function builtInSectionRows(): SectionRow[] {
  const rows: SectionRow[] = [];
  for (const [sch, walls] of Object.entries(PIPE_WALL)) {
    for (const [nb, wall] of Object.entries(walls)) {
      rows.push({ series: `PIPE-SCH-${sch}`, size: `${nb} NB`, data: { nb: Number(nb), od: PIPE_OD[Number(nb)], wall } });
    }
  }
  for (const [cls, walls] of Object.entries(IS1239_WALL)) {
    for (const [nb, wall] of Object.entries(walls)) {
      rows.push({ series: `PIPE-IS1239-${cls}`, size: `${nb} NB`, data: { nb: Number(nb), od: IS1239_OD[Number(nb)], wall } });
    }
  }
  for (const [gauge, thk] of Object.entries(SWG)) rows.push({ series: "SWG", size: `${gauge} SWG`, data: { gauge: Number(gauge), thk } });
  for (const [series, sizes] of Object.entries(STRUCTURAL)) {
    for (const [size, kgPerM] of Object.entries(sizes)) rows.push({ series, size, data: { kgPerM } });
  }
  return rows;
}

export const BUILT_IN_LIBRARY: SectionLibrary = libraryFromRows(builtInSectionRows());

/** Natural sort for size labels: "25x25x3" < "100x100x8", "15 NB" < "100 NB". */
export const bySize = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
