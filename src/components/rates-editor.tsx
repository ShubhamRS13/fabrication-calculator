"use client";

import { useState, useTransition } from "react";
import { setMaterialRateAction } from "@/app/actions";
import { parseNum } from "@/lib/format";
import { ErrorText, Input } from "./ui";

interface Row {
  material: string;
  rate: number | null;
  scrapRate: number | null;
}

/** Material and scrap rates (₹/kg). Each row saves when a field loses focus. */
export function RatesEditor({ costingId, rows }: { costingId: string; rows: Row[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted">
            <th className="px-4 py-2 font-medium">Material</th>
            <th className="px-2 py-2 font-medium">Rate ₹/kg</th>
            <th className="px-2 py-2 pr-4 font-medium">Scrap ₹/kg</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <RateRow key={r.material} costingId={costingId} row={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RateRow({ costingId, row }: { costingId: string; row: Row }) {
  const [rate, setRate] = useState(row.rate?.toString() ?? "");
  const [scrap, setScrap] = useState(row.scrapRate?.toString() ?? "");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function save() {
    const r = parseNum(rate);
    const s = parseNum(scrap);
    if (Number.isNaN(r) || Number.isNaN(s)) return setError("Enter numbers only");
    if (r === row.rate && s === row.scrapRate) return;
    setError(undefined);
    start(async () => {
      const res = await setMaterialRateAction(costingId, { material: row.material, rate: r, scrapRate: s });
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <tr className="border-t border-line">
      <td className="px-4 py-2 font-medium">
        {row.material}
        {pending && <span className="ml-2 text-xs text-muted">saving…</span>}
        <ErrorText>{error}</ErrorText>
      </td>
      <td className="px-2 py-2">
        <Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} onBlur={save} placeholder="—" aria-label={`${row.material} rate`} className="w-28" />
      </td>
      <td className="px-2 py-2 pr-4">
        <Input inputMode="decimal" value={scrap} onChange={(e) => setScrap(e.target.value)} onBlur={save} placeholder="—" aria-label={`${row.material} scrap rate`} className="w-28" />
      </td>
    </tr>
  );
}
