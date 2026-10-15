import { CalcError, type FieldDef, type ItemType } from "../types";
import { f, kg, optNum, pos, weightResult } from "../helpers";

const THK: FieldDef = { key: "thk", label: "THK", kind: "number", unit: "mm" };

export const plate: ItemType = {
  id: "plate",
  category: "fabricated",
  label: "Plate / sheet (rectangular)",
  fields: [
    { key: "length", label: "Length", kind: "number", unit: "mm" },
    { key: "width", label: "Width", kind: "number", unit: "mm" },
    THK,
  ],
  compute(inp, { density }) {
    const L = pos(inp, "length", "Length");
    const W = pos(inp, "width", "Width");
    const t = pos(inp, "thk", "THK");
    const wt = kg(L * W * t, density);
    return weightResult({
      finishWt: wt,
      processWt: wt,
      sheetL: L,
      sheetW: W,
      formula: `${f(L)} × ${f(W)} × ${f(t)} × ${f(density)} / 1e6 = ${f(wt)} kg`,
    });
  },
};

export const disc: ItemType = {
  id: "disc",
  category: "fabricated",
  label: "Circular disc / blank",
  fields: [{ key: "dia", label: "Diameter", kind: "number", unit: "mm" }, THK],
  compute(inp, { density }) {
    const D = pos(inp, "dia", "Diameter");
    const t = pos(inp, "thk", "THK");
    const finish = kg(((Math.PI * D * D) / 4) * t, density);
    const process = kg(D * D * t, density);
    return weightResult({
      finishWt: finish,
      processWt: process,
      sheetL: D,
      sheetW: D,
      formula:
        `Finish = π × ${f(D)}² / 4 × ${f(t)} × ${f(density)} / 1e6 = ${f(finish)} kg\n` +
        `Process = ${f(D)} × ${f(D)} × ${f(t)} × ${f(density)} / 1e6 = ${f(process)} kg`,
    });
  },
};

export const ringFlange: ItemType = {
  id: "ring-flange",
  category: "fabricated",
  label: "Ring / circular flange",
  fields: [
    { key: "od", label: "OD", kind: "number", unit: "mm" },
    { key: "id", label: "ID", kind: "number", unit: "mm" },
    THK,
    { key: "pcd", label: "PCD", kind: "number", unit: "mm", optional: true },
    { key: "holes", label: "No. of holes", kind: "number", unit: "nos", optional: true },
    { key: "holeDia", label: "Hole dia", kind: "number", unit: "mm", optional: true },
  ],
  compute(inp, { density }) {
    const OD = pos(inp, "od", "OD");
    const ID = optNum(inp, "id");
    const t = pos(inp, "thk", "THK");
    if (ID < 0 || ID >= OD) throw new CalcError("ID must be smaller than OD");
    const holes = optNum(inp, "holes");
    const hd = optNum(inp, "holeDia");
    const ringArea = (Math.PI * (OD * OD - ID * ID)) / 4;
    const holeArea = (holes * Math.PI * hd * hd) / 4;
    const finish = kg((ringArea - holeArea) * t, density);
    const process = kg(OD * OD * t, density);
    const holeText = holes && hd ? ` − ${f(holes)} × π × ${f(hd)}² / 4` : "";
    return weightResult({
      finishWt: finish,
      processWt: process,
      sheetL: OD,
      sheetW: OD,
      development: { OD, ID, ...(optNum(inp, "pcd") ? { PCD: optNum(inp, "pcd") } : {}) },
      formula:
        `Finish = (π × (${f(OD)}² − ${f(ID)}²) / 4${holeText}) × ${f(t)} × ${f(density)} / 1e6 = ${f(finish)} kg\n` +
        `Process = ${f(OD)} × ${f(OD)} × ${f(t)} × ${f(density)} / 1e6 = ${f(process)} kg`,
    });
  },
};

export const rectFlange: ItemType = {
  id: "rect-flange",
  category: "fabricated",
  label: "Rectangular flange / frame",
  fields: [
    { key: "length", label: "Outer L", kind: "number", unit: "mm" },
    { key: "width", label: "Outer W", kind: "number", unit: "mm" },
    { key: "innerL", label: "Inner l", kind: "number", unit: "mm" },
    { key: "innerW", label: "Inner w", kind: "number", unit: "mm" },
    THK,
  ],
  compute(inp, { density }) {
    const L = pos(inp, "length", "Outer L");
    const W = pos(inp, "width", "Outer W");
    const l = optNum(inp, "innerL");
    const w = optNum(inp, "innerW");
    const t = pos(inp, "thk", "THK");
    if (l >= L || w >= W) throw new CalcError("Inner size must be smaller than outer size");
    const finish = kg((L * W - l * w) * t, density);
    const process = kg(L * W * t, density);
    return weightResult({
      finishWt: finish,
      processWt: process,
      sheetL: L,
      sheetW: W,
      formula:
        `Finish = (${f(L)} × ${f(W)} − ${f(l)} × ${f(w)}) × ${f(t)} × ${f(density)} / 1e6 = ${f(finish)} kg\n` +
        `Process = ${f(L)} × ${f(W)} × ${f(t)} × ${f(density)} / 1e6 = ${f(process)} kg`,
    });
  },
};

export const bentPlate: ItemType = {
  id: "bent-plate",
  category: "fabricated",
  label: "Bent plate / formed channel",
  fields: [
    { key: "girth", label: "Girth (sum of legs)", kind: "number", unit: "mm" },
    { key: "length", label: "Length", kind: "number", unit: "mm" },
    THK,
  ],
  compute(inp, { density }) {
    const g = pos(inp, "girth", "Girth");
    const L = pos(inp, "length", "Length");
    const t = pos(inp, "thk", "THK");
    const wt = kg(g * L * t, density);
    return weightResult({
      finishWt: wt,
      processWt: wt,
      sheetL: L,
      sheetW: g,
      formula: `${f(g)} × ${f(L)} × ${f(t)} × ${f(density)} / 1e6 = ${f(wt)} kg`,
    });
  },
};
