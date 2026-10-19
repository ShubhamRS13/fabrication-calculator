import { CalcError, type FieldDef, type ItemInputs, type ItemType, type Pt } from "../types";
import { diaRef, f, meanDia, optNum, pos, str } from "../helpers";
import { circle, polar } from "../dev/geometry";
import { devResult } from "../dev/result";

// Vessel end caps (Plate'n'Sheets "Vessel End Cap" group), on the mean surface.
// A head is a surface of revolution; its meridian runs from the pole (x = 0)
// to the knuckle edge (x = a = Dm/2), then the straight face SF.
//   meridian length  L = ∫ ds
//   surface area     A = ∫ 2π x ds
// The flat blank is a disc:
//   "meridian" method (as Plate'n'Sheets): blank radius = L + SF
//   "area" method (material conserving):   π Rblank² = A + 2π a SF

const THK: FieldDef = { key: "thk", label: "THK", kind: "number", unit: "mm" };
const DIA_REF: FieldDef = {
  key: "diaRef",
  label: "Base dia given as",
  kind: "diaRef",
  options: [
    { value: "OD", label: "OD" },
    { value: "ID", label: "ID" },
  ],
  default: "OD",
};
const COMMON_TAIL: FieldDef[] = [
  { key: "sf", label: "Straight face SF", kind: "number", unit: "mm", optional: true },
  { key: "holeDia", label: "End hole dia", kind: "number", unit: "mm", optional: true },
  {
    key: "method",
    label: "Blank size by",
    kind: "select",
    options: [
      { value: "meridian", label: "Meridian length (as Plate'n'Sheets)" },
      { value: "area", label: "Equal surface area" },
    ],
    default: "meridian",
  },
  THK,
];

/** Dish forming by a third party is priced on the Pricing page, per dish size. */
const dishJob = (name: string) => (inp: ItemInputs) =>
  `${name} forming – D ${str(inp, "dia")} ${str(inp, "diaRef", "OD")} × ${str(inp, "thk")}`;
const FAMILY = "Vessel end caps";
const MARK_LINES = 24;

/** Meridian as segments over a parameter: x(p) and ds/dp. */
interface Meridian {
  segments: { p0: number; p1: number; x: (p: number) => number; ds: (p: number) => number }[];
  depth: number;
}

/** Cumulative length and area along the meridian, up to radius `xStop` (or the edge). */
function integrate(m: Meridian, xStop = Infinity) {
  let L = 0;
  let A = 0;
  const N = 2000;
  for (const seg of m.segments) {
    // x grows from the pole outwards; stop exactly where it reaches xStop.
    let p1 = seg.p1;
    const stops = seg.x(seg.p1) >= xStop;
    if (stops) {
      let lo = seg.p0;
      let hi = seg.p1;
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2;
        if (seg.x(mid) < xStop) lo = mid;
        else hi = mid;
      }
      p1 = (lo + hi) / 2;
    }
    const h = (p1 - seg.p0) / N;
    for (let i = 0; i < N; i++) {
      const p = seg.p0 + h * (i + 0.5);
      const ds = seg.ds(p) * h;
      L += ds;
      A += 2 * Math.PI * seg.x(p) * ds;
    }
    if (stops) break;
  }
  return { L, A };
}

