import type { ReactNode } from "react";

// Reference drawings for the item picker and the add-item screen, in the
// Plate'n'Sheets style: blue shape, cyan generator lines, dashed construction,
// green dash-dot centre line and black dimensions. The letters match the field
// labels on the form (D, d, H, Ha, α, β…).

const BLUE = "#1d4ed8";
const CYAN = "#06b6d4";
const GREEN = "#16a34a";
const INK = "#18181b";

function Defs() {
  return (
    <defs>
      <marker id="da" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,1 L9,5 L0,9 z" fill={INK} />
      </marker>
    </defs>
  );
}

const Label = ({ x, y, children, a = "middle" }: { x: number; y: number; children: ReactNode; a?: "start" | "middle" | "end" }) => (
  <text x={x} y={y} textAnchor={a} fontSize={12} fontStyle="italic" fontWeight={600} fill={INK} paintOrder="stroke" stroke="white" strokeWidth={3}>
    {children}
  </text>
);

/** Horizontal dimension between x1 and x2 at height y, with extension lines up/down to `from`. */
function DimH({ x1, x2, y, label, from }: { x1: number; x2: number; y: number; label: string; from?: [number, number] }) {
  return (
    <g>
      {from && <line x1={x1} y1={from[0]} x2={x1} y2={y + (y > from[0] ? 4 : -4)} stroke={INK} strokeWidth={0.6} />}
      {from && <line x1={x2} y1={from[1]} x2={x2} y2={y + (y > from[1] ? 4 : -4)} stroke={INK} strokeWidth={0.6} />}
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={INK} strokeWidth={0.9} markerStart="url(#da)" markerEnd="url(#da)" />
      <Label x={(x1 + x2) / 2} y={y - 4}>{label}</Label>
    </g>
  );
}

/** Vertical dimension between y1 and y2 at x, with extension lines across from `from`. */
function DimV({ y1, y2, x, label, from }: { y1: number; y2: number; x: number; label: string; from?: [number, number] }) {
  return (
    <g>
      {from && <line x1={from[0]} y1={y1} x2={x + (x > from[0] ? 4 : -4)} y2={y1} stroke={INK} strokeWidth={0.6} />}
      {from && <line x1={from[1]} y1={y2} x2={x + (x > from[1] ? 4 : -4)} y2={y2} stroke={INK} strokeWidth={0.6} />}
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={INK} strokeWidth={0.9} markerStart="url(#da)" markerEnd="url(#da)" />
      <Label x={x + (x > 110 ? 6 : -6)} y={(y1 + y2) / 2 + 4} a={x > 110 ? "start" : "end"}>{label}</Label>
    </g>
  );
}

