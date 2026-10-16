import type { ReactNode } from "react";
import type { ItemResult, Panel } from "@/lib/calc/types";
import { num } from "@/lib/format";

// Development sketches drawn from the computed dimensions. Not to scale between
// items, but each sketch keeps its own proportions. Labels are in mm.

const W = 320;
const H = 220;
const PAD = 28;

function fit(width: number, height: number) {
  const s = Math.min((W - 2 * PAD) / width, (H - 2 * PAD) / height);
  return { s, ox: (W - width * s) / 2, oy: (H - height * s) / 2 };
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.5 } as const;
const sheet = { fill: "none", stroke: "#a1a1aa", strokeWidth: 1, strokeDasharray: "4 3" } as const;

function T({ x, y, children, anchor = "middle" }: { x: number; y: number; children: string; anchor?: "start" | "middle" | "end" }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={11} fill="currentColor" className="tabular-nums">
      {children}
    </text>
  );
}

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <figure className="text-ink">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-md" role="img" aria-label={title}>
        {children}
      </svg>
      <figcaption className="sr-only">{title}</figcaption>
    </figure>
  );
}

function RectSketch({ L, Wd, labelL, labelW, inner }: { L: number; Wd: number; labelL: string; labelW: string; inner?: { l: number; w: number } }) {
  const { s, ox, oy } = fit(L, Wd);
  return (
    <Frame title={`Rectangle ${labelL} by ${labelW}`}>
      <rect x={ox} y={oy} width={L * s} height={Wd * s} {...stroke} />
      {inner && inner.l > 0 && inner.w > 0 && (
        <rect x={ox + ((L - inner.l) / 2) * s} y={oy + ((Wd - inner.w) / 2) * s} width={inner.l * s} height={inner.w * s} {...stroke} />
      )}
      <T x={W / 2} y={oy - 8}>{labelL}</T>
      <T x={ox - 6} y={H / 2} anchor="end">{labelW}</T>
    </Frame>
  );
}

function RoundSketch({ od, id }: { od: number; id?: number }) {
  const { s, ox, oy } = fit(od, od);
  const cx = ox + (od * s) / 2;
  const cy = oy + (od * s) / 2;
  return (
    <Frame title={`Circle OD ${num(od)}`}>
      <rect x={ox} y={oy} width={od * s} height={od * s} {...sheet} />
      <circle cx={cx} cy={cy} r={(od * s) / 2} {...stroke} />
      {id ? <circle cx={cx} cy={cy} r={(id * s) / 2} {...stroke} /> : null}
      <T x={cx} y={oy - 8}>{`Ø${num(od)}${id ? ` / Ø${num(id)}` : ""}`}</T>
      <T x={ox + od * s + 4} y={cy} anchor="start">{`sheet ${num(od)}`}</T>
    </Frame>
  );
}

function FanSketch({ R1, R2, theta, chord }: { R1: number; R2: number; theta: number; chord: number }) {
  const half = (theta * Math.PI) / 360;
  const pts: [number, number][] = [];
  const steps = 64;
  for (let i = 0; i <= steps; i++) {
    const a = -half + (2 * half * i) / steps;
    pts.push([R1 * Math.sin(a), R1 * Math.cos(a)]);
  }
  for (let i = steps; i >= 0; i--) {
    const a = -half + (2 * half * i) / steps;
    pts.push([R2 * Math.sin(a), R2 * Math.cos(a)]);
  }
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxY = Math.max(...ys);
  const { s, ox, oy } = fit(Math.max(...xs) - minX, maxY - Math.min(...ys));
  // Rounded: Math.sin/cos may differ in the last digits between server and browser,
  // which would break hydration.
  const map = ([x, y]: [number, number]) => `${(ox + (x - minX) * s).toFixed(2)},${(oy + (maxY - y) * s).toFixed(2)}`;
  return (
    <Frame title={`Cone development R1 ${num(R1)}, R2 ${num(R2)}, angle ${num(theta)} degrees`}>
      <polygon points={pts.map(map).join(" ")} {...stroke} />
      <T x={W / 2} y={14}>{`R1 ${num(R1)} · R2 ${num(R2)}`}</T>
      <T x={W / 2} y={H - 6}>{`θ ${num(theta)}° · chord ${num(chord)}`}</T>
    </Frame>
  );
}

function PanelsSketch({ panels }: { panels: Panel[] }) {
  const n = panels.length;
  const cellW = W / n;
  const maxW = Math.max(...panels.map((p) => Math.max(p.top, p.bottom)));
  const maxH = Math.max(...panels.map((p) => p.height));
  const s = Math.min((cellW - 24) / maxW, (H - 70) / maxH);
  return (
    <Frame title="Panel developments">
      {panels.map((p, i) => {
        const cx = cellW * i + cellW / 2;
        const top = 30;
        const h = p.height * s;
        const pts = [
          [cx - (p.top * s) / 2, top],
          [cx + (p.top * s) / 2, top],
          [cx + (p.bottom * s) / 2, top + h],
          [cx - (p.bottom * s) / 2, top + h],
        ];
        return (
          <g key={p.name}>
            <polygon points={pts.map((q) => q.map((v) => v.toFixed(2)).join(",")).join(" ")} {...stroke} />
            <T x={cx} y={top - 6}>{num(p.top)}</T>
            <T x={cx} y={top + h + 14}>{p.shape === "trapezoid" ? num(p.bottom) : `h ${num(p.height)}`}</T>
            {p.shape === "trapezoid" && <T x={cx} y={top + h / 2 + 4}>{`h ${num(p.height)}`}</T>}
            <T x={cx} y={H - 6}>{`${p.name.replace(/ \(.*\)/, "")} × ${p.count}`}</T>
          </g>
        );
      })}
    </Frame>
  );
}

/** Returns null when the item type has no flat development worth drawing. */
export function DevelopmentSketch({ typeId, result, inputs }: { typeId: string; result: ItemResult; inputs: Record<string, unknown> }) {
  const d = result.development ?? {};
  const n = (k: string) => Number(inputs[k]) || 0;
  switch (typeId) {
    case "shell":
      return <RectSketch L={d.length} Wd={d.height} labelL={`π × Dm = ${num(d.length)}`} labelW={`H ${num(d.height)}`} />;
    case "cone":
      return <FanSketch R1={d.R1} R2={d.R2} theta={d.theta} chord={d.chord} />;
    case "ring-flange":
      return <RoundSketch od={n("od")} id={n("id")} />;
    case "disc":
      return <RoundSketch od={n("dia")} />;
    case "dished-end":
      return <RoundSketch od={d.blankDia} />;
    case "rect-flange":
      return <RectSketch L={n("length")} Wd={n("width")} labelL={num(n("length"))} labelW={num(n("width"))} inner={{ l: n("innerL"), w: n("innerW") }} />;
    case "plate":
    case "bent-plate":
      return result.sheetL && result.sheetW ? (
        <RectSketch L={result.sheetL} Wd={result.sheetW} labelL={num(result.sheetL)} labelW={num(result.sheetW)} />
      ) : null;
    case "pyramid-hopper":
    case "rect-duct":
      return result.panels?.length ? <PanelsSketch panels={result.panels} /> : null;
    default:
      return null;
  }
}
