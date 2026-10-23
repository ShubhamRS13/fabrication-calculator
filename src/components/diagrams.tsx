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
  "transition-rect-round": () => (
    <Svg label="Transition rectangle to round: plan with sides A and B, round dia D, corner radius r; elevation with height H">
      {/* plan: lines fan from each corner to a quarter of the circle (centre 78,80, radius 30) */}
      <Gens
        top={[[78, 50], [57, 59], [48, 80], [78, 50], [99, 59], [108, 80], [78, 110], [57, 101], [48, 80], [78, 110], [99, 101], [108, 80]]}
        bottom={[[33, 31], [33, 31], [33, 31], [123, 31], [123, 31], [123, 31], [33, 129], [33, 129], [33, 129], [123, 129], [123, 129], [123, 129]]}
      />
      <Shape d="M38,30 L118,30 Q124,30 124,36 L124,124 Q124,130 118,130 L38,130 Q32,130 32,124 L32,36 Q32,30 38,30 Z" fill={false} />
      <circle cx={78} cy={80} r={30} fill="#1d4ed810" stroke={BLUE} strokeWidth={1.6} />
      <line x1={57} y1={101} x2={99} y2={59} stroke={INK} strokeWidth={0.9} markerStart="url(#da)" markerEnd="url(#da)" />
      <Label x={88} y={86}>D</Label>
      <Label x={128} y={26} a="start">r</Label>
      <DimH x1={32} x2={124} y={150} label="A" from={[130, 130]} />
      <DimV y1={30} y2={130} x={16} label="B" from={[32, 32]} />
      {/* elevation */}
      <Gens top={[[154, 120], [168, 120], [182, 120]]} bottom={[[136, 180], [168, 180], [200, 180]]} />
      <Shape d="M136,180 L200,180 L182,120 L154,120 Z" />
      <Axis x={168} y1={110} y2={190} />
      <DimV y1={120} y2={180} x={210} label="" from={[182, 200]} />
      <Label x={214} y={154}>H</Label>
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

  // ---------- sections (cross-sections; L = cut length) ----------
  "pipe-sch": () => <PipeSection label="Pipe by NB and schedule: OD and wall t from the table, cut length L" od="NB" t="SCH" />,
  "pipe-is1239": () => <PipeSection label="IS 1239 pipe: OD and wall t from the table, cut length L" od="NB" t="class" />,
  "pipe-swg": () => <PipeSection label="Tube: OD, wall from SWG, cut length L" od="OD" t="SWG" />,
  "pipe-custom": () => <PipeSection label="Tube: OD, wall thickness t, cut length L" od="OD" t="t" />,
  "rect-tube": () => (
    <Svg label="Rectangular tube: sides A and B, thickness t">
      <path d="M50,40 L170,40 L170,150 L50,150 Z M60,50 L160,50 L160,140 L60,140 Z" fill="#1d4ed810" fillRule="evenodd" stroke={BLUE} strokeWidth={1.6} />
      <DimH x1={50} x2={170} y={172} label="A" from={[150, 150]} />
      <DimV y1={40} y2={150} x={194} label="B" from={[170, 170]} />
      <Label x={64} y={34} a="start">t</Label>
      <CutLength />
    </Svg>
  ),
  "round-bar": () => (
    <Svg label="Round bar: diameter d">
      <circle cx={CX} cy={95} r={52} fill="#1d4ed810" stroke={BLUE} strokeWidth={1.6} />
      <Axis x={CX} y1={32} y2={158} />
      <DimH x1={CX - 52} x2={CX + 52} y={170} label="d" from={[95, 95]} />
      <CutLength />
    </Svg>
  ),
  "square-bar": () => (
    <Svg label="Square bar: side a">
      <rect x={60} y={45} width={100} height={100} fill="#1d4ed810" stroke={BLUE} strokeWidth={1.6} />
      <DimH x1={60} x2={160} y={168} label="a" from={[145, 145]} />
      <CutLength />
    </Svg>
  ),
  "hex-bar": () => {
    const pts = Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i;
      // Rounded: server and browser maths can differ in the last digit (hydration mismatch).
      return `${(CX + 58 * Math.cos(a)).toFixed(2)},${(95 + 58 * Math.sin(a)).toFixed(2)}`;
    });
    return (
      <Svg label="Hex bar: across flats s">
        <polygon points={pts.join(" ")} fill="#1d4ed810" stroke={BLUE} strokeWidth={1.6} />
        <DimV y1={95 - 50.2} y2={95 + 50.2} x={190} label="s" from={[CX + 29, CX + 29]} />
        <CutLength />
      </Svg>
    );
  },
  "angle-std": () => <AngleSection label="Angle ISA: legs A and B, thickness t, from the table" />,
  "angle-true": () => <AngleSection label="Angle: legs A and B, thickness t" />,
  "angle-custom": () => <AngleSection label="Angle (workbook formula): leg width W, thickness t" equal />,
  "channel-std": () => <ChannelSection label="Channel ISMC / ISLC / ISJC from the table: depth D, flange B" />,
  "beam-i": () => <BeamSection label="I beam from the table: depth D, flange B" />,
  "beam-h": () => <BeamSection label="H beam ISHB from the table: depth D, flange B" wide />,
  structural: () => <BeamSection label="Rolled section from the table" />,
  "section-custom": () => <BeamSection label="Custom I / H / C: depth D, flange width B, web tw, flange tf" thicknesses />,
};

