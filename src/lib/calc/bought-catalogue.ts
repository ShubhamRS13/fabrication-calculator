import type { FieldDef, InputValue, ItemInputs, PriceUnit } from "./types";

// Bought-out catalogue. An item is picked by KIND (Flange, Stub end, Elbow…) and
// its size is chosen from fields — never typed as text — so the same item always
// gets the same name, and therefore one rate on the Pricing page, whichever
// drawing it is on and however it is written on the drawing.

export type Template =
  | "flange" | "blind" | "stub" | "fitting" | "reducing" | "elbow" | "bend" | "tee" | "reducer"
  | "bolt" | "nut" | "washer" | "set" | "hose" | "clamp" | "gasket" | "other";

export interface BoughtKind {
  name: string;
  template: Template;
  unit: PriceUnit;
}

/** Starting list; more kinds can be added in Settings (each picks one of the templates). */
export const DEFAULT_KINDS: BoughtKind[] = [
  { name: "Flange", template: "flange", unit: "piece" },
  { name: "Blind flange", template: "blind", unit: "piece" },
  { name: "Stub end", template: "stub", unit: "piece" },
  { name: "Socket", template: "fitting", unit: "piece" },
  { name: "Socket with plug", template: "fitting", unit: "piece" },
  { name: "Coupling", template: "fitting", unit: "piece" },
  { name: "Union", template: "fitting", unit: "piece" },
  { name: "Cap", template: "fitting", unit: "piece" },
  { name: "Hex head plug", template: "fitting", unit: "piece" },
  { name: "Bushing", template: "reducing", unit: "piece" },
  { name: "Elbow", template: "elbow", unit: "piece" },
  { name: "Bend", template: "bend", unit: "piece" },
  { name: "Tee", template: "tee", unit: "piece" },
  { name: "Reducer", template: "reducer", unit: "piece" },
  { name: "Hex bolt", template: "bolt", unit: "piece" },
  { name: "Stud", template: "bolt", unit: "piece" },
  { name: "Nut", template: "nut", unit: "piece" },
  { name: "Washer", template: "washer", unit: "piece" },
  { name: "Nut-bolt-washer set", template: "set", unit: "set" },
  { name: "Hose", template: "hose", unit: "m" },
  { name: "Hose clamp", template: "clamp", unit: "piece" },
  { name: "Gasket", template: "gasket", unit: "piece" },
  { name: "Other", template: "other", unit: "piece" },
];

export const TEMPLATE_LABEL: Record<Template, string> = {
  flange: "Flange (NB, class, type)",
  blind: "Blind flange (NB, class)",
  stub: "Stub end (NB, long/short, schedule)",
  fitting: "Fitting (NB, rating, end)",
  reducing: "Reducing fitting (two NB, rating, end)",
  elbow: "Elbow (NB, angle, end, rating)",
  bend: "Bend (NB, angle, radius, schedule)",
  tee: "Tee (run NB, branch NB, end, rating)",
  reducer: "Reducer (two NB, type, end, schedule)",
  bolt: "Bolt / stud (thread, length)",
  nut: "Nut (thread)",
  washer: "Washer (thread, type)",
  set: "Nut-bolt-washer set (thread, length)",
  hose: "Hose (NB)",
  clamp: "Clamp (NB)",
  gasket: "Gasket (NB, material)",
  other: "Other (description)",
};

const INCH: Record<number, string> = {
  6: "⅛\"", 8: "¼\"", 10: "⅜\"", 15: "½\"", 20: "¾\"", 25: "1\"", 32: "1¼\"", 40: "1½\"", 50: "2\"", 65: "2½\"",
  80: "3\"", 100: "4\"", 125: "5\"", 150: "6\"", 200: "8\"", 250: "10\"", 300: "12\"", 350: "14\"", 400: "16\"",
};
const list = (values: string[]) => values.map((v) => ({ value: v, label: v }));
const NB = Object.entries(INCH).map(([nb, inch]) => ({ value: nb, label: `${nb} NB (${inch})` }));
const THREAD = list(["M6", "M8", "M10", "M12", "M14", "M16", "M18", "M20", "M22", "M24", "M27", "M30"]);
const FLANGE_CLASS = list(["150#", "300#", "600#", "PN6", "PN10", "PN16", "PN25", "Table D", "Table E", "Table F"]);
const FLANGE_TYPE = list(["Slip-on", "Weld-neck", "Lap joint", "Socket-weld", "Threaded", "Plate"]);
const END = list(["Butt-weld", "Socket-weld", "BSP", "NPT", "Flanged"]);
const RATING = list(["SCH 5S", "SCH 10S", "SCH 40", "SCH 80", "150#", "2000#", "3000#", "6000#"]);
const SCHEDULE = list(["SCH 5S", "SCH 10S", "SCH 40", "SCH 80"]);

