import { CalcError, type DevDim, type FieldDef, type ItemInputs, type ItemType, type Pt } from "../types";
import { diaRef, f, meanDia, num, optNum, pos } from "../helpers";
import { arc, unrollStrip, type V3 } from "../dev/geometry";
import { devResult } from "../dev/result";
import { deg as angle, join, n, thk } from "../size";

/** "2 THK × D1 700 × D2 1300 × H 760", with "(ID)" when the dias are inside dias. */
function coneSize(i: ItemInputs, ...rest: string[]): string {
  return join(thk(i), `D1 ${n(i.d1)}`, ...rest) + (i.diaRef === "ID" ? " (ID)" : "");
}

// Cones (Plate'n'Sheets "Cones" group). Mean diameters are used for development.
//
// Every right cone here is one cone (radius Rb at axial height 0, apex at height
// Ha) cut by a bottom plane and a top plane: z = h + tan(β)·x. Flat planes give
// a frustum; tilted planes give the truncated cones. A generator at angle φ
// around the axis meets a plane at  z = (h + c·Ha) / (1 + c),  c = tanβ·Rb·cosφ / Ha,
// and lies  d = S·(Ha − z)/Ha  from the apex on the flat pattern (S = √(Rb² + Ha²)).

const THK: FieldDef = { key: "thk", label: "THK", kind: "number", unit: "mm" };
const DIA_REF: FieldDef = {
  key: "diaRef",
  label: "Diameters given as",
  kind: "diaRef",
  options: [
    { value: "OD", label: "OD" },
    { value: "ID", label: "ID" },
  ],
  default: "OD",
};
const FAMILY = "Cones";
const deg = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

interface Plane {
  h: number;
  /** tan of the plane's tilt; positive rises towards +x */
  tan: number;
}

interface RightCone {
  Rb: number;
  Ha: number;
  bottom: Plane;
  top: Plane;
}

const MARK_LINES = 24;
const SAMPLES = 360;

function planeZ(c: RightCone, p: Plane, phi: number) {
  const k = (p.tan * c.Rb * Math.cos(phi)) / c.Ha;
  return (p.h + k * c.Ha) / (1 + k);
}

