import type { ChargeOutput, MaterialTotals } from "@/lib/calc/costing";
import { inr, kg } from "@/lib/format";
import { Stat } from "./ui";

/** Per-material weights and money: the workbook's cost block. */
export function MaterialTable({ rows }: { rows: MaterialTotals[] }) {
  if (!rows.length) return <p className="px-4 py-3 text-sm text-muted">No weighed items yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-sm tabular-nums">
        <thead>
          <tr className="text-right text-muted">
            <th className="px-4 py-2 text-left font-medium">Material</th>
            <th className="px-2 py-2 font-medium">Process kg</th>
            <th className="px-2 py-2 font-medium">Burning kg</th>
            <th className="px-2 py-2 font-medium">Finish kg</th>
            <th className="px-2 py-2 font-medium">Scrap kg</th>
            <th className="px-4 py-2 font-medium">Net ₹</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.material} className="border-t border-line text-right">
              <td className="px-4 py-2 text-left font-medium">{t.material}</td>
              <td className="px-2 py-2">{kg(t.process)}</td>
              <td className="px-2 py-2">{kg(t.burning)}</td>
              <td className="px-2 py-2">{kg(t.finish)}</td>
              <td className="px-2 py-2">{kg(t.scrap)}</td>
              <td className="px-4 py-2" title={`${inr(t.amount)} material − ${inr(t.scrapCredit)} scrap credit`}>{inr(t.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ChargeList({ charges }: { charges: ChargeOutput[] }) {
  return (
    <>
      {charges.map((c) => (
        <Stat
          key={c.line.id}
          label={
            <>
              {c.line.name}{" "}
              <span className="text-xs">
                ({kg(c.weight)} kg {c.line.basis} × {c.line.rate === null ? "—" : `₹${c.line.rate}`})
              </span>
            </>
          }
          value={c.line.rate === null ? <span className="text-muted">rate not set</span> : inr(c.amount)}
        />
      ))}
    </>
  );
}
