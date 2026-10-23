import { CalcError, type FieldDef, type ItemInputs, type ItemType, type Pt } from "../types";
import { diaRef, f, meanDia, num, pos } from "../helpers";
import { devResult } from "../dev/result";
import { deg as angle, dia, join, n, thk } from "../size";

// Elbows and segmented bends (Plate'n'Sheets "Elbows – pipe to pipe" and
// "Segmented bends"). Every piece is a pipe length L on the centre-line with a
// mitre cut at each end. Unrolled from the seam, the cut edge at girth
// position s is offset c·R·cos(s/R) from the square line,
// with c = ±tan(mitre angle). Shape area = girth × L exactly.
// All pieces are cut from one sheet, sharing their cut lines:
// process = girth × total centre-line length (Shubham, 23 Oct 2026).

const THK: FieldDef = { key: "thk", label: "THK", kind: "number", unit: "mm" };
const DIA: FieldDef = { key: "dia", label: "Pipe diameter D", kind: "number", unit: "mm" };
const DIA_REF: FieldDef = {
  key: "diaRef",
  label: "Diameter given as",
  kind: "diaRef",
  options: [
    { value: "OD", label: "Outside" },
    { value: "MEAN", label: "Mean" },
    { value: "ID", label: "Inside" },
  ],
  default: "OD",
};
const SAMPLES = 180;
const MARK_LINES = 24;
const rad = (d: number) => (d * Math.PI) / 180;

/** One pipe piece: centre-line length L, end cuts c0 (bottom) and c1 (top) as multiples of R·cos φ. */
interface PipePiece {
  name: string;
  count: number;
  L: number;
  c0: number;
  c1: number;
}

function developPipePieces(inp: ItemInputs, density: number, family: string, pieces: PipePiece[], steps: (R: number, Dm: number) => string[], extra: (R: number) => Record<string, number>) {
  const t = pos(inp, "thk", "THK");
  const D = pos(inp, "dia", "Pipe diameter D");
  const Dm = meanDia(D, diaRef(inp), t);
  if (Dm <= 0) throw new CalcError("THK is too large for this diameter");
  const R = Dm / 2;
  const P = Math.PI * Dm;
  const edge = (c: number, base: number, s: number) => base + c * R * Math.cos(s / R);
  for (const p of pieces) {
    // Shortest line on the piece must stay positive, or the cuts cross.
    const shortest = Math.min(...[0, Math.PI].map((phi) => p.L + (p.c1 - p.c0) * R * Math.cos(phi)));
    if (!(shortest > 0)) throw new CalcError(`${p.name}: too short for this diameter and angle (the cuts cross) — increase the length or bend radius`);
  }
  const total = pieces.reduce((a, p) => a + p.L * p.count, 0);

  const devPieces = pieces.map((p) => {
    const bottom: Pt[] = [];
    const top: Pt[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const s = (P * i) / SAMPLES;
      bottom.push([s, edge(p.c0, 0, s)]);
      top.push([s, edge(p.c1, p.L, s)]);
    }
    const marks: [Pt, Pt][] = [];
    for (let i = 1; i < MARK_LINES; i++) {
      const s = (P * i) / MARK_LINES;
      marks.push([[s, edge(p.c0, 0, s)], [s, edge(p.c1, p.L, s)]]);
    }
    return {
      name: p.name,
      count: p.count,
      outline: [...bottom, ...top.reverse()],
      marks,
      dims: [{ kind: "text" as const, label: `L ${f(p.L, 1)} on centre-line`, at: [P / 2, p.L / 2] as Pt }],
      exactArea: P * p.L,
    };
  });

  // Marking table: line length at each girth division, per piece kind.
  const rows: number[][] = [];
  for (let i = 0; i <= MARK_LINES; i++) {
    const s = (P * i) / MARK_LINES;
    rows.push([i, s, ...pieces.map((p) => edge(p.c1, p.L, s) - edge(p.c0, 0, s))]);
  }

  return devResult({ pieces: devPieces }, t, density, {
    steps: [
      `Dm = ${f(Dm)} mm, girth π × Dm = ${f(P)} mm`,
      ...steps(R, Dm),
      `All pieces from one sheet ${f(P)} × ${f(total)} (girth × total centre-line length)`,
    ],
    development: { Dm, girth: P, totalLength: total, ...extra(R) },
    markTable: {
      title: `${family}: line lengths along the girth`,
      columns: ["Line", "Girth position mm", ...pieces.map((p) => `${p.name} mm`)],
      rows,
    },
    nestedSheet: { w: P, h: total },
  });
}