/** Develop a right cone between two planes. */
function developRightCone(c: RightCone, t: number, density: number, steps: string[]) {
  if (c.Ha <= 0 || c.Rb <= 0) throw new CalcError("The cone does not close to an apex — check the sizes");
  const S = Math.hypot(c.Rb, c.Ha);
  const theta = (2 * Math.PI * c.Rb) / S; // flat angle, radians
  const flatBottom = c.bottom.tan === 0;
  const flatTop = c.top.tan === 0;
  const d = (z: number) => (S * (c.Ha - z)) / c.Ha;
  // The seam goes on the shortest generator. φ is measured from the seam; ψ is the angle on the flat.
  let seam = 0;
  let shortest = Infinity;
  for (let i = 0; i < SAMPLES; i++) {
    const a = (2 * Math.PI * i) / SAMPLES;
    const len = d(planeZ(c, c.bottom, a)) - d(planeZ(c, c.top, a));
    if (len < shortest - 1e-9) {
      shortest = len;
      seam = a;
    }
  }
  const zAt = (p: Plane, phi: number) => planeZ(c, p, phi + seam);
  const psi = (phi: number) => (phi - Math.PI) * (c.Rb / S);
  const at = (dist: number, a: number): Pt => [dist * Math.sin(a), -dist * Math.cos(a)];

  const sampleCurve = (p: Plane): { pts: Pt[]; dists: number[] } => {
    const pts: Pt[] = [];
    const dists: number[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const phi = (2 * Math.PI * i) / SAMPLES;
      const z = zAt(p, phi);
      if (!(z < c.Ha)) throw new CalcError("A cut is above the apex of the cone");
      dists.push(d(z));
      pts.push(at(d(z), psi(phi)));
    }
    return { pts, dists };
  };

  const bottom = flatBottom
    ? { pts: arc([0, 0], d(c.bottom.h), -theta / 2, theta / 2, SAMPLES).map(([x, y]) => [x, -y] as Pt), dists: [d(c.bottom.h)] }
    : sampleCurve(c.bottom);
  const top = flatTop
    ? { pts: d(c.top.h) > 0 ? arc([0, 0], d(c.top.h), -theta / 2, theta / 2, SAMPLES).map(([x, y]) => [x, -y] as Pt) : [[0, 0] as Pt], dists: [d(c.top.h)] }
    : sampleCurve(c.top);

  // Generators at the marking divisions, and the marking table.
  const rows: number[][] = [];
  const marks: [Pt, Pt][] = [];
  for (let i = 0; i <= MARK_LINES; i++) {
    const phi = (2 * Math.PI * i) / MARK_LINES;
    const dt = d(zAt(c.top, phi));
    const db = d(zAt(c.bottom, phi));
    if (!(db > dt)) throw new CalcError("The top and bottom cuts cross inside the cone");
    if (i > 0 && i < MARK_LINES) marks.push([at(dt, psi(phi)), at(db, psi(phi))]);
    rows.push([i, toDeg(psi(phi) + theta / 2), dt, db, db - dt]);
  }

  const R1 = flatBottom ? d(c.bottom.h) : undefined;
  const R2 = flatTop ? d(c.top.h) : undefined;
  const dims: DevDim[] = [];
  if (R1 !== undefined) dims.push({ kind: "radius", label: `R1 = ${f(R1, 1)}`, center: [0, 0], to: at(R1, theta / 4) });
  if (R2 !== undefined && R2 > 0) dims.push({ kind: "radius", label: `R2 = ${f(R2, 1)}`, center: [0, 0], to: at(R2, -theta / 4) });
  const rAngle = Math.max((R2 ?? 0) * 0.6, (R1 ?? rows[0][3]) * 0.18);
  dims.push({ kind: "angle", label: `θ = ${f(toDeg(theta), 2)}°`, center: [0, 0], from: at(rAngle, -theta / 2), to: at(rAngle, theta / 2), r: rAngle });
  const chord = theta >= Math.PI ? 2 * (R1 ?? 0) : 2 * (R1 ?? 0) * Math.sin(theta / 2);
  if (R1 !== undefined) dims.push({ kind: "linear", label: `chord ${f(chord, 1)}`, from: at(R1, -theta / 2), to: at(R1, theta / 2), offset: 0 });

  const outline: Pt[] = [...bottom.pts, ...[...top.pts].reverse()];
  const exact = flatBottom && flatTop;
  const r1 = d(c.bottom.h);
  const r2 = Math.max(0, d(c.top.h));

  return devResult(
    {
      pieces: [
        {
          name: "Cone",
          count: 1,
          outline,
          marks,
          dims,
          exactArea: exact ? (theta / 2) * (r1 * r1 - r2 * r2) : undefined,
          exactPerimeter: exact ? theta * (r1 + r2) + 2 * (r1 - r2) : undefined,
        },
      ],
    },
    t,
    density,
    {
      steps: [
        ...steps,
        `Slant to base S = √(Rb² + Ha²) = √(${f(c.Rb)}² + ${f(c.Ha)}²) = ${f(S)} mm`,
        `Flat angle θ = 360 × Rb / S = ${f(toDeg(theta))}°`,
        ...(R1 !== undefined ? [`R1 = ${f(R1)} mm`] : []),
        ...(R2 !== undefined ? [`R2 = ${f(R2)} mm`] : []),
      ],
      development: {
        Rb: c.Rb,
        apexHeight: c.Ha,
        slant: S,
        ...(R1 !== undefined ? { R1 } : {}),
        ...(R2 !== undefined ? { R2 } : {}),
        theta: toDeg(theta),
        ...(R1 !== undefined ? { chord } : {}),
      },
      markTable: {
        title: "Generator marking (from apex)",
        columns: ["Line", "Angle on flat °", "Top mark mm", "Bottom mark mm", "Line length mm"],
        rows,
      },
    },
  );
}