function developHead(inp: ItemInputs, density: number, build: (a: number) => Meridian, describe: (a: number, m: Meridian) => string[]) {
  const t = pos(inp, "thk", "THK");
  const D = pos(inp, "dia", "Base dia D");
  const a = meanDia(D, diaRef(inp), t) / 2;
  if (a <= 0) throw new CalcError("THK is too large for this diameter");
  const sf = optNum(inp, "sf");
  const hole = optNum(inp, "holeDia");
  if (sf < 0 || hole < 0) throw new CalcError("Straight face and hole cannot be negative");
  if (hole >= 2 * a) throw new CalcError("End hole must be smaller than the base diameter");
  const method = str(inp, "method", "meridian") === "area" ? "area" : "meridian";

  const m = build(a);
  const full = integrate(m);
  const cut = hole > 0 ? integrate(m, hole / 2) : { L: 0, A: 0 };
  const bandArea = 2 * Math.PI * a * sf;
  const Rblank = method === "meridian" ? full.L + sf : Math.sqrt((full.A + bandArea) / Math.PI);
  const Rhole = hole > 0 ? (method === "meridian" ? cut.L : Math.sqrt(cut.A / Math.PI)) : 0;
  const surface = full.A + bandArea - cut.A;

  const outer = circle([Rblank, Rblank], Rblank);
  const holes = Rhole > 0 ? [circle([Rblank, Rblank], Rhole)] : [];
  const marks: [Pt, Pt][] = [];
  for (let i = 0; i < MARK_LINES; i++) {
    const ang = (2 * Math.PI * i) / MARK_LINES;
    marks.push([polar([Rblank, Rblank], Math.max(Rhole, Rblank * 0.04), ang), polar([Rblank, Rblank], Rblank, ang)]);
  }
  const c: Pt = [Rblank, Rblank];
  return devResult(
    {
      pieces: [
        {
          name: "Blank",
          count: 1,
          outline: outer,
          holes,
          marks,
          dims: [
            { kind: "radius", label: `R = ${f(Rblank, 1)}`, center: c, to: polar(c, Rblank, Math.PI / 4) },
            ...(Rhole > 0 ? [{ kind: "radius" as const, label: `r = ${f(Rhole, 1)}`, center: c, to: polar(c, Rhole, -Math.PI / 4) }] : []),
          ],
          exactArea: Math.PI * (Rblank * Rblank - Rhole * Rhole),
          exactPerimeter: 2 * Math.PI * (Rblank + Rhole),
        },
      ],
    },
    t,
    density,
    {
      steps: [
        `Mean base radius a = ${f(a)} mm, dish depth = ${f(m.depth)} mm`,
        ...describe(a, m),
        `Meridian length L = ${f(full.L)} mm, surface area A = ${f(full.A)} mm²`,
        method === "meridian"
          ? `Blank radius = L + SF = ${f(full.L)} + ${f(sf)} = ${f(Rblank)} mm`
          : `Blank radius = √((A + 2π a SF) / π) = ${f(Rblank)} mm`,
        ...(Rhole > 0 ? [`Hole radius on blank = ${f(Rhole)} mm`] : []),
      ],
      development: { depth: m.depth, meridian: full.L, blankDia: 2 * Rblank, ...(Rhole > 0 ? { holeOnBlank: 2 * Rhole } : {}) },
      fixedCost: optNum(inp, "jobWork"),
      surfaceArea: surface,
    },
  );
}

const DIA: FieldDef = { key: "dia", label: "Base dia D", kind: "number", unit: "mm" };

export const dishHemi: ItemType = {
  id: "dish-hemi",
  category: "fabricated",
  family: FAMILY,
  label: "End cap – hemispherical",
  description: "An end cap to fit over a cylinder; half a sphere, set by the base diameter.",
  formulaText: ["a = D/2 (mean)", "L = π a / 2,  A = 2π a²", "Blank radius = L + SF  (or √((A + 2π a SF)/π))"],
  jobWorkRef: dishJob("Hemispherical dish"),
  fields: [DIA, DIA_REF, ...COMMON_TAIL],
  compute: (inp, { density }) =>
    developHead(
      inp,
      density,
      (a) => ({ segments: [{ p0: 0, p1: Math.PI / 2, x: (u) => a * Math.sin(u), ds: () => a }], depth: a }),
      () => ["Hemisphere: x = a sin u, ds = a du"],
    ),
};