// ---------- elbows and segmented bends ----------

type P2 = [number, number];

/** A pipe bent along the centre-line `pts` (half-width w), each piece ending on its mitre line. */
function BentPipe({ pts, w }: { pts: P2[]; w: number }) {
  const unit = (a: P2, b: P2): P2 => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  };
  const perp = (d: P2): P2 => [-d[1], d[0]];
  // Mitre line at each vertex: the two edge points of the pipe there.
  const cuts = pts.map((p, i) => {
    const n0 = i > 0 ? perp(unit(pts[i - 1], p)) : null;
    const n1 = i < pts.length - 1 ? perp(unit(p, pts[i + 1])) : null;
    const n = n0 && n1 ? unit([0, 0], [n0[0] + n1[0], n0[1] + n1[1]]) : (n0 ?? n1)!;
    const k = w / (n[0] * (n0 ?? n1)![0] + n[1] * (n0 ?? n1)![1]);
    return [[p[0] + n[0] * k, p[1] + n[1] * k], [p[0] - n[0] * k, p[1] - n[1] * k]] as [P2, P2];
  });
  const line = (pp: P2[]) => pp.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  // Generator lines at quarter points across each cut, rounded (no hydration mismatch).
  const across = ([a, b]: [P2, P2]) => [0.25, 0.5, 0.75].map((s): P2 => [+(a[0] + (b[0] - a[0]) * s).toFixed(1), +(a[1] + (b[1] - a[1]) * s).toFixed(1)]);
  return (
    <>
      {cuts.slice(0, -1).map((c, i) => (
        <g key={i}>
          <Gens top={across(c)} bottom={across(cuts[i + 1])} />
          <Shape d={`${line([c[0], cuts[i + 1][0], cuts[i + 1][1], c[1]])} Z`} />
        </g>
      ))}
      <path d={line(pts)} fill="none" stroke={GREEN} strokeWidth={1} strokeDasharray="10 3 2 3" />
    </>
  );
}

/** Centre-line of a segmented bend: centre c, radius r, sweep (deg, anticlockwise from the +x side), n segments incl. 2 half ends. */
function segPoints(c: P2, r: number, sweep: number, n: number): P2[] {
  const half = (sweep / (2 * (n - 1)) * Math.PI) / 180;
  const at = (a: number, rr: number): P2 => [c[0] + rr * Math.cos(a), c[1] - rr * Math.sin(a)];
  const pts: P2[] = [at(0, r)];
  for (let j = 0; j < n - 1; j++) pts.push(at(half * (2 * j + 1), r / Math.cos(half)));
  pts.push(at((sweep * Math.PI) / 180, r));
  return pts;
}