/** Mean radii of the base and top circles. */
function radii(inp: ItemInputs, baseKey: string, topKey: string | null, t: number) {
  const ref = diaRef(inp);
  const Rb = meanDia(pos(inp, baseKey, "Base dia D"), ref, t) / 2;
  const rt = topKey ? Math.max(0, meanDia(num(inp, topKey, "Top dia d"), ref, t) / 2) : 0;
  if (Rb <= 0) throw new CalcError("THK is too large for this diameter");
  return { Rb, rt, ref };
}

function frustum(inp: ItemInputs, density: number, mode: "height" | "apex" | "angle") {
  const t = pos(inp, "thk", "THK");
  let { Rb, rt } = radii(inp, "d1", "d2", t);
  if (rt > Rb) [Rb, rt] = [rt, Rb];
  if (rt >= Rb) throw new CalcError("Base and top diameters are equal — use Cylinder");
  let H: number;
  let Ha: number;
  if (mode === "height") {
    H = pos(inp, "height", "Height H");
    Ha = (H * Rb) / (Rb - rt);
  } else if (mode === "apex") {
    Ha = pos(inp, "apexHeight", "Apex height Ha");
    H = Ha * (1 - rt / Rb);
  } else {
    const a = pos(inp, "angle", "Cone angle α");
    if (a >= 180) throw new CalcError("Cone angle must be less than 180°");
    Ha = Rb / Math.tan(deg(a / 2));
    H = (Rb - rt) / Math.tan(deg(a / 2));
  }
  return developRightCone({ Rb, Ha, bottom: { h: 0, tan: 0 }, top: { h: H, tan: 0 } }, t, density, [
    `Mean radii Rb = ${f(Rb)}, rt = ${f(rt)} mm`,
    `Height H = ${f(H)} mm, apex height Ha = ${f(Ha)} mm`,
  ]);
}

const D_FIELD: FieldDef = { key: "d1", label: "Base dia D", kind: "number", unit: "mm" };
const d_FIELD: FieldDef = { key: "d2", label: "Top dia d", kind: "number", unit: "mm" };

/** Kept as "cone" so saved items keep working. */
export const coneFrustumHeight: ItemType = {
  id: "cone",
  size: (i) => coneSize(i, `D2 ${n(i.d2)}`, `H ${n(i.height)}`),
  category: "fabricated",
  family: FAMILY,
  label: "Right cone frustum – top dia & height",
  description: "A right cone cut parallel to the base. Defined by the base diameter, top diameter and height.",
  formulaText: [
    "Rb = D/2, rt = d/2 (mean)",
    "Ha = H × Rb / (Rb − rt)",
    "S = √(Rb² + Ha²),  θ = 360° × Rb / S",
    "R1 = S,  R2 = S × rt / Rb",
    "Area = θ/360 × π × (R1² − R2²)",
  ],
  fields: [D_FIELD, d_FIELD, DIA_REF, { key: "height", label: "Height H", kind: "number", unit: "mm" }, THK],
  compute: (inp, { density }) => frustum(inp, density, "height"),
};

export const coneFrustumApex: ItemType = {
  id: "cone-apex",
  size: (i) => coneSize(i, `D2 ${n(i.d2)}`, `apex H ${n(i.apexHeight)}`),
  category: "fabricated",
  family: FAMILY,
  label: "Right cone frustum – top dia & apex height",
  description: "A right cone cut parallel to the base. Defined by the base diameter, top diameter and the height of the apex above the base.",
  formulaText: ["Rb = D/2, rt = d/2 (mean)", "H = Ha × (1 − rt / Rb)", "S = √(Rb² + Ha²),  θ = 360° × Rb / S", "R1 = S,  R2 = S × rt / Rb"],
  fields: [D_FIELD, d_FIELD, DIA_REF, { key: "apexHeight", label: "Apex height Ha", kind: "number", unit: "mm" }, THK],
  compute: (inp, { density }) => frustum(inp, density, "apex"),
};