const leg = (key: string, label: string): FieldDef => ({ key, label, kind: "number", unit: "mm" });
const ELBOWS = "Elbows";
const BENDS = "Segmented bends";

/** Two-piece mitre elbow: legs L1, L2 to where the centre-lines meet; deflection δ (0 = straight). */
function mitreElbow(inp: ItemInputs, density: number, deflectionDeg: number, angleText: string) {
  const L1 = pos(inp, "leg1", "Leg 1");
  const L2 = pos(inp, "leg2", "Leg 2");
  const k = Math.tan(rad(deflectionDeg / 2));
  return developPipePieces(
    inp,
    density,
    "Elbow",
    [
      { name: `Leg 1 (${f(L1, 1)})`, count: 1, L: L1, c0: 0, c1: -k },
      { name: `Leg 2 (${f(L2, 1)})`, count: 1, L: L2, c0: -k, c1: 0 },
    ],
    (R) => [`${angleText}: mitre at ${f(deflectionDeg / 2)}°, cut offset ± R × tan ${f(deflectionDeg / 2)}° = ± ${f(R * k)} mm`],
    (R) => ({ cutOffset: R * k }),
  );
}

export const elbow90: ItemType = {
  id: "elbow-90",
  size: (i) => join(thk(i), dia(i), `legs ${n(i.leg1)} + ${n(i.leg2)}`, "90°"),
  category: "fabricated",
  family: ELBOWS,
  label: "Elbow – pipe to pipe – 90",
  description: "An elbow formed by two pipes meeting at 90°. Legs measured on the centre-line to where the centre-lines meet.",
  formulaText: ["Girth = π × Dm", "Mitre cut at 45°: offset = ± R × tan 45° = ± R", "Area = girth × (L1 + L2)", "Process = one sheet girth × (L1 + L2)"],
  fields: [DIA, DIA_REF, leg("leg1", "Leg 1 (vertical) L1"), leg("leg2", "Leg 2 (horizontal) L2"), THK],
  compute(inp, { density }) {
    return mitreElbow(inp, density, 90, "90° elbow");
  },
};

export const elbowAngle: ItemType = {
  id: "elbow-angle",
  size: (i) => join(thk(i), dia(i), `legs ${n(i.leg1)} + ${n(i.leg2)}`, angle(i.angle)),
  category: "fabricated",
  family: ELBOWS,
  label: "Elbow – pipe to pipe – angle",
  description: "An elbow formed by two pipes meeting at any angle. The angle is between the two legs (180° = straight).",
  formulaText: ["Bend δ = 180° − A", "Mitre at δ / 2: offset = ± R × tan(δ / 2)", "Area = girth × (L1 + L2)", "Process = one sheet girth × (L1 + L2)"],
  fields: [DIA, DIA_REF, leg("leg1", "Leg 1 L1"), leg("leg2", "Leg 2 L2"), { key: "angle", label: "Angle between legs A", kind: "number", unit: "deg" }, THK],
  compute(inp, { density }) {
    const A = num(inp, "angle", "Angle A");
    if (!(A > 0 && A < 180)) throw new CalcError("Angle between the legs must be between 0° and 180°");
    return mitreElbow(inp, density, 180 - A, `Angle ${f(A)}° → bend ${f(180 - A)}°`);
  },
};

export const elbowDouble: ItemType = {
  id: "elbow-double",
  size: (i) => join(thk(i), dia(i), `${n(i.top)} + rise ${n(i.rise)} + ${n(i.bottom)}`, `offset ${n(i.offset)}`),
  category: "fabricated",
  family: ELBOWS,
  label: "Elbow – pipe to pipe – double (centre-line)",
  description: "A double elbow joining two parallel pipes with an offset. All sizes on the centre-line.",
  formulaText: [
    "Middle length = √(rise² + offset²), bend δ = atan(offset / rise)",
    "Mitres at δ / 2, both cuts parallel",
    "Area = girth × (top + middle + bottom)",
    "Process = one sheet girth × total length",
  ],
  fields: [
    DIA,
    DIA_REF,
    leg("top", "Top straight T (to the bend)"),
    leg("rise", "Rise between bends H"),
    leg("bottom", "Bottom straight B (to the bend)"),
    leg("offset", "Offset between centre-lines E"),
    THK,
  ],
  compute(inp, { density }) {
    const T = pos(inp, "top", "Top straight");
    const H = pos(inp, "rise", "Rise");
    const B = pos(inp, "bottom", "Bottom straight");
    const E = pos(inp, "offset", "Offset");
    const M = Math.hypot(H, E);
    const bend = (Math.atan(E / H) * 180) / Math.PI;
    const k = Math.tan(rad(bend / 2));
    return developPipePieces(
      inp,
      density,
      "Double elbow",
      [
        { name: `Bottom (${f(B, 1)})`, count: 1, L: B, c0: 0, c1: -k },
        { name: `Middle (${f(M, 1)})`, count: 1, L: M, c0: -k, c1: -k },
        { name: `Top (${f(T, 1)})`, count: 1, L: T, c0: -k, c1: 0 },
      ],
      (R) => [
        `Middle = √(${f(H)}² + ${f(E)}²) = ${f(M)} mm, bend δ = atan(${f(E)} / ${f(H)}) = ${f(bend)}°`,
        `Mitres at ${f(bend / 2)}°: cut offset ± ${f(R * k)} mm`,
      ],
      (R) => ({ middle: M, bendAngle: bend, cutOffset: R * k }),
    );
  },
};

