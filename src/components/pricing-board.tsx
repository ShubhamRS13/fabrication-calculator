"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import {
  addChargeLineAction, deleteChargeLineAction, fillBlankRatesAction, setMaterialRateAction, setPriceAction,
  updateChargeLineAction, updateCostingAction,
} from "@/app/actions";
import type { PriceRow } from "@/lib/calc/costing";
import type { PriceGroup, PriceUnit } from "@/lib/calc/types";
import { inr, kg, num, parseNum } from "@/lib/format";
import { Button, Card, cx, ErrorText, Input, Select } from "./ui";

// The costing's one place for every rate: materials, plate thickness, sections,
// bought-outs, job work, charge lines and profit. Blank = missing (red); 0 = free.

type Hint = { rate: number; unit?: string; project: string };

export interface MaterialRow {
  material: string;
  rate: number | null;
  scrapRate: number | null;
  /** Some item is priced by this material's ₹/kg rate. */
  used: boolean;
  kg: number;
}

export interface ChargeRow {
  id: string;
  name: string;
  rate: number | null;
  basis: "process" | "finish";
  appliesTo: string;
  weight: number;
  amount: number;
}

export interface PricingData {
  costingId: string;
  materials: MaterialRow[];
  materialCodes: string[];
  scrapCredit: number;
  prices: PriceRow[];
  units: Record<PriceGroup, PriceUnit[]>;
  charges: ChargeRow[];
  profitPct: number;
  totals: { material: number; charges: number; bought: number; subtotal: number; profit: number; grand: number };
  missing: { kind: string; label: string }[];
  hints: { prices: Record<string, Hint>; materials: Record<string, Hint>; charges: Record<string, Hint> };
  otherCostings: { id: string; label: string }[];
}

const UNIT_LABEL: Record<PriceUnit, string> = { kg: "₹/kg", m: "₹/m", piece: "₹/piece", set: "₹/set" };
const GROUPS: { group: PriceGroup; title: string; sub: string }[] = [
  { group: "plate", title: "Plate & sheet by thickness", sub: "Blank uses the material ₹/kg rate above" },
  { group: "size", title: "Sections, pipes & flats", sub: "Priced by size; blank uses the material ₹/kg rate" },
  { group: "bought", title: "Bought-outs", sub: "Same item on any drawing = one rate" },
  { group: "jobwork", title: "Job work", sub: "Third-party work, e.g. dish forming. Enter 0 if done in-house" },
];

export function PricingBoard({ data }: { data: PricingData }) {
  const [onlyMissing, setOnlyMissing] = useState(false);
  const missingCount = data.missing.length;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Grand total</p>
            <p className="text-2xl font-semibold tabular-nums">{inr(data.totals.grand)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {missingCount > 0 ? (
              <span className="rounded-full bg-danger/10 px-3 py-1 text-sm font-medium text-danger">
                {missingCount} rate{missingCount === 1 ? "" : "s"} missing
              </span>
            ) : (
              <span className="rounded-full bg-ok/10 px-3 py-1 text-sm font-medium text-ok">All rates entered</span>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} className="size-4 accent-ink" />
              Show only missing
            </label>
          </div>
        </div>
        {missingCount > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5 text-xs">
            {data.missing.map((m) => (
              <li key={m.kind + m.label} className="rounded border border-danger/30 px-2 py-0.5 text-danger">{m.label}</li>
            ))}
          </ul>
        )}
        <FillFrom costingId={data.costingId} others={data.otherCostings} />
      </Card>

      <Section title="Materials & scrap" sub="₹/kg. Used for every weighed item without its own rate below; scrap is credited back">
        <ul className="divide-y divide-line">
          {data.materials
            .filter((m) => !onlyMissing || (m.used && m.rate === null))
            .map((m) => (
              <MaterialRateRow key={`${m.material}:${m.rate}:${m.scrapRate}`} costingId={data.costingId} row={m} hint={data.hints.materials[m.material]} />
            ))}
        </ul>
        {data.scrapCredit > 0 && <p className="border-t border-line px-4 py-2 text-right text-sm tabular-nums text-muted">Scrap credit − {inr(data.scrapCredit)}</p>}
      </Section>

      {GROUPS.map(({ group, title, sub }) => {
        const rows = data.prices.filter((r) => r.group === group);
        if (!rows.length) return null;
        const shown = rows.filter((r) => !onlyMissing || r.missing);
        return (
          <Section key={group} title={title} sub={sub} total={rows.reduce((a, r) => a + r.amount, 0)}>
            {shown.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted">Nothing missing here.</p>
            ) : (
              <ul className="divide-y divide-line">
                {shown.map((r) => (
                  <PriceRowEditor
                    key={`${r.key}:${r.rate}:${r.unit}`}
                    costingId={data.costingId}
                    row={r}
                    units={data.units[group]}
                    fallback={group === "plate" || group === "size" ? data.materials.find((m) => m.material === r.material)?.rate ?? null : null}
                    hint={data.hints.prices[r.key]}
                  />
                ))}
              </ul>
            )}
          </Section>
        );
      })}

      <Section title="Charge lines" sub="₹/kg on process or finish weight, per material group. Enter 0 or remove a line that isn't charged" total={data.totals.charges}>
        <ChargeLines costingId={data.costingId} lines={data.charges} materials={data.materialCodes} onlyMissing={onlyMissing} hints={data.hints.charges} />
      </Section>

      <Section title="Profit">
        <ProfitRow costingId={data.costingId} pct={data.profitPct} amount={data.totals.profit} />
      </Section>

      <Card className="p-4 text-sm tabular-nums">
        <Line label="Material & sections (net of scrap)" value={inr(data.totals.material)} />
        <Line label="Charge lines" value={inr(data.totals.charges)} />
        <Line label="Bought-outs & job work" value={inr(data.totals.bought)} />
        <Line label="Subtotal" value={inr(data.totals.subtotal)} />
        <Line label={`Profit ${num(data.profitPct)}%`} value={inr(data.totals.profit)} />
        <div className="mt-1 border-t border-line pt-1">
          <Line label="Grand total" value={inr(data.totals.grand)} strong />
        </div>
        <p className="mt-1 text-xs text-muted">GST and transport not included.</p>
      </Card>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cx("flex justify-between py-1", strong && "text-base font-semibold")}>
      <span className={strong ? "" : "text-muted"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Section({ title, sub, total, children }: { title: string; sub?: string; total?: number; children: ReactNode }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
        </div>
        {total !== undefined && <span className="shrink-0 pt-0.5 font-semibold tabular-nums">{inr(total)}</span>}
      </div>
      {children}
    </Card>
  );
}