/** Angle arc around (cx, cy) from a0 to a1 (degrees, screen: 0 = right, positive = down). */
function Angle({ cx, cy, r, a0, a1, label }: { cx: number; cy: number; r: number; a0: number; a1: number; label: string }) {
  const p = (a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const [lx, ly] = [cx + (r + 11) * Math.cos((((a0 + a1) / 2) * Math.PI) / 180), cy + (r + 11) * Math.sin((((a0 + a1) / 2) * Math.PI) / 180)];
  return (
    <g>
      <path d={`M${x0},${y0} A${r},${r} 0 ${large} ${a1 > a0 ? 1 : 0} ${x1},${y1}`} fill="none" stroke={INK} strokeWidth={0.9} markerStart="url(#da)" markerEnd="url(#da)" />
      <Label x={lx} y={ly + 4}>{label}</Label>
    </g>
  );
}

const Axis = ({ x, y1, y2 }: { x: number; y1: number; y2: number }) => (
  <line x1={x} y1={y1} x2={x} y2={y2} stroke={GREEN} strokeWidth={1} strokeDasharray="10 3 2 3" />
);
const Dashed = ({ d }: { d: string }) => <path d={d} fill="none" stroke="#9ca3af" strokeWidth={0.9} strokeDasharray="4 3" />;
const Shape = ({ d, fill = true }: { d: string; fill?: boolean }) => (
  <path d={d} fill={fill ? "#1d4ed810" : "none"} stroke={BLUE} strokeWidth={1.6} strokeLinejoin="round" />
);

/** Cyan generator lines between two edges (lists of points with the same count). */
function Gens({ top, bottom }: { top: [number, number][]; bottom: [number, number][] }) {
  return (
    <g stroke={CYAN} strokeWidth={0.9}>
      {top.map(([x1, y1], i) => (
        <line key={i} x1={x1} y1={y1} x2={bottom[i][0]} y2={bottom[i][1]} />
      ))}
    </g>
  );
}

const span = (a: number, b: number, n: number) => Array.from({ length: n }, (_, i) => a + ((b - a) * (i + 1)) / (n + 1));

function Svg({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 220 200" className="h-auto w-full" role="img" aria-label={label}>
      <Defs />
      {children}
    </svg>
  );
}

// ---------- cones ----------

const CX = 110, YB = 160, RB = 66, YT = 80, RT = 26;
const APEX = YB - ((YB - YT) * RB) / (RB - RT); // apex y for the frustum above

function FrustumBase({ showApex = true }: { showApex?: boolean }) {
  const gx = span(CX - RT, CX + RT, 4);
  const bx = gx.map((x) => CX + ((x - CX) * RB) / RT);
  return (
    <>
      {showApex && <Dashed d={`M${CX - RT},${YT} L${CX},${APEX} L${CX + RT},${YT}`} />}
      <Gens top={gx.map((x) => [x, YT])} bottom={bx.map((x) => [x, YB])} />
      <Shape d={`M${CX - RB},${YB} L${CX + RB},${YB} L${CX + RT},${YT} L${CX - RT},${YT} Z`} />
      <Axis x={CX} y1={APEX - 6} y2={YB + 12} />
    </>
  );
}

const DIAGRAMS: Record<string, () => ReactNode> = {
  cone: () => (
    <Svg label="Right cone frustum: base dia D, top dia d, height H">
      <FrustumBase />
      <DimH x1={CX - RB} x2={CX + RB} y={182} label="D" from={[YB, YB]} />
      <DimH x1={CX - RT} x2={CX + RT} y={APEX + 8} label="d" from={[YT, YT]} />
      <DimV y1={YT} y2={YB} x={196} label="H" from={[CX + RT, CX + RB]} />
    </Svg>
  ),
  "cone-apex": () => (
    <Svg label="Right cone frustum: base dia D, top dia d, apex height Ha">
      <FrustumBase />
      <DimH x1={CX - RB} x2={CX + RB} y={182} label="D" from={[YB, YB]} />
      <DimH x1={CX - RT} x2={CX + RT} y={YT - 12} label="d" from={[YT, YT]} />
      <DimV y1={APEX} y2={YB} x={196} label="Ha" from={[CX, CX + RB]} />
    </Svg>
  ),
  "cone-angle": () => (
    <Svg label="Right cone frustum: base dia D, top dia d, cone angle alpha">
      <FrustumBase />
      <DimH x1={CX - RB} x2={CX + RB} y={182} label="D" from={[YB, YB]} />
      <DimH x1={CX - RT} x2={CX + RT} y={YT - 12} label="d" from={[YT, YT]} />
      <Angle cx={CX} cy={APEX} r={86} a0={90 - (Math.atan(RB / (YB - APEX)) * 180) / Math.PI} a1={90 + (Math.atan(RB / (YB - APEX)) * 180) / Math.PI} label="α" />
    </Svg>
  ),
  "cone-trunc-top": () => (
    <TruncCone
      label="Right cone top truncated: base dia D, cone angle alpha, cut height h at the axis, cut angle beta"
      top={{ y: 104, m: -0.45 }}
      dims={(g) => (
        <>
          <DimH x1={g.bl[0]} x2={g.br[0]} y={182} label="D" from={[YB, YB]} />
          <DimV y1={104} y2={YB} x={18} label="h" from={[CX, g.bl[0]]} />
          <line x1={g.tr[0]} y1={g.tr[1]} x2={g.tr[0] + 36} y2={g.tr[1]} stroke={INK} strokeWidth={0.6} />
          <Angle cx={g.tr[0]} cy={g.tr[1]} r={30} a0={-24} a1={0} label="β" />
          <Angle cx={CX} cy={g.apex} r={36} a0={90 - g.halfDeg} a1={90 + g.halfDeg} label="α" />
        </>
      )}
    />
  ),
  "cone-trunc-base": () => (
    <TruncCone
      label="Right cone base truncated: dia D at the axis, top dia d, height H, base cut angle beta"
      top={{ y: YT, m: 0 }}
      bottom={{ m: 0.3 }}
      dims={(g) => (
        <>
          <Dashed d={`M${CX - g.w},${YB} L${CX + g.w},${YB}`} />
          <DimH x1={g.tl[0]} x2={g.tr[0]} y={YT - 12} label="d" from={[YT, YT]} />
          <DimH x1={CX - g.w} x2={CX + g.w} y={194} label="D" from={[YB, YB]} />
          <DimV y1={YT} y2={YB} x={18} label="H" from={[g.tl[0], CX - g.w]} />
          <Angle cx={CX} cy={YB} r={50} a0={0} a1={16.7} label="β" />
        </>
      )}
    />
  ),
  "cone-trunc-both": () => (
    <TruncCone
      label="Right cone top and base truncated: dia D at the axis, cone angle alpha, base cut beta1, top cut height h and angle beta2"
      top={{ y: 96, m: -0.42 }}
      bottom={{ m: 0.28 }}
      dims={(g) => (
        <>
          <Dashed d={`M${CX - g.w},${YB} L${CX + g.w},${YB}`} />
          <DimH x1={CX - g.w} x2={CX + g.w} y={194} label="D" from={[YB, YB]} />
          <DimV y1={96} y2={YB} x={18} label="h" from={[CX, CX - g.w]} />
          <Angle cx={CX} cy={YB} r={46} a0={0} a1={15.6} label="β1" />
          <line x1={g.tr[0]} y1={g.tr[1]} x2={g.tr[0] + 34} y2={g.tr[1]} stroke={INK} strokeWidth={0.6} />
          <Angle cx={g.tr[0]} cy={g.tr[1]} r={28} a0={-23} a1={0} label="β2" />
          <Angle cx={CX} cy={g.apex} r={34} a0={90 - g.halfDeg} a1={90 + g.halfDeg} label="α" />
        </>
      )}
    />
  ),
  "cone-oblique-90": () => (
    <Svg label="Oblique cone with one side at 90 degrees: base dia D, top dia d, height H">
      <Gens top={span(150 - 2 * RT, 150, 4).map((x) => [x, YT])} bottom={span(150 - 2 * RB, 150, 4).map((x) => [x, YB])} />
      <Shape d={`M${150 - 2 * RB},${YB} L${150},${YB} L${150},${YT} L${150 - 2 * RT},${YT} Z`} />
      <Axis x={150 - RT} y1={YT - 10} y2={YT + 20} />
      <Axis x={150 - RB} y1={YB - 20} y2={YB + 10} />
      <DimH x1={150 - 2 * RB} x2={150} y={182} label="D" from={[YB, YB]} />
      <DimH x1={150 - 2 * RT} x2={150} y={YT - 14} label="d" from={[YT, YT]} />
      <DimV y1={YT} y2={YB} x={22} label="H" from={[150 - 2 * RT, 150 - 2 * RB]} />
      <Label x={176} y={YB - 6}>90°</Label>
    </Svg>
  ),
  "cone-oblique-offset": () => {
    const tc = CX + 34;
    return (
      <Svg label="Oblique cone offset in one direction: base dia D, top dia d, height H, offset e">
        <Gens top={span(tc - RT, tc + RT, 4).map((x) => [x, YT])} bottom={span(CX - RB, CX + RB, 4).map((x) => [x, YB])} />
        <Shape d={`M${CX - RB},${YB} L${CX + RB},${YB} L${tc + RT},${YT} L${tc - RT},${YT} Z`} />
        <Axis x={CX} y1={40} y2={YB + 10} />
        <Axis x={tc} y1={40} y2={YT + 16} />
        <DimH x1={CX - RB} x2={CX + RB} y={182} label="D" from={[YB, YB]} />
        <DimH x1={tc - RT} x2={tc + RT} y={YT - 12} label="d" from={[YT, YT]} />
        <DimH x1={CX} x2={tc} y={46} label="e" />
        <DimV y1={YT} y2={YB} x={22} label="H" from={[tc - RT, CX - RB]} />
      </Svg>
    );
  },

  // ---------- cylinders ----------
  shell: () => <Cyl top={() => 50} dims={<DimV y1={50} y2={YB} x={40} label="H" from={[75, 75]} />} />,
  "cyl-trunc": () => (
    <Cyl
      top={(x) => 70 - 0.5 * (x - CX)}
      dims={
        <>
          <DimV y1={70} y2={YB} x={40} label="H" from={[CX, 75]} />
          <Angle cx={145} cy={70 - 0.5 * 35} r={30} a0={-27} a1={0} label="β" />
          <line x1={145} y1={52.5} x2={182} y2={52.5} stroke={INK} strokeWidth={0.6} />
        </>
      }
    />
  ),
  "cyl-trunc-side": () => (
    <Cyl
      top={(x) => 70 - 0.5 * (x - CX)}
      dims={
        <>
          <DimV y1={87.5} y2={YB} x={40} label="h" from={[75, 75]} />
          <line x1={75} y1={87.5} x2={112} y2={87.5} stroke={INK} strokeWidth={0.6} strokeDasharray="3 2" />
          <Angle cx={75} cy={87.5} r={30} a0={-27} a1={0} label="β" />
        </>
      }
    />
  ),
  "cyl-trunc-heights": () => (
    <Cyl
      top={(x) => 70 + 0.5 * (x - CX)}
      dims={
        <>
          <DimV y1={52.5} y2={YB} x={40} label="h1" from={[75, 75]} />
          <DimV y1={87.5} y2={YB} x={182} label="h2" from={[145, 145]} />
        </>
      }
    />
  ),
  "cyl-trunc-radius": () => (
    <Cyl
      top={(x) => 52 + 0.012 * (x - CX) ** 2}
      dims={
        <>
          <DimV y1={52} y2={YB} x={40} label="H" from={[CX, 75]} />
          <line x1={CX} y1={110} x2={CX + 36} y2={58} stroke={INK} strokeWidth={0.9} markerEnd="url(#da)" />
          <Label x={CX + 20} y={98} a="start">Rc</Label>
        </>
      }
    />
  ),
  "cyl-gable": () => (
    <Cyl
      top={(x) => 52 + 0.6 * Math.abs(x - CX)}
      dims={
        <>
          <DimV y1={52} y2={YB} x={40} label="H" from={[CX, 75]} />
          <Angle cx={145} cy={73} r={30} a0={-31} a1={0} label="β" />
          <line x1={145} y1={73} x2={182} y2={73} stroke={INK} strokeWidth={0.6} />
        </>
      }
    />
  ),

  // ---------- end caps ----------
  "dish-hemi": () => <Dish depth={66} label="Hemispherical end cap: base dia D, straight face SF" />,
  "dish-ellip": () => <Dish depth={36} showDepth label="Semi-elliptical end cap: base dia D, dish height h, straight face SF" />,
  "dish-tori": () => <Dish depth={30} tori label="Torispherical end cap: base dia D, crown radius CR, knuckle radius KR, straight face SF" />,
  "dished-end": () => <Dish depth={30} tori label="Dished end (blank by factor): dish OD, straight face SF" />,

  // ---------- plates, flanges, hoppers ----------
  plate: () => (
    <Svg label="Plate: length L, width W">
      <Shape d="M40,60 L180,60 L180,150 L40,150 Z" />
      <DimH x1={40} x2={180} y={172} label="L" from={[150, 150]} />
      <DimV y1={60} y2={150} x={22} label="W" from={[40, 40]} />
    </Svg>
  ),
  flat: () => (
    <Svg label="Flat: width W, thickness t, cut length L">
      <Shape d="M24,92 L196,92 L196,118 L24,118 Z" />
      <Shape d="M24,92 L36,80 L208,80 L196,92 M196,118 L208,106 L208,80" fill={false} />
      <DimH x1={24} x2={196} y={142} label="L" from={[118, 118]} />
      <DimV y1={92} y2={118} x={12} label="W" from={[24, 24]} />
      <Label x={214} y={98} a="end">t</Label>
    </Svg>
  ),
  "bent-plate": () => (
    <Svg label="Bent plate: girth is the sum of the legs, length L">
      <Shape d="M60,60 L60,140 L160,140 L160,60" fill={false} />
      <Label x={110} y={160}>girth = a + b + c</Label>
      <Label x={48} y={104} a="end">a</Label>
      <Label x={110} y={132}>b</Label>
      <Label x={172} y={104} a="start">c</Label>
    </Svg>
  ),
  disc: () => (
    <Svg label="Disc: diameter D">
      <circle cx={CX} cy={100} r={60} fill="#1d4ed810" stroke={BLUE} strokeWidth={1.6} />
      <Axis x={CX} y1={30} y2={170} />
      <DimH x1={CX - 60} x2={CX + 60} y={184} label="D" from={[100, 100]} />
    </Svg>
  ),
  "ring-flange": () => (
    <Svg label="Ring flange: OD, ID, PCD with n holes of dia h">
      <circle cx={CX} cy={96} r={66} fill="#1d4ed810" stroke={BLUE} strokeWidth={1.6} />
      <circle cx={CX} cy={96} r={36} fill="white" stroke={BLUE} strokeWidth={1.6} />
      <circle cx={CX} cy={96} r={51} fill="none" stroke={GREEN} strokeWidth={0.8} strokeDasharray="8 3 2 3" />
      {Array.from({ length: 8 }, (_, i) => (
        <circle key={i} cx={CX + 51 * Math.cos((i * Math.PI) / 4 + Math.PI / 8)} cy={96 + 51 * Math.sin((i * Math.PI) / 4 + Math.PI / 8)} r={5} fill="white" stroke={BLUE} strokeWidth={1.2} />
      ))}
      <DimH x1={CX - 66} x2={CX + 66} y={184} label="OD" from={[96, 96]} />
      <DimH x1={CX - 36} x2={CX + 36} y={100} label="ID" />
      <Label x={CX} y={22}>PCD, n holes × h</Label>
    </Svg>
  ),
  "rect-flange": () => (
    <Svg label="Rectangular flange: outer L by W, inner l by w">
      <path d="M36,50 L184,50 L184,154 L36,154 Z M66,74 L154,74 L154,130 L66,130 Z" fill="#1d4ed810" fillRule="evenodd" stroke={BLUE} strokeWidth={1.6} />
      <DimH x1={36} x2={184} y={176} label="L" from={[154, 154]} />
      <DimV y1={50} y2={154} x={18} label="W" from={[36, 36]} />
      <DimH x1={66} x2={154} y={92} label="l" />
      <DimV y1={74} y2={130} x={140} label="w" />
    </Svg>
  ),
  "pyramid-hopper": () => (
    <Svg label="Pyramid hopper: top L by W, bottom l by w, height H">
      <Shape d="M30,50 L190,50 L136,150 L84,150 Z" />
      <Dashed d="M60,50 L96,150 M160,50 L124,150" />
      <DimH x1={30} x2={190} y={34} label="L (top)" from={[50, 50]} />
      <DimH x1={84} x2={136} y={172} label="l (bottom)" from={[150, 150]} />
      <DimV y1={50} y2={150} x={16} label="H" from={[30, 84]} />
    </Svg>
  ),
  "rect-duct": () => (
    <Svg label="Rectangular duct: length L, width W, height H">
      <Shape d="M40,80 L150,80 L150,150 L40,150 Z" />
      <Shape d="M40,80 L70,56 L180,56 L150,80 M150,150 L180,126 L180,56" fill={false} />
      <DimH x1={40} x2={150} y={170} label="L" from={[150, 150]} />
      <DimV y1={80} y2={150} x={22} label="H" from={[40, 40]} />
      <Label x={176} y={150} a="start">W</Label>
    </Svg>
  ),
};

interface TruncGeom {
  apex: number;
  w: number;
  halfDeg: number;
  bl: [number, number];
  br: [number, number];
  tl: [number, number];
  tr: [number, number];
}

/**
 * A right cone (apex above the axis) between a top cut y = top.y + top.m·(x − CX)
 * and a bottom cut through (CX, YB) with slope bottom.m. Corners are computed,
 * so the cuts always meet the cone's sides.
 */
function TruncCone({
  label,
  top,
  bottom = { m: 0 },
  dims,
}: {
  label: string;
  top: { y: number; m: number };
  bottom?: { m: number };
  dims: (g: TruncGeom) => ReactNode;
}) {
  const apex = 22;
  const w = 74; // half-width where the bottom cut crosses the axis level
  // Point where the line from the apex through (CX + s, YB) meets y = c + m(x − CX).
  const meet = (s: number, c: number, m: number): [number, number] => {
    const dx = s;
    const dy = YB - apex;
    const t = (c - apex) / (dy - m * dx);
    return [CX + t * dx, apex + t * dy];
  };
  const bl = meet(-w, YB, bottom.m);
  const br = meet(w, YB, bottom.m);
  const tl = meet(-w, top.y, top.m);
  const tr = meet(w, top.y, top.m);
  const gens = span(-w, w, 4).map((s) => ({ t: meet(s, top.y, top.m), b: meet(s, YB, bottom.m) }));
  const g: TruncGeom = { apex, w, halfDeg: (Math.atan(w / (YB - apex)) * 180) / Math.PI, bl, br, tl, tr };
  return (
    <Svg label={label}>
      <Dashed d={`M${tl[0]},${tl[1]} L${CX},${apex} L${tr[0]},${tr[1]}`} />
      <Gens top={gens.map((p) => p.t)} bottom={gens.map((p) => p.b)} />
      <Shape d={`M${bl[0]},${bl[1]} L${br[0]},${br[1]} L${tr[0]},${tr[1]} L${tl[0]},${tl[1]} Z`} />
      <Axis x={CX} y1={apex - 6} y2={196} />
      {dims(g)}
    </Svg>
  );
}

function Cyl({ top, dims }: { top: (x: number) => number; dims: ReactNode }) {
  const xs = Array.from({ length: 36 }, (_, i) => 75 + (70 * i) / 35);
  const topPath = xs.map((x, i) => `${i ? "L" : "M"}${x},${top(x)}`).join(" ");
  return (
    <Svg label="Right cylinder">
      <Gens top={span(75, 145, 4).map((x) => [x, top(x)])} bottom={span(75, 145, 4).map((x) => [x, YB])} />
      <Shape d={`${topPath} L145,${YB} L75,${YB} Z`} />
      <Axis x={CX} y1={30} y2={YB + 12} />
      <DimH x1={75} x2={145} y={182} label="D" from={[YB, YB]} />
      {dims}
    </Svg>
  );
}

function Dish({ depth, showDepth, tori, label }: { depth: number; showDepth?: boolean; tori?: boolean; label: string }) {
  const base = 128;
  const a = 72;
  const dome = tori
    ? `M${CX - a},${base} Q${CX - a},${base - 22} ${CX - a + 22},${base - 26} Q${CX},${base - depth - 10} ${CX + a - 22},${base - 26} Q${CX + a},${base - 22} ${CX + a},${base}`
    : `M${CX - a},${base} A${a},${depth} 0 0 1 ${CX + a},${base}`;
  return (
    <Svg label={label}>
      <path d={`${dome} L${CX + a},${base + 12} L${CX - a},${base + 12} Z`} fill="#1d4ed810" stroke={BLUE} strokeWidth={1.6} />
      <line x1={CX - a} y1={base} x2={CX + a} y2={base} stroke={CYAN} strokeWidth={1} />
      <Axis x={CX} y1={base - depth - 22} y2={base + 26} />
      <DimH x1={CX - a} x2={CX + a} y={172} label="D" from={[base + 12, base + 12]} />
      <DimV y1={base} y2={base + 12} x={196} label="SF" from={[CX + a, CX + a]} />
      {showDepth && <DimV y1={base - depth} y2={base} x={22} label="h" from={[CX, CX - a]} />}
      {tori && (
        <>
          <line x1={CX + 6} y1={196} x2={CX - 4} y2={base - depth - 4} stroke={INK} strokeWidth={0.9} markerEnd="url(#da)" />
          <Label x={CX + 10} y={190} a="start">CR</Label>
          <line x1={CX - a + 22} y1={base - 4} x2={CX - a + 4} y2={base - 18} stroke={INK} strokeWidth={0.9} markerEnd="url(#da)" />
          <Label x={CX - a + 26} y={base - 6} a="start">KR</Label>
        </>
      )}
    </Svg>
  );
}

/** Elevation drawing with lettered dimensions, or null when the type has none yet. */
export function ReferenceDiagram({ typeId }: { typeId: string }) {
  const d = DIAGRAMS[typeId];
  return d ? <>{d()}</> : null;
}

export const hasDiagram = (typeId: string) => typeId in DIAGRAMS;

// ---------- small 3D tiles for the picker ----------

const GRAD = (
  <defs>
    <linearGradient id="metal" x1="0" x2="1">
      <stop offset="0" stopColor="#6b7280" />
      <stop offset="0.35" stopColor="#e5e7eb" />
      <stop offset="0.7" stopColor="#9ca3af" />
      <stop offset="1" stopColor="#4b5563" />
    </linearGradient>
  </defs>
);

/** A body of revolution: bottom ellipse (x half-width rb), top ellipse (rt, tilt in degrees), heights. */
function Solid({ rb, rt, top, tilt = 0, dx = 0, roundTop }: { rb: number; rt: number; top: number; tilt?: number; dx?: number; roundTop?: "dome" | "radius" | "gable" }) {
  const c = 40, yb = 66, eb = rb * 0.3, et = rt * 0.3;
  const tc = c + dx;
  const yt = top;
  const slope = Math.tan((tilt * Math.PI) / 180);
  const left: [number, number] = [tc - rt, yt + slope * rt];
  const right: [number, number] = [tc + rt, yt - slope * rt];
  let body: string;
  let lid: ReactNode;
  if (roundTop === "dome") {
    body = `M${c - rb},${yb} A${rb},${yb - yt} 0 0 1 ${c + rb},${yb} A${rb},${eb} 0 0 1 ${c - rb},${yb} Z`;
    lid = null;
  } else if (roundTop === "radius" || roundTop === "gable") {
    const peak = yt - 8;
    body =
      roundTop === "radius"
        ? `M${c - rb},${yb} L${c - rb},${yt} Q${c},${peak - 6} ${c + rb},${yt} L${c + rb},${yb} A${rb},${eb} 0 0 1 ${c - rb},${yb} Z`
        : `M${c - rb},${yb} L${c - rb},${yt} L${c},${peak} L${c + rb},${yt} L${c + rb},${yb} A${rb},${eb} 0 0 1 ${c - rb},${yb} Z`;
    lid = null;
  } else {
    body = `M${c - rb},${yb} L${left[0]},${left[1]} L${right[0]},${right[1]} L${c + rb},${yb} A${rb},${eb} 0 0 1 ${c - rb},${yb} Z`;
    lid = <ellipse cx={tc} cy={yt} rx={rt} ry={et} transform={`rotate(${-tilt} ${tc} ${yt})`} fill="#374151" stroke="#1f2937" strokeWidth={0.6} />;
  }
  return (
    <svg viewBox="0 0 80 80" className="size-14 shrink-0" aria-hidden="true">
      {GRAD}
      <path d={body} fill="url(#metal)" stroke="#374151" strokeWidth={0.6} />
      {lid}
    </svg>
  );
}

const TILES: Record<string, () => ReactNode> = {
  cone: () => <Solid rb={26} rt={12} top={16} />,
  "cone-apex": () => <Solid rb={26} rt={12} top={16} />,
  "cone-angle": () => <Solid rb={26} rt={12} top={16} />,
  "cone-trunc-top": () => <Solid rb={26} rt={14} top={22} tilt={22} />,
  "cone-trunc-base": () => <Solid rb={26} rt={10} top={14} tilt={-12} />,
  "cone-trunc-both": () => <Solid rb={24} rt={13} top={20} tilt={25} />,
  "cone-oblique-90": () => <Solid rb={24} rt={11} top={16} dx={13} />,
  "cone-oblique-offset": () => <Solid rb={24} rt={11} top={16} dx={9} />,
  shell: () => <Solid rb={18} rt={18} top={12} />,
  "cyl-trunc": () => <Solid rb={18} rt={18} top={16} tilt={22} />,
  "cyl-trunc-side": () => <Solid rb={18} rt={18} top={16} tilt={22} />,
  "cyl-trunc-heights": () => <Solid rb={18} rt={18} top={16} tilt={-20} />,
  "cyl-trunc-radius": () => <Solid rb={18} rt={18} top={20} roundTop="radius" />,
  "cyl-gable": () => <Solid rb={18} rt={18} top={22} roundTop="gable" />,
  "dish-hemi": () => <Solid rb={28} rt={28} top={30} roundTop="dome" />,
  "dish-ellip": () => <Solid rb={28} rt={28} top={44} roundTop="dome" />,
  "dish-tori": () => <Solid rb={28} rt={28} top={50} roundTop="dome" />,
  "dished-end": () => <Solid rb={28} rt={28} top={50} roundTop="dome" />,
};

/** Picker tile picture: a 3D solid where we have one, else the elevation drawing. */
export function TypeTile({ typeId }: { typeId: string }) {
  const t = TILES[typeId];
  if (t) return <>{t()}</>;
  const d = DIAGRAMS[typeId];
  if (d) return <div className="w-16 shrink-0">{d()}</div>;
  return <div className="size-14 shrink-0 rounded-md bg-paper" aria-hidden="true" />;
}