const ELBOW_DIAGRAMS: Record<string, () => ReactNode> = {
  "elbow-90": () => (
    <Svg label="Elbow pipe to pipe 90°: pipe dia D, leg L1 and leg L2 on the centre-line to where the centre-lines meet">
      <BentPipe pts={[[80, 182], [80, 70], [196, 70]]} w={20} />
      <DimV y1={70} y2={182} x={36} label="L1" from={[80, 60]} />
      <DimH x1={80} x2={196} y={28} label="L2" from={[70, 50]} />
      <DimV y1={50} y2={90} x={210} label="" />
      <Label x={206} y={110} a="end">D</Label>
      <Angle cx={80} cy={70} r={30} a0={0} a1={90} label="90°" />
    </Svg>
  ),
  "elbow-angle": () => (
    <Svg label="Elbow pipe to pipe, angle: pipe dia D, legs L1 and L2 on the centre-line, angle A between the legs">
      <BentPipe pts={[[72, 186], [72, 96], [176, 58]]} w={18} />
      <DimV y1={96} y2={186} x={30} label="L1" from={[72, 54]} />
      <Label x={130} y={62}>L2</Label>
      <Angle cx={72} cy={96} r={34} a0={-20} a1={90} label="A" />
      <Label x={196} y={96}>D</Label>
    </Svg>
  ),
  "elbow-double": () => (
    <Svg label="Double elbow (centre-line): pipe dia D, bottom straight B, rise H between the bends, top straight T, offset E between the pipe centre-lines">
      <BentPipe pts={[[64, 190], [64, 140], [150, 66], [150, 16]]} w={16} />
      <DimV y1={140} y2={190} x={30} label="B" from={[64, 40]} />
      <DimV y1={66} y2={140} x={30} label="H" from={[150, 40]} />
      <DimV y1={16} y2={66} x={190} label="T" from={[150, 168]} />
      <DimH x1={64} x2={150} y={196} label="" from={[190, 70]} />
      <Label x={107} y={188}>E</Label>
    </Svg>
  ),
  "seg-bend-90": () => (
    <Svg label="Segmented bend 90°: pipe dia D, bend radius R on the centre-line, number of segments n (two half segments at the ends)">
      <BentPipe pts={segPoints([44, 176], 128, 90, 5)} w={18} />
      <Dashed d="M44,176 L134.5,85.5 M44,176 L172,176 M44,176 L44,48" />
      <Label x={96} y={124}>R</Label>
      <DimH x1={154} x2={190} y={194} label="D" from={[176, 176]} />
      <Label x={190} y={30} a="end">n segments</Label>
    </Svg>
  ),
  "seg-bend-angle": () => (
    <Svg label="Segmented bend, angle: pipe dia D, bend radius R on the centre-line, bend angle θ, number of segments n">
      <BentPipe pts={segPoints([40, 176], 140, 60, 6)} w={18} />
      <Dashed d="M40,176 L180,176 M40,176 L110,54.8" />
      <Angle cx={40} cy={176} r={44} a0={-60} a1={0} label="θ" />
      <Label x={118} y={142}>R</Label>
      <DimH x1={162} x2={198} y={194} label="D" from={[176, 176]} />
      <Label x={200} y={30} a="end">n segments</Label>
    </Svg>
  ),
};

const CutLength = () => <Label x={CX} y={196}>× cut length L</Label>;