export const coneFrustumAngle: ItemType = {
  id: "cone-angle",
  size: (i) => coneSize(i, `D2 ${n(i.d2)}`, `angle ${angle(i.angle)}`),
  category: "fabricated",
  family: FAMILY,
  label: "Right cone frustum – top dia & cone angle",
  description: "A right cone cut parallel to the base. Defined by the base diameter, top diameter and the included angle of the cone.",
  formulaText: ["Rb = D/2, rt = d/2 (mean)", "Ha = Rb / tan(α/2),  H = (Rb − rt) / tan(α/2)", "S = √(Rb² + Ha²),  θ = 360° × Rb / S", "R1 = S,  R2 = S × rt / Rb"],
  fields: [D_FIELD, d_FIELD, DIA_REF, { key: "angle", label: "Cone angle α", kind: "number", unit: "deg" }, THK],
  compute: (inp, { density }) => frustum(inp, density, "angle"),
};

const ANGLE_HELP = "Negative tilts the other way";

export const coneTruncTop: ItemType = {
  id: "cone-trunc-top",
  size: (i) => coneSize(i, `angle ${angle(i.angle)}`, `cut H ${n(i.cutHeight)}`, `cut ${angle(i.cutAngle)}`),
  category: "fabricated",
  family: FAMILY,
  label: "Right cone – top truncated",
  description: "A right cone with the top cut at an angle to the base. Defined by the base diameter, cone angle, and the cut's height at the axis and angle.",
  formulaText: [
    "Rb = D/2 (mean),  Ha = Rb / tan(α/2),  S = √(Rb² + Ha²)",
    "Cut plane: z = h + tan β × x",
    "Generator at φ meets it at z = (h + c·Ha)/(1 + c),  c = tan β × Rb × cos φ / Ha",
    "Mark from apex = S × (Ha − z) / Ha",
  ],
  fields: [
    D_FIELD,
    DIA_REF,
    { key: "angle", label: "Cone angle α", kind: "number", unit: "deg" },
    { key: "cutHeight", label: "Cut height at axis h", kind: "number", unit: "mm" },
    { key: "cutAngle", label: "Cut angle β", kind: "number", unit: "deg", help: ANGLE_HELP },
    THK,
  ],
  compute(inp, { density }) {
    const t = pos(inp, "thk", "THK");
    const { Rb } = radii(inp, "d1", null, t);
    const a = pos(inp, "angle", "Cone angle α");
    if (a >= 180) throw new CalcError("Cone angle must be less than 180°");
    const Ha = Rb / Math.tan(deg(a / 2));
    const h = pos(inp, "cutHeight", "Cut height h");
    const b = num(inp, "cutAngle", "Cut angle β");
    if (Math.abs(b) >= 89) throw new CalcError("Cut angle must be between −89° and 89°");
    return developRightCone({ Rb, Ha, bottom: { h: 0, tan: 0 }, top: { h, tan: Math.tan(deg(b)) } }, t, density, [
      `Mean base radius Rb = ${f(Rb)} mm, apex height Ha = ${f(Ha)} mm`,
      `Top cut: z = ${f(h)} + tan ${f(b)}° × x`,
    ]);
  },
};

export const coneTruncBase: ItemType = {
  id: "cone-trunc-base",
  size: (i) => coneSize(i, `D2 ${n(i.d2)}`, `H ${n(i.height)}`, `cut ${angle(i.cutAngle)}`),
  category: "fabricated",
  family: FAMILY,
  label: "Right cone – base truncated",
  description: "A right cone with the base cut at an angle. Defined by the diameter where the base cut crosses the axis, the top diameter, the height at the axis and the base cut angle.",
  formulaText: [
    "Rb = D/2, rt = d/2 (mean),  Ha = H × Rb / (Rb − rt)",
    "Base plane: z = tan β × x (through the axis at D)",
    "Mark from apex = S × (Ha − z) / Ha",
  ],
  fields: [
    { ...D_FIELD, label: "Base dia D (at axis)" },
    d_FIELD,
    DIA_REF,
    { key: "height", label: "Height H (at axis)", kind: "number", unit: "mm" },
    { key: "cutAngle", label: "Base cut angle β", kind: "number", unit: "deg", help: ANGLE_HELP },
    THK,
  ],
  compute(inp, { density }) {
    const t = pos(inp, "thk", "THK");
    const { Rb, rt } = radii(inp, "d1", "d2", t);
    if (rt >= Rb) throw new CalcError("Top dia must be smaller than base dia");
    const H = pos(inp, "height", "Height H");
    const Ha = (H * Rb) / (Rb - rt);
    const b = num(inp, "cutAngle", "Base cut angle β");
    if (Math.abs(b) >= 89) throw new CalcError("Cut angle must be between −89° and 89°");
    return developRightCone({ Rb, Ha, bottom: { h: 0, tan: Math.tan(deg(b)) }, top: { h: H, tan: 0 } }, t, density, [
      `Mean radii Rb = ${f(Rb)}, rt = ${f(rt)} mm, apex height Ha = ${f(Ha)} mm`,
      `Base cut: z = tan ${f(b)}° × x`,
    ]);
  },
};