const hintText = (h: Hint | undefined, unitLabel?: string) => (h ? `Last ₹${num(h.rate)}${unitLabel ?? (h.unit ? `/${h.unit}` : "")} in ${h.project}` : undefined);

function useSaver() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(undefined);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
    });
  };
  return { pending, error, setError, run };
}

function MaterialRateRow({ costingId, row, hint }: { costingId: string; row: MaterialRow; hint?: Hint }) {
  const [rate, setRate] = useState(row.rate?.toString() ?? "");
  const [scrap, setScrap] = useState(row.scrapRate?.toString() ?? "");
  const { pending, error, setError, run } = useSaver();
  function save() {
    const r = parseNum(rate);
    const s = parseNum(scrap);
    if (Number.isNaN(r) || Number.isNaN(s)) return setError("Numbers only");
    if (r === row.rate && s === row.scrapRate) return;
    run(() => setMaterialRateAction(costingId, { material: row.material, rate: r, scrapRate: s }));
  }
  const missing = row.used && row.rate === null;
  return (
    <li className={cx("grid grid-cols-2 items-center gap-2 px-4 py-3 sm:grid-cols-[1fr_9rem_9rem]", missing && "bg-danger/5")}>
      <div className="col-span-2 min-w-0 sm:col-span-1">
        <p className="font-medium">
          {row.material}
          {missing && <MissingTag />}
        </p>
        <p className="text-xs text-muted">{row.used ? `${kg(row.kg)} kg priced at this rate` : "not used in this costing"}{pending && " · saving…"}</p>
        {error && <ErrorText>{error}</ErrorText>}
      </div>
      <label className="block">
        <span className="text-xs text-muted">Rate ₹/kg</span>
        <Input value={rate} onChange={(e) => setRate(e.target.value)} onBlur={save} inputMode="decimal" placeholder={hint ? `last ₹${num(hint.rate)}` : "—"} aria-label={`${row.material} rate`} />
      </label>
      <label className="block">
        <span className="text-xs text-muted">Scrap ₹/kg</span>
        <Input value={scrap} onChange={(e) => setScrap(e.target.value)} onBlur={save} inputMode="decimal" placeholder="—" aria-label={`${row.material} scrap rate`} />
      </label>
      {hint && row.rate === null && <p className="col-span-2 text-xs text-muted sm:col-span-3">{hintText(hint, "/kg")}</p>}
    </li>
  );
}

const MissingTag = () => <span className="ml-2 rounded bg-danger px-1.5 py-0.5 align-middle text-[10px] font-semibold text-white">MISSING</span>;