/** Size fields per template. Keys are shared where the meaning is the same. */
const F = {
  nb: { key: "nb", label: "NB", kind: "select", options: NB },
  nb2: { key: "nb2", label: "Second NB (small / branch)", kind: "select", options: NB },
  cls: { key: "cls", label: "Class", kind: "select", options: FLANGE_CLASS },
  ftype: { key: "ftype", label: "Type", kind: "select", options: FLANGE_TYPE },
  stub: { key: "stub", label: "Length", kind: "select", options: list(["Long", "Short"]) },
  rating: { key: "rating", label: "Rating / schedule", kind: "select", options: RATING },
  schedule: { key: "rating", label: "Schedule", kind: "select", options: SCHEDULE },
  end: { key: "end", label: "End", kind: "select", options: END },
  angle: { key: "angle", label: "Angle", kind: "select", options: list(["90°", "45°", "180°"]) },
  bangle: { key: "angle", label: "Angle", kind: "select", options: list(["90°", "60°", "45°", "30°"]) },
  radius: { key: "radius", label: "Bend radius", kind: "select", options: list(["1.5D", "3D", "5D"]) },
  rtype: { key: "rtype", label: "Type", kind: "select", options: list(["Concentric", "Eccentric"]) },
  thread: { key: "thread", label: "Thread", kind: "select", options: THREAD },
  len: { key: "len", label: "Length", kind: "number", unit: "mm" },
  wtype: { key: "wtype", label: "Type", kind: "select", options: list(["Plain", "Spring"]) },
  gmat: { key: "gmat", label: "Gasket material", kind: "select", options: list(["CAF", "PTFE", "Rubber", "Spiral wound", "Graphite"]) },
  desc: { key: "desc", label: "Description", kind: "text", help: "e.g. Ball valve 25 NB" },
} satisfies Record<string, FieldDef>;

export const TEMPLATE_FIELDS: Record<Template, FieldDef[]> = {
  flange: [F.nb, F.cls, F.ftype],
  blind: [F.nb, F.cls],
  stub: [F.nb, F.stub, F.schedule],
  fitting: [F.nb, F.rating, F.end],
  reducing: [F.nb, F.nb2, F.rating, F.end],
  elbow: [F.nb, F.angle, F.end, F.rating],
  bend: [F.nb, F.bangle, F.radius, F.schedule],
  tee: [F.nb, F.nb2, F.end, F.rating],
  reducer: [F.nb, F.nb2, F.rtype, F.end, F.schedule],
  bolt: [F.thread, F.len],
  nut: [F.thread],
  washer: [F.thread, F.wtype],
  set: [F.thread, F.len],
  hose: [F.nb],
  clamp: [F.nb],
  gasket: [F.nb, F.gmat],
  other: [F.desc],
};

/** Every size field once (for the item form), each shown only for templates that use it. */
export function allSizeFields(): { field: FieldDef; templates: Template[] }[] {
  const out = new Map<string, { field: FieldDef; templates: Template[] }>();
  for (const [t, fields] of Object.entries(TEMPLATE_FIELDS) as [Template, FieldDef[]][]) {
    for (const f of fields) {
      // Same key can carry different labels/options per template (e.g. angle), so key by key+label.
      const id = `${f.key}:${f.label}:${(f.options ?? []).length}`;
      const e = out.get(id) ?? { field: f, templates: [] };
      e.templates.push(t);
      out.set(id, e);
    }
  }
  return [...out.values()];
}

/** Description text normalised so spelling noise doesn't split a rate: case, spaces, punctuation, "x". */
export function normaliseDesc(s: string): string {
  return s
    .toUpperCase()
    .replace(/(\d)\s*[X×*]\s*(\d)/g, "$1×$2")
    .replace(/[^A-Z0-9.×/"#°-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const v = (inputs: ItemInputs, key: string) => {
  const x: InputValue = inputs[key];
  return x === undefined || x === null ? "" : String(x).trim();
};

/** The catalogue name of a bought-out: kind + size fields. Same item → same name. */
export function boughtLabel(kind: BoughtKind, inputs: ItemInputs): string {
  const nb = (k: string) => (v(inputs, k) ? `${v(inputs, k)} NB` : "");
  const parts: string[] = [];
  switch (kind.template) {
    case "flange": parts.push(nb("nb"), v(inputs, "cls"), v(inputs, "ftype")); break;
    case "blind": parts.push(nb("nb"), v(inputs, "cls")); break;
    case "stub": parts.push(nb("nb"), v(inputs, "stub"), v(inputs, "rating")); break;
    case "fitting": parts.push(nb("nb"), v(inputs, "rating"), v(inputs, "end")); break;
    case "reducing": parts.push(`${nb("nb")} × ${nb("nb2")}`, v(inputs, "rating"), v(inputs, "end")); break;
    case "elbow": parts.push(nb("nb"), v(inputs, "angle"), v(inputs, "end"), v(inputs, "rating")); break;
    case "bend": parts.push(nb("nb"), v(inputs, "angle"), v(inputs, "radius"), v(inputs, "rating")); break;
    case "tee": parts.push(v(inputs, "nb2") && v(inputs, "nb2") !== v(inputs, "nb") ? `${nb("nb")} × ${nb("nb2")}` : `${nb("nb")} equal`, v(inputs, "end"), v(inputs, "rating")); break;
    case "reducer": parts.push(`${nb("nb")} × ${nb("nb2")}`, v(inputs, "rtype"), v(inputs, "end"), v(inputs, "rating")); break;
    case "bolt":
    case "set": parts.push(v(inputs, "len") ? `${v(inputs, "thread")} × ${v(inputs, "len")}` : v(inputs, "thread")); break;
    case "nut": parts.push(v(inputs, "thread")); break;
    case "washer": parts.push(v(inputs, "thread"), v(inputs, "wtype")); break;
    case "hose":
    case "clamp": parts.push(nb("nb")); break;
    case "gasket": parts.push(nb("nb"), v(inputs, "gmat")); break;
    case "other": return normaliseDesc(v(inputs, "desc")) || "OTHER";
  }
  return [kind.name, ...parts.filter(Boolean)].join(" ");
}

export function findKind(kinds: BoughtKind[], name: string): BoughtKind | undefined {
  return kinds.find((k) => k.name === name);
}