export const coneTruncBoth: ItemType = {
  id: "cone-trunc-both",
  size: (i) => coneSize(i, `angle ${angle(i.angle)}`, `base ${angle(i.baseAngle)}`, `cut H ${n(i.cutHeight)}`, `cut ${angle(i.cutAngle)}`),
  category: "fabricated",
  family: FAMILY,
  label: "Right cone – top and base truncated",
  description: "A right cone cut at an angle by two planes. Defined by the diameter where the base cut crosses the axis, the cone angle, and each cut's angle.",
  formulaText: [
    "Rb = D/2 (mean),  Ha = Rb / tan(α/2)",
    "Base plane: z = tan β1 × x,  top plane: z = h + tan β2 × x",
    "Mark from apex = S × (Ha − z) / Ha",
  ],
  fields: [
    { ...D_FIELD, label: "Base dia D (at axis)" },
    DIA_REF,
    { key: "angle", label: "Cone angle α", kind: "number", unit: "deg" },
    { key: "baseAngle", label: "Base cut angle β1", kind: "number", unit: "deg", help: ANGLE_HELP },
    { key: "cutHeight", label: "Top cut height at axis h", kind: "number", unit: "mm" },
    { key: "cutAngle", label: "Top cut angle β2", kind: "number", unit: "deg", help: ANGLE_HELP },
    THK,
  ],
  compute(inp, { density }) {
    const t = pos(inp, "thk", "THK");
    const { Rb } = radii(inp, "d1", null, t);
    const a = pos(inp, "angle", "Cone angle α");
    if (a >= 180) throw new CalcError("Cone angle must be less than 180°");
    const Ha = Rb / Math.tan(deg(a / 2));
    const b1 = num(inp, "baseAngle", "Base cut angle β1");
    const b2 = num(inp, "cutAngle", "Top cut angle β2");
    const h = pos(inp, "cutHeight", "Top cut height h");
    if (Math.abs(b1) >= 89 || Math.abs(b2) >= 89) throw new CalcError("Cut angles must be between −89° and 89°");
    return developRightCone(
      { Rb, Ha, bottom: { h: 0, tan: Math.tan(deg(b1)) }, top: { h, tan: Math.tan(deg(b2)) } },
      t,
      density,
      [`Mean radius Rb = ${f(Rb)} mm, apex height Ha = ${f(Ha)} mm`, `Base cut: z = tan ${f(b1)}° × x;  top cut: z = ${f(h)} + tan ${f(b2)}° × x`],
    );
  },
};

// ---------- oblique cones (triangulated) ----------

const OBLIQUE_DIVISIONS = 360;

