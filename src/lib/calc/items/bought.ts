import { CalcError, type ItemType, type Pt } from "../types";
import { f, optNum, pos, str } from "../helpers";
import { circle, polar } from "../dev/geometry";
import { devResult } from "../dev/result";

/** Bought items: priced qty × rate. Weight is optional and never costed by ₹/kg. */
function boughtType(id: string, label: string, extraFields: ItemType["fields"]): ItemType {
  return {
    id,
    category: "bought",
    label,
    fields: [
      ...extraFields,
      { key: "rate", label: "Rate per piece", kind: "number", unit: "₹" },
      { key: "weight", label: "Weight per piece", kind: "number", unit: "kg", optional: true },
    ],
    compute(inp) {
      const rate = optNum(inp, "rate");
      if (rate < 0) throw new CalcError("Rate cannot be negative");
      const wt = optNum(inp, "weight");
      return {
        finishWt: wt,
        processWt: wt,
        scrap: 0,
        fixedCost: rate,
        costedByWeight: false,
        formula: `Price = qty × ₹${f(rate, 2)}` + (wt ? ` (weight ${f(wt)} kg, not costed by weight)` : ""),
      };
    },
  };
}

export const boughtFlange = boughtType("bought-flange", "Standard flange (bought)", [
  { key: "size", label: "Size", kind: "text" },
  { key: "class", label: "Class", kind: "text", optional: true },
  { key: "flangeType", label: "Type", kind: "text", optional: true },
]);

export const boughtDish = boughtType("bought-dish", "Dished end, small (bought)", [
  { key: "size", label: "Size", kind: "text" },
  { key: "dishType", label: "Type", kind: "text", optional: true },
]);

export const boughtMisc = boughtType("bought-misc", "Fittings / hardware / hoses", [
  { key: "description", label: "Description", kind: "text", optional: true },
]);

/**
 * Blank-diameter factors (blank ≈ factor × OD + 2 × straight face).
 * Torispherical: OD + OD/42 + 2/3 × 0.1·OD ≈ 1.09·OD. 2:1 ellipsoidal ≈ 1.2·OD.
 * Hemispherical: equal-area disc = √2·OD ≈ 1.42·OD.
 * TO CONFIRM with the third-party former; the user can override the factor.
 */
export const DISH_BLANK_FACTOR: Record<string, number> = {
  torispherical: 1.09,
  ellipsoidal: 1.2,
  hemispherical: 1.42,
};

/** Large dished end formed by a third party: material from a square blank + job-work ₹. */
export const dishedEnd: ItemType = {
  id: "dished-end",
  category: "outsourced",
  label: "Dished end – blank by factor (third party)",
  description: "Quick estimate: blank ≈ factor × OD + 2 × straight face. Prefer the End cap types for an exact blank.",
  fields: [
    { key: "od", label: "Dish OD", kind: "number", unit: "mm" },
    { key: "thk", label: "THK", kind: "number", unit: "mm" },
    {
      key: "dishType",
      label: "Type",
      kind: "select",
      options: [
        { value: "torispherical", label: "Torispherical" },
        { value: "ellipsoidal", label: "2:1 ellipsoidal" },
        { value: "hemispherical", label: "Hemispherical" },
      ],
      default: "torispherical",
    },
    { key: "sf", label: "Straight face", kind: "number", unit: "mm", default: 0, optional: true },
    { key: "factor", label: "Blank factor (override)", kind: "number", optional: true },
    { key: "blankDia", label: "Blank dia (overrides factor)", kind: "number", unit: "mm", optional: true },
    { key: "jobWork", label: "Job-work charge per piece", kind: "number", unit: "₹", optional: true },
  ],
  compute(inp, { density }) {
    const t = pos(inp, "thk", "THK");
    const givenBlank = optNum(inp, "blankDia");
    const type = str(inp, "dishType", "torispherical");
    const factor = optNum(inp, "factor") || DISH_BLANK_FACTOR[type];
    if (!factor) throw new CalcError(`Unknown dish type ${type}`);
    const sf = optNum(inp, "sf");
    // With the blank entered directly, the dish OD is not needed.
    const od = givenBlank > 0 ? optNum(inp, "od") : pos(inp, "od", "Dish OD");
    const blank = givenBlank > 0 ? givenBlank : factor * od + 2 * sf;
    const job = optNum(inp, "jobWork");
    const c: Pt = [blank / 2, blank / 2];
    return devResult(
      {
        pieces: [
          {
            name: "Blank",
            count: 1,
            outline: circle(c, blank / 2),
            dims: [{ kind: "radius", label: `Ø${f(blank, 1)}`, center: c, to: polar(c, blank / 2, Math.PI / 4) }],
            exactArea: (Math.PI * blank * blank) / 4,
            exactPerimeter: Math.PI * blank,
          },
        ],
      },
      t,
      density,
      {
        steps: [
          givenBlank > 0
            ? `Blank dia = ${f(blank)} mm (entered)`
            : `Blank dia = ${f(factor)} × ${f(od)} + 2 × ${f(sf)} = ${f(blank)} mm`,
          ...(job ? [`Job work = qty × ₹${f(job, 2)}`] : []),
        ],
        development: { blankDia: blank },
        fixedCost: job,
      },
    );
  },
};
