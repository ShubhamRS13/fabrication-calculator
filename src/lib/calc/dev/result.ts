import type { Development, ItemResult, MarkTable, MassFigures, MassReport } from "../types";
import { f, kg } from "../helpers";
import { bbox, closedLength, polygonArea } from "./geometry";

// Every sheet-metal item ends here: weights come from its flat pattern.
//   finish (actual shape)      = Σ pieces × shape area × t × ρ
//   process (single rectangle) = Σ pieces × frame W × H × t × ρ

const fig = (areaMm2: number, perimeter: number, t: number, density: number): MassFigures => ({
  area: areaMm2 / 1e6,
  perimeter,
  mass: kg(areaMm2 * t, density),
});

export function massReport(dev: Development, t: number, density: number): MassReport {
  const pieces = dev.pieces.map((p) => {
    const b = bbox(p.outline);
    const holesArea = (p.holes ?? []).reduce((a, h) => a + polygonArea(h), 0);
    const area = p.exactArea ?? polygonArea(p.outline) - holesArea;
    const perim = p.exactPerimeter ?? closedLength(p.outline) + (p.holes ?? []).reduce((a, h) => a + closedLength(h), 0);
    return {
      name: p.name,
      count: p.count,
      frameW: b.w,
      frameH: b.h,
      frame: fig(b.w * b.h * p.count, 2 * (b.w + b.h) * p.count, t, density),
      actual: fig(area * p.count, perim * p.count, t, density),
    };
  });
  const sum = (k: "frame" | "actual"): MassFigures => ({
    area: pieces.reduce((a, p) => a + p[k].area, 0),
    perimeter: pieces.reduce((a, p) => a + p[k].perimeter, 0),
    mass: pieces.reduce((a, p) => a + p[k].mass, 0),
  });
  return { frame: sum("frame"), actual: sum("actual"), pieces };
}

/**
 * Build an item result from a development. `t` is the thickness used for weight
 * (it may include an allowance, e.g. chequered plate).
 */
export function devResult(
  dev: Development,
  t: number,
  density: number,
  opts: {
    steps: string[];
    development?: Record<string, number>;
    markTable?: MarkTable;
    fixedCost?: number;
    surfaceArea?: number;
  },
): ItemResult {
  const mass = massReport(dev, t, density);
  const finish = mass.actual.mass;
  const process = mass.frame.mass;
  const single = dev.pieces.length === 1 && dev.pieces[0].count === 1;
  const lines = [
    ...opts.steps,
    ...mass.pieces.map(
      (p) =>
        `${p.name}${p.count > 1 ? ` × ${p.count}` : ""}: shape ${f(p.actual.area / p.count, 6)} m², frame ${f(p.frameW)} × ${f(p.frameH)}`,
    ),
    `Finish = shape area ${f(mass.actual.area * 1e6)} mm² × ${f(t)} × ${f(density)} / 1e6 = ${f(finish)} kg`,
    `Process = frame area ${f(mass.frame.area * 1e6)} mm² × ${f(t)} × ${f(density)} / 1e6 = ${f(process)} kg`,
  ];
  return {
    finishWt: finish,
    processWt: process,
    scrap: Math.max(0, process - finish),
    sheetL: single ? mass.pieces[0].frameW : undefined,
    sheetW: single ? mass.pieces[0].frameH : undefined,
    development: opts.development,
    fixedCost: opts.fixedCost ?? 0,
    costedByWeight: true,
    formula: lines.join("\n"),
    dev,
    mass,
    markTable: opts.markTable,
    surfaceArea: opts.surfaceArea,
  };
}