/** Segmented bend: n segments including the two half segments at the ends. */
function segmentedBend(inp: ItemInputs, density: number, sweepDeg: number) {
  const Rb = pos(inp, "bendRadius", "Bend radius");
  const segs = Math.round(num(inp, "segments", "Number of segments"));
  if (!(segs >= 2)) throw new CalcError("At least 2 segments (2 = a single mitre)");
  if (segs > 60) throw new CalcError("At most 60 segments");
  const half = sweepDeg / (2 * (segs - 1));
  const k = Math.tan(rad(half));
  const full = 2 * Rb * k;
  const pieces: PipePiece[] = [{ name: "End segment", count: 2, L: Rb * k, c0: 0, c1: -k }];
  if (segs > 2) pieces.push({ name: "Middle segment", count: segs - 2, L: full, c0: k, c1: -k });
  return developPipePieces(
    inp,
    density,
    "Segmented bend",
    pieces,
    (R) => [
        `${segs} segments = 2 half end segments + ${segs - 2} full; full segment angle ${f(sweepDeg)}° / ${segs - 1} = ${f(2 * half)}°`,
        `Full segment on centre-line = 2 × ${f(Rb)} × tan ${f(half)}° = ${f(full)} mm; end segment ${f(full / 2)} mm`,
        `Cut offset ± R × tan ${f(half)}° = ± ${f(R * k)} mm`,
    ],
    (R) => ({ segmentAngle: 2 * half, fullSegment: full, cutOffset: R * k }),
  );
}

const SEG_FIELDS: FieldDef[] = [
  DIA,
  DIA_REF,
  { key: "bendRadius", label: "Bend radius on centre-line", kind: "number", unit: "mm" },
  { key: "segments", label: "Number of segments (incl. 2 half ends)", kind: "number", unit: "nos", default: 5 },
];

export const segBend90: ItemType = {
  id: "seg-bend-90",
  size: (i) => join(thk(i), dia(i), `R ${n(i.bendRadius)}`, `${n(i.segments)} seg`, "90°"),
  category: "fabricated",
  family: BENDS,
  label: "Segmented bend – 90",
  description: "A 90° bend made of cylindrical segments; the two end segments are half segments.",
  formulaText: ["Full segment angle = 90° / (n − 1)", "Full segment length = 2 × Rb × tan(angle / 2)", "Area = girth × total centre-line length", "Process = one sheet girth × total length"],
  fields: [...SEG_FIELDS, THK],
  compute(inp, { density }) {
    return segmentedBend(inp, density, 90);
  },
};

export const segBendAngle: ItemType = {
  id: "seg-bend-angle",
  size: (i) => join(thk(i), dia(i), `R ${n(i.bendRadius)}`, `${n(i.segments)} seg`, angle(i.angle)),
  category: "fabricated",
  family: BENDS,
  label: "Segmented bend – angle",
  description: "A segmented bend of any angle (the bend / sweep angle); the two end segments are half segments.",
  formulaText: ["Full segment angle = θ / (n − 1)", "Full segment length = 2 × Rb × tan(angle / 2)", "Process = one sheet girth × total length"],
  fields: [...SEG_FIELDS, { key: "angle", label: "Bend angle θ", kind: "number", unit: "deg" }, THK],
  compute(inp, { density }) {
    const A = num(inp, "angle", "Bend angle θ");
    if (!(A > 0 && A <= 180)) throw new CalcError("Bend angle must be more than 0° and at most 180°");
    return segmentedBend(inp, density, A);
  },
};

export const ELBOW_TYPES = [elbow90, elbowAngle, elbowDouble, segBend90, segBendAngle];