function PipeSection({ label, od, t }: { label: string; od: string; t: string }) {
  return (
    <Svg label={label}>
      <circle cx={CX} cy={95} r={60} fill="#1d4ed810" stroke={BLUE} strokeWidth={1.6} />
      <circle cx={CX} cy={95} r={48} fill="white" stroke={BLUE} strokeWidth={1.6} />
      <Axis x={CX} y1={28} y2={162} />
      <DimH x1={CX - 60} x2={CX + 60} y={176} label={od} from={[95, 95]} />
      <line x1={CX + 72} y1={40} x2={CX + 52} y2={58} stroke={INK} strokeWidth={0.9} markerEnd="url(#da)" />
      <Label x={CX + 74} y={38} a="start">{t}</Label>
      <CutLength />
    </Svg>
  );
}

function AngleSection({ label, equal }: { label: string; equal?: boolean }) {
  return (
    <Svg label={label}>
      <path d="M60,30 L74,30 L74,146 L170,146 L170,160 L60,160 Z" fill="#1d4ed810" stroke={BLUE} strokeWidth={1.6} />
      <DimH x1={60} x2={170} y={180} label={equal ? "W" : "A"} from={[160, 160]} />
      <DimV y1={30} y2={160} x={40} label={equal ? "W" : "B"} from={[60, 60]} />
      <Label x={86} y={44} a="start">t</Label>
    </Svg>
  );
}

function ChannelSection({ label }: { label: string }) {
  return (
    <Svg label={label}>
      <path d="M150,30 L80,30 L80,160 L150,160 L150,148 L94,148 L94,42 L150,42 Z" fill="#1d4ed810" stroke={BLUE} strokeWidth={1.6} />
      <DimV y1={30} y2={160} x={56} label="D" from={[80, 80]} />
      <DimH x1={80} x2={150} y={180} label="B" from={[160, 160]} />
    </Svg>
  );
}

function BeamSection({ label, wide, thicknesses }: { label: string; wide?: boolean; thicknesses?: boolean }) {
  const b = wide ? 62 : 44;
  return (
    <Svg label={label}>
      <path
        d={`M${CX - b},30 L${CX + b},30 L${CX + b},42 L${CX + 5},42 L${CX + 5},148 L${CX + b},148 L${CX + b},160 L${CX - b},160 L${CX - b},148 L${CX - 5},148 L${CX - 5},42 L${CX - b},42 Z`}
        fill="#1d4ed810"
        stroke={BLUE}
        strokeWidth={1.6}
      />
      <DimV y1={30} y2={160} x={CX - b - 22} label="D" from={[CX - b, CX - b]} />
      <DimH x1={CX - b} x2={CX + b} y={180} label="B" from={[160, 160]} />
      {thicknesses && (
        <>
          <Label x={CX + 10} y={100} a="start">tw</Label>
          <Label x={CX + b + 6} y={40} a="start">tf</Label>
        </>
      )}
    </Svg>
  );
}

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
Object.assign(DIAGRAMS, ELBOW_DIAGRAMS);

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
  "transition-rect-round": () => <RectToRoundTile />,
};

/** Square base, round top: two visible flat faces with a cone between them. */
function RectToRoundTile() {
  return (
    <svg viewBox="0 0 80 80" className="size-14 shrink-0" aria-hidden="true">
      {GRAD}
      <path d="M10,62 L46,70 L52,22 Q40,26 30,20 Z" fill="url(#metal)" stroke="#374151" strokeWidth={0.6} />
      <path d="M46,70 L72,58 L54,20 Q53,21 52,22 Z" fill="#6b7280" stroke="#374151" strokeWidth={0.6} />
      <ellipse cx={42} cy={20} rx={12} ry={4} fill="#374151" stroke="#1f2937" strokeWidth={0.6} />
    </svg>
  );
}

/** Picker tile picture: a 3D solid where we have one, else the elevation drawing. */
export function TypeTile({ typeId }: { typeId: string }) {
  const t = TILES[typeId];
  if (t) return <>{t()}</>;
  const d = DIAGRAMS[typeId];
  if (d) return <div className="w-16 shrink-0">{d()}</div>;
  return <div className="size-14 shrink-0 rounded-md bg-paper" aria-hidden="true" />;
}
