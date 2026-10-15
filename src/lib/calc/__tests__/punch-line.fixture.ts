// Rows from "Punch Line System.xlsx" re-entered as app items.
// `wb` holds the value the workbook shows; `status` says how the app compares:
//   match   – workbook used a formula; app must reproduce it exactly
//   check   – matches only with an assumption we need Shubham to confirm (see note)
//   typed   – workbook weight was typed by hand; app computes it from a formula
//   fixed   – workbook formula is wrong; app gives the corrected value
//   missing – workbook has no weight at all; app fills it in
//   bought  – bought item, priced qty × rate, no weight
// The workbook uses density 8 for every SS grade (incl. SS202), so the check runs at 8.

export type GoldenStatus = "match" | "check" | "typed" | "fixed" | "missing" | "bought";

export interface GoldenRow {
  tab: string;
  row: number;
  name: string;
  qty: number;
  type: string;
  inputs: Record<string, number | string | boolean>;
  wb?: { process?: number; finish?: number };
  status: GoldenStatus;
  note?: string;
}

const SH = "Storage Hopper";
const PH = "Pickup Hopper";
const ST = "Structure";
const BF = "Bag Filter";

export const GOLDEN_ROWS: GoldenRow[] = [
  // ---------- Storage Hopper ----------
  { tab: SH, row: 11, name: "GASKET", qty: 1, type: "bought-misc", inputs: {}, status: "bought" },
  { tab: SH, row: 12, name: "PAD PLATE", qty: 4, type: "plate", inputs: { length: 160, width: 200, thk: 3 }, wb: { process: 3.072 }, status: "match" },
  { tab: SH, row: 13, name: "PLATE", qty: 1, type: "plate", inputs: { length: 3194, width: 1598, thk: 3 }, wb: { process: 122.496288 }, status: "match" },
  { tab: SH, row: 14, name: "PLATE", qty: 1, type: "plate", inputs: { length: 425, width: 5015, thk: 3 }, wb: { process: 51.153 }, status: "match" },
  { tab: SH, row: 15, name: "PLATE", qty: 1, type: "plate", inputs: { length: 848, width: 72, thk: 3 }, wb: { process: 1.465344 }, status: "match" },
  { tab: SH, row: 16, name: "PLATE", qty: 1, type: "plate", inputs: { length: 2660, width: 72, thk: 3 }, wb: { process: 4.59648 }, status: "match" },
  { tab: SH, row: 17, name: "PLATE", qty: 3, type: "plate", inputs: { length: 200, width: 50, thk: 3 }, wb: { process: 0.72 }, status: "match" },
  { tab: SH, row: 18, name: "PLATE", qty: 1, type: "plate", inputs: { length: 947, width: 150, thk: 3 }, wb: { process: 3.4092 }, status: "match" },
  { tab: SH, row: 19, name: "PLATE", qty: 1, type: "plate", inputs: { length: 949, width: 150, thk: 3 }, wb: { process: 3.4164 }, status: "match" },
  { tab: SH, row: 20, name: "PIPE 80 NB SCH 10S", qty: 1, type: "pipe-sch", inputs: { nb: "80", sch: "10S", length: 722 }, wb: { process: 3.8 }, status: "typed", note: "Typed 3.8 kg; 80 NB SCH 10S (OD 88.9 × 3.05) is about 6.6 kg/m, so 722 mm ≈ 4.75 kg" },
  { tab: SH, row: 21, name: "PLATE (OD 1704)", qty: 1, type: "disc", inputs: { dia: 1704, thk: 5 }, wb: { finish: 91.21978694 }, status: "match", note: "Workbook puts the disc weight in Process; app process is the 1704 × 1704 square sheet" },
  { tab: SH, row: 22, name: "ANGLE", qty: 2, type: "angle-custom", inputs: { width: 75, thk: 6, length: 300 }, wb: { process: 4.32 }, status: "match" },
  { tab: SH, row: 23, name: "FLAT (FOR FLANGE)", qty: 1, type: "ring-flange", inputs: { od: 412, id: 314, thk: 6 }, wb: { process: 8.147712 }, status: "match", note: "Ring flange from flat; process = OD × OD square as in the workbook" },
  { tab: SH, row: 24, name: "PLATE (CIRCULAR)", qty: 1, type: "disc", inputs: { dia: 412, thk: 6 }, wb: { process: 8.147712, finish: 6.399198041 }, status: "match" },
  { tab: SH, row: 25, name: "FLAT", qty: 1, type: "flat", inputs: { width: 50, thk: 10, length: 2834 }, wb: { process: 11.336 }, status: "match" },
  { tab: SH, row: 26, name: "PLATE", qty: 3, type: "plate", inputs: { length: 150, width: 75, thk: 10 }, wb: { process: 2.7 }, status: "match" },
  { tab: SH, row: 27, name: "RIB PLATE", qty: 4, type: "plate", inputs: { length: 149, width: 106, thk: 10 }, wb: { process: 5.05408 }, status: "match" },
  { tab: SH, row: 28, name: "FLANGE (std 80 NB)", qty: 1, type: "ring-flange", inputs: { od: 191, id: 91, thk: 12 }, wb: { finish: 2.126229908 }, status: "match", note: "Workbook puts the ring weight in Process; app process is the 191 × 191 square" },
  { tab: SH, row: 29, name: "FLANGE (std)", qty: 1, type: "ring-flange", inputs: { od: 407, id: 276, thk: 12 }, wb: { finish: 6.746105268 }, status: "match" },
  { tab: SH, row: 30, name: "PLATE (FOR BASE)", qty: 4, type: "plate", inputs: { length: 170, width: 149, thk: 12 }, wb: { process: 9.72672 }, status: "match" },
  { tab: SH, row: 31, name: "HEX NUT BOLT WITH WASHER M12 x 30", qty: 8, type: "bought-misc", inputs: {}, status: "bought" },
  { tab: SH, row: 32, name: "ISRO (HANDLE) OD 10 x 300 LONG", qty: 2, type: "round-bar", inputs: { dia: 10, length: 300 }, wb: { process: 0.5 }, status: "typed", note: "Typed 0.5 kg; two Ø10 × 300 bars weigh 0.38 kg. Could also be entered as a bought handle" },
  { tab: SH, row: 33, name: 'SOCKET 1" NPT (F)', qty: 2, type: "bought-misc", inputs: {}, status: "bought" },

  // ---------- Pickup Hopper ----------
  { tab: PH, row: 11, name: "PAD PLATE", qty: 4, type: "plate", inputs: { length: 200, width: 176, thk: 3 }, wb: { process: 3.3792 }, status: "match" },
  { tab: PH, row: 12, name: "PLATE", qty: 1, type: "plate", inputs: { length: 530, width: 72, thk: 3 }, wb: { process: 0.91584 }, status: "match" },
  { tab: PH, row: 13, name: "PLATE", qty: 1, type: "plate", inputs: { length: 530, width: 72, thk: 3 }, wb: { process: 0.91584 }, status: "match" },
  { tab: PH, row: 14, name: "SHEET (cone plate)", qty: 1, type: "plate", inputs: { length: 2032, width: 1401, thk: 3 }, wb: { process: 68.323968 }, status: "match", note: "Entered as a sheet; with the cone's D1, D2 and height the app would give the development and finish weight" },
  { tab: PH, row: 15, name: "SHEET (DISH END PLATE)", qty: 1, type: "dished-end", inputs: { blankDia: 900, thk: 3 }, wb: { process: 19.44 }, status: "match" },
  { tab: PH, row: 16, name: "SHEET NICK PLATE", qty: 1, type: "plate", inputs: { length: 530, width: 57, thk: 3 }, wb: { process: 0.72504 }, status: "match" },
  { tab: PH, row: 17, name: "SHEET NICK PLATE", qty: 1, type: "plate", inputs: { length: 530, width: 72, thk: 3 }, wb: { process: 0.91584 }, status: "match" },
  { tab: PH, row: 18, name: "SHELL PLATE", qty: 1, type: "plate", inputs: { length: 2515, width: 500, thk: 3 }, wb: { process: 30.18 }, status: "match", note: "Entered as a sheet; as a Cylinder / shell the app would give π·Dm × H" },
  { tab: PH, row: 19, name: "PLATE", qty: 1, type: "plate", inputs: { length: 368, width: 240, thk: 5 }, status: "missing", note: "No weight in the workbook" },
  { tab: PH, row: 20, name: "ANGLE", qty: 2, type: "angle-custom", inputs: { width: 75, thk: 6, length: 250 }, wb: { process: 3.6 }, status: "match" },
  { tab: PH, row: 21, name: "ANGLE", qty: 2, type: "angle-custom", inputs: { width: 75, thk: 6, length: 270 }, wb: { process: 3.888 }, status: "match" },
  { tab: PH, row: 22, name: "BLIND FLANGE (std)", qty: 1, type: "disc", inputs: { dia: 280, thk: 6 }, wb: { finish: 2.955610368 }, status: "match" },
  { tab: PH, row: 23, name: "PLATE", qty: 3, type: "plate", inputs: { length: 170, width: 50, thk: 6 }, wb: { process: 1.224 }, status: "match" },
  { tab: PH, row: 24, name: "RIB PLATE", qty: 8, type: "plate", inputs: { length: 162, width: 146, thk: 6 }, wb: { process: 9.082368 }, status: "match" },
  { tab: PH, row: 25, name: "PLATE", qty: 3, type: "plate", inputs: { length: 150, width: 75, thk: 8 }, wb: { process: 2.16 }, status: "match" },
  { tab: PH, row: 26, name: "PLATE", qty: 6, type: "plate", inputs: { length: 110, width: 88, thk: 8 }, status: "missing", note: "No weight in the workbook" },
  { tab: PH, row: 27, name: "FLANGE (std)", qty: 1, type: "ring-flange", inputs: { od: 280, id: 171, thk: 10 }, wb: { finish: 4.926017281 }, status: "fixed", note: "Formula reads ID from empty cell N127, so the hole was never subtracted" },
  { tab: PH, row: 28, name: "FLANGE (std)", qty: 1, type: "ring-flange", inputs: { od: 280, id: 171, thk: 10 }, wb: { finish: 4.926017281 }, status: "fixed", note: "Same broken ID reference as row 27" },
  { tab: PH, row: 29, name: "PLATE (FOR BASE)", qty: 4, type: "plate", inputs: { length: 169, width: 150, thk: 10 }, wb: { process: 8.112 }, status: "match" },
  { tab: PH, row: 30, name: "BOLT M8 x 60", qty: 4, type: "bought-misc", inputs: {}, status: "bought" },
  { tab: PH, row: 31, name: "CHANNEL ISMC 125", qty: 1, type: "structural", inputs: { series: "ISMC", size: "125", length: 200 }, status: "missing", note: "No weight in the workbook; ISMC 125 = 12.7 kg/m (MS), scaled to SS density" },
  { tab: PH, row: 32, name: "NUT M8", qty: 4, type: "bought-misc", inputs: {}, status: "bought" },
  { tab: PH, row: 33, name: "NYLO LOCK NUT CLASS 8 M8", qty: 4, type: "bought-misc", inputs: {}, status: "bought" },
  { tab: PH, row: 34, name: "ROUND BAR", qty: 1, type: "round-bar", inputs: { dia: 10, length: 235 }, wb: { process: 0.1476548547 }, status: "match" },
  { tab: PH, row: 35, name: "ROUND BAR", qty: 1, type: "round-bar", inputs: { dia: 4, length: 515 }, wb: { process: 0.05177344693 }, status: "match" },
  { tab: PH, row: 36, name: "ROUND BAR", qty: 1, type: "round-bar", inputs: { dia: 4, length: 545 }, status: "missing", note: "No weight in the workbook" },
  { tab: PH, row: 37, name: 'SOCKET 1" NPT', qty: 2, type: "bought-misc", inputs: {}, status: "bought" },
  { tab: PH, row: 38, name: "SPRING WASHER OD 8", qty: 4, type: "bought-misc", inputs: {}, status: "bought" },
  { tab: PH, row: 39, name: "WASHER PLAIN OD 8", qty: 8, type: "bought-misc", inputs: {}, status: "bought" },

  // ---------- Structure (selection; SS202 at the workbook's density 8) ----------
  { tab: ST, row: 11, name: "FLAT", qty: 3, type: "flat", inputs: { width: 50, thk: 6, length: 1996 }, status: "missing", note: "No weight in the workbook" },
  { tab: ST, row: 12, name: "FLAT", qty: 2, type: "flat", inputs: { width: 50, thk: 6, length: 2116 }, wb: { process: 10.1568 }, status: "match" },
  { tab: ST, row: 14, name: "SQ TUBE (150X150)", qty: 2, type: "rect-tube", inputs: { a: 150, b: 150, thk: 3, length: 4697 }, wb: { finish: 132.568128 }, status: "match", note: "Typed std kg/m 14.112 = 2·t·(A+B−2t)·8/1000 exactly" },
  { tab: ST, row: 15, name: "CHQ PLATE", qty: 1, type: "plate", inputs: { length: 3005, width: 2665, thk: 4, thkAllowance: 0.5 }, wb: { process: 288.2997 }, status: "match", note: "Chequered plate: THK + 0.5" },
  { tab: ST, row: 16, name: "CHQ PLATE", qty: 1, type: "plate", inputs: { length: 3119, width: 2665, thk: 4, thkAllowance: 0.5 }, wb: { process: 299.23686 }, status: "match" },
  { tab: ST, row: 17, name: "PLATE", qty: 2, type: "plate", inputs: { length: 130, width: 40, thk: 4, thkAllowance: 0.5 }, wb: { process: 0.3744 }, status: "check", note: "Plain plate but the workbook adds 0.5 mm (copied from the CHQ row?)" },
  { tab: ST, row: 18, name: "ROUND BAR", qty: 4, type: "round-bar", inputs: { dia: 20, length: 600 }, wb: { process: 6.031857895 }, status: "match" },
  { tab: ST, row: 19, name: "ROUND BAR", qty: 16, type: "round-bar", inputs: { dia: 20, length: 400 }, wb: { process: 16.08495439 }, status: "match" },
  { tab: ST, row: 20, name: "ROUND BAR", qty: 13, type: "round-bar", inputs: { dia: 20, length: 400 }, status: "missing", note: "No weight in the workbook" },
  { tab: ST, row: 22, name: "FLAT", qty: 5, type: "flat", inputs: { width: 50, thk: 6, length: 2227 }, wb: { process: 26.724 }, status: "match" },
  { tab: ST, row: 23, name: "CHQ PLATE", qty: 1, type: "plate", inputs: { length: 3000, width: 2665, thk: 4, thkAllowance: 0.5 }, wb: { process: 287.82 }, status: "match" },
  { tab: ST, row: 24, name: "PIPE 20 NB CLASS B", qty: 2, type: "pipe-is1239", inputs: { nb: "20", cls: "M", length: 2700 }, wb: { process: 8.54 }, status: "typed", note: "Typed 4.27 × 2; IS 1239 Medium 20 NB gives 1.59 kg/m at density 8" },
  { tab: ST, row: 25, name: "PLATE", qty: 2, type: "plate", inputs: { length: 40, width: 40, thk: 4, thkAllowance: 0.5 }, wb: { process: 0.1152 }, status: "check", note: "Plain plate but the workbook adds 0.5 mm" },
  { tab: ST, row: 26, name: "PLATE", qty: 37, type: "plate", inputs: { length: 100, width: 40, thk: 6 }, wb: { process: 7.104 }, status: "match" },
  { tab: ST, row: 28, name: "FLAT", qty: 1, type: "flat", inputs: { width: 80, thk: 6, length: 22000 }, wb: { process: 84.48 }, status: "match" },
  { tab: ST, row: 32, name: "ELBOW 20 NB 90°", qty: 4, type: "bought-misc", inputs: {}, status: "bought" },
  { tab: ST, row: 35, name: "SQ TUBE (150X100)", qty: 2, type: "rect-tube", inputs: { a: 150, b: 100, thk: 3, length: 2377 }, wb: { finish: 55.678848 }, status: "match" },
  { tab: ST, row: 36, name: "FLAT", qty: 2, type: "plate", inputs: { length: 2210, width: 65, thk: 8, thkAllowance: 0.5 }, wb: { process: 19.5364 }, status: "check", note: "Flat but the workbook adds 0.5 mm" },
  { tab: ST, row: 45, name: "SQ TUBE (100X100)", qty: 2, type: "rect-tube", inputs: { a: 100, b: 100, thk: 3, length: 2475 }, wb: { finish: 46.0944 }, status: "match" },
  { tab: ST, row: 52, name: "SQ TUBE (80X80)", qty: 1, type: "rect-tube", inputs: { a: 80, b: 80, thk: 3, length: 936 }, wb: { finish: 6.918912 }, status: "match" },
  { tab: ST, row: 67, name: "SQ TUBE (200X100)", qty: 2, type: "rect-tube", inputs: { a: 200, b: 100, thk: 3, length: 5875 }, wb: { finish: 165.816 }, status: "match" },
  { tab: ST, row: 88, name: "ANGLE", qty: 2, type: "angle-custom", inputs: { width: 50, thk: 5, length: 1187 }, wb: { process: 9.496 }, status: "match" },
  { tab: ST, row: 106, name: "PIPE 20 NB SCH 80S", qty: 4, type: "pipe-sch", inputs: { nb: "20", sch: "80", length: 194 }, status: "missing", note: "No weight in the workbook" },

  // ---------- Bag Filter (selection) ----------
  { tab: BF, row: 11, name: "PLATE", qty: 1, type: "plate", inputs: { length: 650, width: 610, thk: 2 }, wb: { process: 6.344 }, status: "match" },
  { tab: BF, row: 19, name: "DISH PLATE", qty: 1, type: "dished-end", inputs: { blankDia: 1017, thk: 3 }, wb: { process: 24.822936, finish: 21.7 }, status: "typed", note: "Process matches; finish 21.7 was typed (app's flat-blank finish is 19.5)" },
  { tab: BF, row: 21, name: "SQ TUBE (50x50)", qty: 2, type: "rect-tube", inputs: { a: 50, b: 50, thk: 3, length: 700 }, wb: { process: 6.1 }, status: "typed" },
  { tab: BF, row: 22, name: "PIPE 101.6 (10 SWG)", qty: 1, type: "pipe-swg", inputs: { od: 101.6, swg: "10", length: 97 }, wb: { process: 0.8 }, status: "typed" },
  { tab: BF, row: 23, name: "HING BRACKET", qty: 4, type: "plate", inputs: { length: 171, width: 60, thk: 5 }, wb: { process: 1.64 }, status: "typed" },
  { tab: BF, row: 28, name: "BEND PLATE", qty: 2, type: "bent-plate", inputs: { girth: 60, length: 120, thk: 6 }, wb: { process: 0.7 }, status: "typed" },
  { tab: BF, row: 34, name: "BAG CLAMP", qty: 7, type: "plate", inputs: { length: 410, width: 40, thk: 10 }, wb: { process: 9.2 }, status: "typed" },
  { tab: BF, row: 35, name: "FLANGE (STD)", qty: 1, type: "ring-flange", inputs: { od: 228.5, id: 103, thk: 10 }, wb: { finish: 2.614009291 }, status: "match" },
  { tab: BF, row: 37, name: "SQUARE BAR", qty: 2, type: "square-bar", inputs: { side: 16, length: 340 }, wb: { process: 1.39264 }, status: "match" },
  { tab: BF, row: 38, name: "BOSS", qty: 2, type: "round-bar", inputs: { dia: 22, length: 50 }, wb: { process: 0.3 }, status: "typed" },
  { tab: BF, row: 39, name: "BOSS", qty: 2, type: "round-bar", inputs: { dia: 50, length: 50 }, wb: { process: 1.57 }, status: "typed" },
  { tab: BF, row: 40, name: "BAR", qty: 1, type: "round-bar", inputs: { dia: 10, length: 350 }, wb: { process: 0.2199114858 }, status: "match" },
  { tab: BF, row: 48, name: "PIPE 20 NB SCH 80", qty: 6, type: "pipe-sch", inputs: { nb: "20", sch: "80", length: 45 }, wb: { process: 0.59 }, status: "typed" },
  { tab: BF, row: 50, name: "PIPE 150 NB SCH 40", qty: 1, type: "pipe-sch", inputs: { nb: "150", sch: "40", length: 445 }, wb: { process: 12.6 }, status: "typed" },
];