function PriceRowEditor({ costingId, row, units, fallback, hint }: { costingId: string; row: PriceRow; units: PriceUnit[]; fallback: number | null; hint?: Hint }) {
  const [rate, setRate] = useState(row.rate?.toString() ?? "");
  const [unit, setUnit] = useState<PriceUnit>(row.unit);
  const { pending, error, setError, run } = useSaver();

  function save(nextUnit: PriceUnit = unit, nextRate = rate) {
    const r = parseNum(nextRate);
    if (Number.isNaN(r)) return setError("Rate must be a number");
    if (r === row.rate && nextUnit === row.unit) return;
    run(() => setPriceAction(costingId, { key: row.key, group: row.group, material: row.material, label: row.label, rate: r, unit: nextUnit }));
  }

  const qty: string[] = [];
  if (row.kg > 0) qty.push(`${kg(row.kg)} kg`);
  if (row.m > 0) qty.push(`${num(row.m)} m`);
  qty.push(`${num(row.pieces)} pcs`);
  const r = parseNum(rate);
  // ₹/m ↔ ₹/kg, so a supplier's per-metre price can be compared with the material rate.
  const equiv =
    r !== null && !Number.isNaN(r) && row.kg > 0 && row.m > 0
      ? unit === "m"
        ? `≈ ₹${num((r * row.m) / row.kg)}/kg`
        : unit === "kg"
          ? `≈ ₹${num((r * row.kg) / row.m)}/m`
          : undefined
      : undefined;
  const placeholder = fallback !== null ? `material ₹${num(fallback)}/kg` : hint ? `last ₹${num(hint.rate)}` : "rate";

  return (
    <li className={cx("grid grid-cols-2 items-center gap-2 px-4 py-3 sm:grid-cols-[1fr_9rem_8rem_7.5rem]", row.missing && "bg-danger/5")}>
      <div className="col-span-2 min-w-0 sm:col-span-1">
        <p className="font-medium">
          <span className="mr-1.5 rounded bg-paper px-1.5 py-0.5 text-xs font-semibold">{row.material}</span>
          {row.label}
          {row.missing && <MissingTag />}
        </p>
        <p className="text-xs text-muted tabular-nums">
          {qty.join(" · ")} · {row.drawings.join(", ")}
        </p>
        {(hint || equiv) && (
          <p className="text-xs text-muted">
            {equiv}
            {equiv && hint && " · "}
            {hint && hintText(hint)}
          </p>
        )}
        {error && <ErrorText>{error}</ErrorText>}
      </div>
      <Input value={rate} onChange={(e) => setRate(e.target.value)} onBlur={() => save()} inputMode="decimal" placeholder={placeholder} aria-label={`Rate for ${row.material} ${row.label}`} />
      {units.length > 1 ? (
        <Select
          value={unit}
          onChange={(e) => {
            const u = e.target.value as PriceUnit;
            setUnit(u);
            save(u);
          }}
          aria-label={`Unit for ${row.label}`}
        >
          {units.map((u) => (
            <option key={u} value={u}>{UNIT_LABEL[u]}</option>
          ))}
        </Select>
      ) : (
        <span className="text-sm text-muted">{UNIT_LABEL[units[0]]}</span>
      )}
      <div className="col-span-2 flex items-baseline justify-between text-sm tabular-nums sm:col-span-1 sm:block sm:text-right">
        <p className="order-2 font-medium sm:order-none">{inr(row.amount)}</p>
        <p className="order-1 text-xs text-muted sm:order-none">{pending ? "saving…" : row.rate !== null ? "rate entered" : fallback !== null ? "material rate" : "no rate"}</p>
      </div>
    </li>
  );
}

function ChargeLines({ costingId, lines, materials, onlyMissing, hints }: { costingId: string; lines: ChargeRow[]; materials: string[]; onlyMissing: boolean; hints: Record<string, Hint> }) {
  const { pending, error, run } = useSaver();
  const options = [
    { value: "ALL", label: "All materials" },
    { value: "SS", label: "SS only" },
    { value: "MS", label: "MS only" },
    ...materials.map((m) => ({ value: `MAT:${m}`, label: `${m} only` })),
  ];
  return (
    <div>
      <ul className="divide-y divide-line">
        {lines
          .filter((l) => !onlyMissing || (l.rate === null && l.weight > 0))
          .map((l) => (
            <ChargeLineRow key={`${l.id}:${l.rate}`} costingId={costingId} line={l} options={options} hint={hints[l.name.trim().toLowerCase()]} />
          ))}
      </ul>
      <div className="flex items-center gap-3 border-t border-line px-4 py-3">
        <Button onClick={() => run(() => addChargeLineAction(costingId, { name: "New charge", rate: null, basis: "finish", appliesTo: "ALL" }))} disabled={pending}>
          + Add charge line
        </Button>
        <ErrorText>{error}</ErrorText>
      </div>
    </div>
  );
}