function obliqueCone(inp: ItemInputs, density: number, offsetOf: (Rb: number, rt: number) => number, label: string) {
  const t = pos(inp, "thk", "THK");
  const { Rb, rt } = radii(inp, "d1", "d2", t);
  if (rt <= 0) throw new CalcError("Top dia d must be more than 0");
  const H = pos(inp, "height", "Height H");
  const e = offsetOf(Rb, rt);
  const n = OBLIQUE_DIVISIONS;
  const bottom: V3[] = [];
  const top: V3[] = [];
  const lengths: number[] = [];
  for (let i = 0; i < n; i++) {
    const phi = (2 * Math.PI * i) / n;
    bottom.push([Rb * Math.cos(phi), Rb * Math.sin(phi), 0]);
    top.push([e + rt * Math.cos(phi), rt * Math.sin(phi), H]);
    lengths.push(Math.hypot(e + rt * Math.cos(phi) - Rb * Math.cos(phi), (rt - Rb) * Math.sin(phi), H));
  }
  // Seam on the shortest generator.
  const s = lengths.indexOf(Math.min(...lengths));
  const rot = <T,>(a: T[]) => [...a.slice(s), ...a.slice(0, s)];
  const flat = unrollStrip(rot(top), rot(bottom));
  const step = n / MARK_LINES;
  const marks: [Pt, Pt][] = [];
  const rows: number[][] = [];
  for (let i = 0; i <= MARK_LINES; i++) {
    const k = i * step;
    if (i > 0 && i < MARK_LINES) marks.push([flat.top[k], flat.bottom[k]]);
    rows.push([i, rot(lengths)[k % n]]);
  }
  const outline: Pt[] = [...flat.bottom, ...[...flat.top].reverse()];
  return devResult({ pieces: [{ name: "Oblique cone", count: 1, outline, marks, exactArea: flat.area }] }, t, density, {
    steps: [
      label,
      `Mean radii Rb = ${f(Rb)}, rt = ${f(rt)} mm, height H = ${f(H)} mm, offset e = ${f(e)} mm`,
      `Triangulated in ${n} divisions; true generator length L(φ) = √((e + rt cos φ − Rb cos φ)² + ((rt − Rb) sin φ)² + H²)`,
    ],
    development: { Rb, rt, height: H, offset: e, shortest: Math.min(...lengths), longest: Math.max(...lengths) },
    markTable: { title: "True generator lengths", columns: ["Line", "Length mm"], rows },
  });
}

export const coneOblique90: ItemType = {
  id: "cone-oblique-90",
  size: (i) => coneSize(i, `D2 ${n(i.d2)}`, `H ${n(i.height)}`),
  category: "fabricated",
  family: FAMILY,
  label: "Oblique cone – 90° side",
  description: "An oblique cone where one side is at a right angle (90°) to the base.",
  formulaText: ["e = Rb − rt (one side vertical)", "L(φ) = √((e + rt cos φ − Rb cos φ)² + ((rt − Rb) sin φ)² + H²)", "Developed by triangulation"],
  fields: [D_FIELD, d_FIELD, DIA_REF, { key: "height", label: "Height H", kind: "number", unit: "mm" }, THK],
  compute: (inp, { density }) => obliqueCone(inp, density, (Rb, rt) => Rb - rt, "Offset e = Rb − rt (vertical side)"),
};

export const coneObliqueOffset: ItemType = {
  id: "cone-oblique-offset",
  size: (i) => coneSize(i, `D2 ${n(i.d2)}`, `H ${n(i.height)}`, `offset ${n(i.offset)}`),
  category: "fabricated",
  family: FAMILY,
  label: "Oblique cone – offset in one direction",
  description: "An oblique cone where the height and the centre-to-centre offset of the top are known.",
  formulaText: ["L(φ) = √((e + rt cos φ − Rb cos φ)² + ((rt − Rb) sin φ)² + H²)", "Developed by triangulation"],
  fields: [
    D_FIELD,
    d_FIELD,
    DIA_REF,
    { key: "height", label: "Height H", kind: "number", unit: "mm" },
    { key: "offset", label: "Offset e (centre to centre)", kind: "number", unit: "mm" },
    THK,
  ],
  compute: (inp, { density }) => obliqueCone(inp, density, () => optNum(inp, "offset"), "Offset e as given"),
};

export const CONE_TYPES = [coneFrustumHeight, coneFrustumApex, coneFrustumAngle, coneTruncTop, coneTruncBase, coneTruncBoth, coneOblique90, coneObliqueOffset];
