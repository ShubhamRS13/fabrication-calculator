"use client";

import { useState, useTransition } from "react";
import { setSizeRateAction } from "@/app/actions";
import type { SizeRateUnit } from "@/lib/calc/costing";
import { inr, kg, num, parseNum } from "@/lib/format";
import { ErrorText, Input, Select } from "./ui";

export interface RateChartRow {
  key: string;
  label: string;
  material: string;
  kg: number;
  m: number;
  pieces: number;
  amount: number;
  drawings: string[];
  rate: number | null;
  unit: SizeRateUnit;
}

const UNITS: { value: SizeRateUnit; label: string }[] = [
  { value: "kg", label: "₹/kg" },
  { value: "m", label: "₹/m" },
  { value: "piece", label: "₹/piece" },
];

export function RateChartEditor({ costingId, rows, materialRates }: { costingId: string; rows: RateChartRow[]; materialRates: Record<string, number | null> }) {
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => (
        <RateRow key={r.key} costingId={costingId} row={r} fallback={materialRates[r.material] ?? null} />
      ))}
    </ul>
  );
}

function RateRow({ costingId, row, fallback }: { costingId: string; row: RateChartRow; fallback: number | null }) {
  const [rate, setRate] = useState(row.rate?.toString() ?? "");
  const [unit, setUnit] = useState<SizeRateUnit>(row.unit);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function save(nextUnit: SizeRateUnit = unit, nextRate = rate) {
    const r = parseNum(nextRate);
    if (Number.isNaN(r)) return setError("Rate must be a number");
    if (r === row.rate && nextUnit === row.unit) return;
    setError(undefined);
    start(async () => {
      const res = await setSizeRateAction(costingId, { key: row.key, label: row.label, rate: r, unit: nextUnit });
      if (!res.ok) setError(res.error);
    });
  }

  const usingFallback = row.rate === null;
  return (
    <li className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_9rem_8rem_7rem] sm:items-center">
      <div className="min-w-0">
        <p className="font-medium">
          <span className="mr-1.5 rounded bg-paper px-1.5 py-0.5 text-xs font-semibold">{row.material}</span>
          {row.label}
        </p>
        <p className="text-xs text-muted tabular-nums">
          {kg(row.kg)} kg · {num(row.m)} m · {num(row.pieces)} pcs · {row.drawings.join(", ")}
        </p>
      </div>
      <Input
        value={rate}
        onChange={(e) => setRate(e.target.value)}
        onBlur={() => save()}
        inputMode="decimal"
        placeholder={fallback !== null ? `material ₹${num(fallback)}/kg` : "rate"}
        aria-label={`Rate for ${row.material} ${row.label}`}
      />
      <Select
        value={unit}
        onChange={(e) => {
          const u = e.target.value as SizeRateUnit;
          setUnit(u);
          save(u);
        }}
        aria-label={`Unit for ${row.label}`}
      >
        {UNITS.map((u) => (
          <option key={u.value} value={u.value}>{u.label}</option>
        ))}
      </Select>
      <div className="text-right text-sm tabular-nums">
        <p className="font-medium">{inr(row.amount)}</p>
        <p className="text-xs text-muted">{pending ? "saving…" : usingFallback ? "material rate" : "size rate"}</p>
      </div>
      {error && <div className="sm:col-span-4"><ErrorText>{error}</ErrorText></div>}
    </li>
  );
}