export const dishEllip: ItemType = {
  id: "dish-ellip",
  category: "fabricated",
  family: FAMILY,
  label: "End cap – semi-elliptical",
  description: "An end cap with an elliptical cross-section, set by the base diameter and the dish height (2:1 head: height = D/4).",
  formulaText: ["a = D/2 (mean), b = dish height h", "x = a sin u,  ds = √(a² cos² u + b² sin² u) du", "L = ∫ ds,  A = ∫ 2π x ds"],
  jobWorkRef: dishJob("Semi-elliptical dish"),
  fields: [DIA, DIA_REF, { key: "depth", label: "Dish height h", kind: "number", unit: "mm", help: "2:1 head: D/4" }, ...COMMON_TAIL],
  compute: (inp, { density }) => {
    const b = pos(inp, "depth", "Dish height h");
    return developHead(
      inp,
      density,
      (a) => ({
        segments: [{ p0: 0, p1: Math.PI / 2, x: (u) => a * Math.sin(u), ds: (u) => Math.hypot(a * Math.cos(u), b * Math.sin(u)) }],
        depth: b,
      }),
      (a) => [`Ellipse: semi-axes a = ${f(a)}, b = ${f(b)} mm (ratio ${f(a / b, 2)}:1)`],
    );
  },
};

export const dishTori: ItemType = {
  id: "dish-tori",
  category: "fabricated",
  family: FAMILY,
  label: "End cap – torispherical",
  description: "An end cap made of a dish (crown) radius and a knuckle radius. The crown radius must be at least the base radius.",
  formulaText: [
    "a = D/2 (mean),  sin α = (a − KR) / (CR − KR)",
    "Depth = CR − √((CR − KR)² − (a − KR)²)",
    "L = CR × α + KR × (π/2 − α)",
    "A = 2π CR² (1 − cos α) + 2π KR [(a − KR)(π/2 − α) + KR cos α]",
  ],
  jobWorkRef: dishJob("Torispherical dish"),
  fields: [
    DIA,
    DIA_REF,
    { key: "crown", label: "Crown (dish) radius CR", kind: "number", unit: "mm", help: "Often = D" },
    { key: "knuckle", label: "Knuckle radius KR", kind: "number", unit: "mm", help: "Often 6–10% of D" },
    ...COMMON_TAIL,
  ],
  compute: (inp, { density }) => {
    const CR = pos(inp, "crown", "Crown radius CR");
    const KR = pos(inp, "knuckle", "Knuckle radius KR");
    return developHead(
      inp,
      density,
      (a) => {
        if (KR >= a) throw new CalcError("Knuckle radius must be smaller than the base radius");
        if (CR < a) throw new CalcError("Crown radius must be at least the base radius");
        const alpha = Math.asin((a - KR) / (CR - KR));
        const depth = CR - Math.sqrt((CR - KR) ** 2 - (a - KR) ** 2);
        return {
          segments: [
            { p0: 0, p1: alpha, x: (u) => CR * Math.sin(u), ds: () => CR },
            { p0: alpha, p1: Math.PI / 2, x: (u) => a - KR + KR * Math.sin(u), ds: () => KR },
          ],
          depth,
        };
      },
      (a) => {
        const alpha = Math.asin((a - KR) / (CR - KR));
        return [`Crown angle α = asin((a − KR)/(CR − KR)) = ${f((alpha * 180) / Math.PI)}°`];
      },
    );
  },
};

export const DISH_TYPES = [dishHemi, dishEllip, dishTori];

/** Closed forms, used by the tests to check the numeric integration. */
export const closedForm = {
  toriLength: (a: number, CR: number, KR: number) => {
    const al = Math.asin((a - KR) / (CR - KR));
    return CR * al + KR * (Math.PI / 2 - al);
  },
  toriArea: (a: number, CR: number, KR: number) => {
    const al = Math.asin((a - KR) / (CR - KR));
    return 2 * Math.PI * CR * CR * (1 - Math.cos(al)) + 2 * Math.PI * KR * ((a - KR) * (Math.PI / 2 - al) + KR * Math.cos(al));
  },
};