function ChargeLineRow({ costingId, line, options, hint }: { costingId: string; line: ChargeRow; options: { value: string; label: string }[]; hint?: Hint }) {
  const [name, setName] = useState(line.name);
  const [rate, setRate] = useState(line.rate?.toString() ?? "");
  const { pending, error, setError, run } = useSaver();
  const save = (patch: Partial<Pick<ChargeRow, "name" | "rate" | "basis" | "appliesTo">>) => run(() => updateChargeLineAction(costingId, line.id, patch));
  const missing = line.rate === null && line.weight > 0;
  return (
    <li className={cx("grid grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-[1fr_7rem_8rem_9rem_auto] sm:items-center", missing && "bg-danger/5")}>
      <div className="col-span-2 sm:col-span-1">
        <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== line.name && save({ name: name.trim() })} aria-label="Charge name" />
        <p className="mt-1 text-xs text-muted tabular-nums">
          {kg(line.weight)} kg {line.basis} · {inr(line.amount)}
          {missing && <MissingTag />}
          {hint && line.rate === null && ` · ${hintText(hint, "/kg")}`}
          {pending && " · saving…"}
        </p>
      </div>
      <Input
        value={rate}
        onChange={(e) => setRate(e.target.value)}
        onBlur={() => {
          const r = parseNum(rate);
          if (Number.isNaN(r)) return setError("Rate must be a number");
          if (r !== line.rate) save({ rate: r });
        }}
        inputMode="decimal"
        placeholder={hint ? `last ₹${num(hint.rate)}` : "₹/kg"}
        aria-label={`${line.name} rate ₹/kg`}
      />
      <Select defaultValue={line.basis} onChange={(e) => save({ basis: e.target.value as ChargeRow["basis"] })} aria-label="Weight basis">
        <option value="finish">Finish wt</option>
        <option value="process">Process wt</option>
      </Select>
      <Select defaultValue={line.appliesTo} onChange={(e) => save({ appliesTo: e.target.value })} aria-label="Applies to">
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
      <Button
        variant="ghost"
        className="text-danger"
        disabled={pending}
        onClick={() => confirm(`Remove charge line “${line.name}”?`) && run(() => deleteChargeLineAction(costingId, line.id))}
      >
        Remove
      </Button>
      {error && <div className="col-span-2 sm:col-span-5"><ErrorText>{error}</ErrorText></div>}
    </li>
  );
}

function ProfitRow({ costingId, pct, amount }: { costingId: string; pct: number; amount: number }) {
  const [value, setValue] = useState(String(pct));
  const { pending, error, setError, run } = useSaver();
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <label className="flex items-center gap-2 text-sm">
        Profit %
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            const n = parseNum(value);
            if (n === null || Number.isNaN(n) || n < 0) return setError("Enter a percentage, 0 or more");
            if (n !== pct) run(() => updateCostingAction(costingId, { profitPct: n }));
          }}
          inputMode="decimal"
          className="w-24"
          aria-label="Profit percent"
        />
      </label>
      <span className="text-sm tabular-nums text-muted">= {inr(amount)}{pending && " · saving…"}</span>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

function FillFrom({ costingId, others }: { costingId: string; others: { id: string; label: string }[] }) {
  const router = useRouter();
  const [source, setSource] = useState("");
  const [msg, setMsg] = useState<string>();
  const [pending, start] = useTransition();
  if (!others.length) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
      <span className="text-sm">Fill blank rates from</span>
      <Select value={source} onChange={(e) => setSource(e.target.value)} className="w-auto min-w-48 flex-1 sm:flex-none" aria-label="Costing to fill rates from">
        <option value="">Choose a costing…</option>
        {others.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </Select>
      <Button
        disabled={!source || pending}
        onClick={() =>
          start(async () => {
            const res = await fillBlankRatesAction(costingId, source);
            setMsg(res.ok ? (res.data ? `Filled ${res.data} rate${res.data === 1 ? "" : "s"}.` : "Nothing to fill — no matching rates.") : res.error);
            router.refresh();
          })
        }
      >
        {pending ? "Filling…" : "Fill"}
      </Button>
      {msg && <span className="text-sm text-muted">{msg}</span>}
      <p className="w-full text-xs text-muted">Only blank rates are filled; rates you have entered are never changed.</p>
    </div>
  );
}
