import type { DevDim, DevPiece, Development, Pt } from "@/lib/calc/types";
import { num } from "@/lib/format";

// Flat-pattern drawing in the Plate'n'Sheets style: blue outline, green marking
// lines, dashed frame (the ideal sheet rectangle) with its W × H, and the
// pattern's own dimensions (R1, R2, θ, chord…). One renderer for every shape.

const BOX = 300; // drawing area, px
const M = 34; // margin for frame dimensions
const COLORS = { outline: "#1d4ed8", mark: "#16a34a", frame: "#c026d3", dim: "#18181b" };

/** Rounded coordinate: Math.sin/cos may differ in the last digits between server and browser. */
const r2 = (n: number) => Math.round(n * 100) / 100;

function Piece({ piece }: { piece: DevPiece }) {
  const xs = piece.outline.map((p) => p[0]);
  const ys = piece.outline.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const s = BOX / Math.max(w, h);
  const W = w * s + 2 * M;
  const H = h * s + 2 * M;
  // math (y up) → screen (y down)
  const P = ([x, y]: Pt): Pt => [r2(M + (x - minX) * s), r2(M + (maxY - y) * s)];
  const path = (pts: Pt[], close = true) =>
    pts.map((p, i) => `${i ? "L" : "M"}${P(p).join(",")}`).join(" ") + (close ? " Z" : "");

  const fx0 = M, fx1 = M + w * s, fy0 = M, fy1 = M + h * s;

  return (
    <figure className="text-ink">
      <svg viewBox={`0 0 ${r2(W)} ${r2(H)}`} className="h-auto w-full" role="img" aria-label={`${piece.name} flat pattern ${num(w)} by ${num(h)} mm`}>
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,1 L9,5 L0,9 z" fill="currentColor" />
          </marker>
        </defs>
        {/* frame + its dimensions */}
        <rect x={fx0} y={fy0} width={r2(fx1 - fx0)} height={r2(fy1 - fy0)} fill="none" stroke={COLORS.frame} strokeWidth={1} strokeDasharray="5 4" />
        <g stroke={COLORS.frame} fill={COLORS.frame}>
          <line x1={fx0} y1={fy0 - 14} x2={fx1} y2={fy0 - 14} markerStart="url(#arr)" markerEnd="url(#arr)" style={{ color: COLORS.frame }} />
          <text x={(fx0 + fx1) / 2} y={fy0 - 19} textAnchor="middle" fontSize={12} stroke="none" className="tabular-nums">{num(w)}</text>
          <line x1={fx0 - 14} y1={fy0} x2={fx0 - 14} y2={fy1} markerStart="url(#arr)" markerEnd="url(#arr)" style={{ color: COLORS.frame }} />
          <text x={fx0 - 19} y={(fy0 + fy1) / 2} textAnchor="middle" fontSize={12} stroke="none" transform={`rotate(-90 ${fx0 - 19} ${(fy0 + fy1) / 2})`} className="tabular-nums">{num(h)}</text>
        </g>
        {/* marking lines */}
        {piece.marks?.map(([a, b], i) => {
          const [x1, y1] = P(a);
          const [x2, y2] = P(b);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={COLORS.mark} strokeWidth={0.8} />;
        })}
        {/* outline and holes */}
        <path d={[path(piece.outline), ...(piece.holes ?? []).map((hp) => path(hp))].join(" ")} fill="#1d4ed80d" fillRule="evenodd" stroke={COLORS.outline} strokeWidth={1.6} />
        {piece.dims?.map((d, i) => <Dim key={i} d={d} P={P} />)}
      </svg>
      <figcaption className="mt-1 text-center text-xs text-muted">
        {piece.name}
        {piece.count > 1 && ` × ${piece.count}`} · frame {num(w)} × {num(h)} mm
      </figcaption>
    </figure>
  );
}

function Dim({ d, P }: { d: DevDim; P: (p: Pt) => Pt }) {
  const color = COLORS.dim;
  const label = (x: number, y: number, text: string, anchor: "start" | "middle" | "end" = "middle") => (
    <text x={r2(x)} y={r2(y)} textAnchor={anchor} fontSize={11} fill={color} paintOrder="stroke" stroke="white" strokeWidth={3} className="tabular-nums">
      {text}
    </text>
  );
  if (d.kind === "text") {
    const [x, y] = P(d.at);
    return label(x, y + 4, d.label);
  }
  if (d.kind === "radius") {
    const [x1, y1] = P(d.center);
    const [x2, y2] = P(d.to);
    return (
      <g style={{ color }}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={0.9} markerEnd="url(#arr)" />
        {label((x1 + x2) / 2 + 4, (y1 + y2) / 2 - 4, d.label, "start")}
      </g>
    );
  }
  if (d.kind === "linear") {
    const [ax, ay] = d.from;
    const [bx, by] = d.to;
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const nx = (-(by - ay) / len) * (d.offset ?? 0);
    const ny = ((bx - ax) / len) * (d.offset ?? 0);
    const [x1, y1] = P([ax + nx, ay + ny]);
    const [x2, y2] = P([bx + nx, by + ny]);
    return (
      <g style={{ color }}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={0.9} strokeDasharray={d.offset ? undefined : "3 3"} markerStart="url(#arr)" markerEnd="url(#arr)" />
        {label((x1 + x2) / 2, (y1 + y2) / 2 - 5, d.label)}
      </g>
    );
  }
  // angle: counter-clockwise (in math coordinates) from `from` to `to` around `center`
  const a0 = Math.atan2(d.from[1] - d.center[1], d.from[0] - d.center[0]);
  let a1 = Math.atan2(d.to[1] - d.center[1], d.to[0] - d.center[0]);
  while (a1 <= a0) a1 += 2 * Math.PI;
  const pts: Pt[] = [];
  for (let i = 0; i <= 48; i++) {
    const a = a0 + ((a1 - a0) * i) / 48;
    pts.push(P([d.center[0] + d.r * Math.cos(a), d.center[1] + d.r * Math.sin(a)]));
  }
  const mid = (a0 + a1) / 2;
  const [lx, ly] = P([d.center[0] + d.r * 1.25 * Math.cos(mid), d.center[1] + d.r * 1.25 * Math.sin(mid)]);
  return (
    <g style={{ color }}>
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={color} strokeWidth={0.9} markerStart="url(#arr)" markerEnd="url(#arr)" />
      {label(lx, ly + 4, d.label)}
    </g>
  );
}

/** All pieces of a development, one under the other so labels stay readable. */
export function DevelopmentSketch({ dev }: { dev: Development }) {
  return (
    <div className="space-y-5">
      {dev.pieces.map((p, i) => (
        <Piece key={`${p.name}-${i}`} piece={p} />
      ))}
    </div>
  );
}
