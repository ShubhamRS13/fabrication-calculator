// The named LAMBDAs from "Punch Line System.xlsx", transcribed verbatim
// so the engine can be checked against the workbook's method.
const PI = Math.PI;

export const SHEET_OR_PLATE = (length: number, width: number, thk: number, qty: number, density: number) =>
  (length * width * thk * qty * density) / 1e6;
export const FLANGE_SQUARE = SHEET_OR_PLATE;
export const CIRCLE_SHEET = (od: number, thk: number, qty: number, density: number) =>
  ((PI * od ** 2) / 4) * thk * qty * density / 1e6;
export const FLANGE_CRICLE = (od: number, id: number, thk: number, qty: number, density: number) =>
  (PI * ((od / 2) ** 2 - (id / 2) ** 2) * thk * qty * density) / 1e6;
export const PIPE = (od: number, length: number, thk: number, qty: number, density: number) =>
  (PI * thk * length * (od - thk) * qty * density) / 1e6;
export const ROD = (diameter: number, length: number, density: number, qty: number) =>
  ((PI * diameter ** 2) / 4) * length * qty * density / 1e6;
export const ANGLE = (length: number, width: number, thk: number, qty: number, density: number) =>
  (width * 2 * length * thk * qty * density) / 1e6;
export const CONE_FULCRUM_ARC = (degree: number, r1: number, r2: number, thk: number, qty: number, density: number) =>
  ((PI * degree) / 360) * (r1 ** 2 - r2 ** 2) * thk * qty * density / 1e6;
