import { Suspense } from "react";
import { Card, CardHeader, PageTitle, Skeleton, Stat } from "@/components/ui";
import type { DrawingOutput } from "@/lib/calc/costing";
import { familyOf } from "@/lib/calc/materials";
import { inr, kg } from "@/lib/format";
import { loadCosting } from "@/server/load";
import { MissingRatesBanner } from "@/components/missing-rates";

export const metadata = { title: "Costing summary" };

export default function SummaryPage(props: PageProps<"/costings/[id]/summary">) {
  return (
    <Suspense fallback={<Skeleton lines={5} />}>
      <Summary params={props.params} />
    </Suspense>
  );
}

function familySums(d: DrawingOutput) {
  const s = { ssProcess: 0, ssScrap: 0, msProcess: 0, msScrap: 0, finish: 0 };
  for (const t of d.byMaterial) {
    const fam = familyOf(t.material);
    if (fam === "SS") {
      s.ssProcess += t.process;
      s.ssScrap += t.scrap;
    } else if (fam === "MS") {
      s.msProcess += t.process;
      s.msScrap += t.scrap;
    }
    s.finish += t.finish;
  }
  return s;
}

async function Summary({ params }: { params: Promise<{ id: string }> }) {
  const { tree, result } = await loadCosting(params);
  const c = tree.costing;
  const rows = result.drawings.map((d) => ({ d, s: familySums(d) }));
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);

  const cols: { label: string; get: (r: (typeof rows)[number]) => number; money?: boolean }[] = [
    { label: "SS process kg", get: (r) => r.s.ssProcess },
    { label: "SS scrap kg", get: (r) => r.s.ssScrap },
    { label: "MS process kg", get: (r) => r.s.msProcess },
    { label: "MS scrap kg", get: (r) => r.s.msScrap },
    { label: "Finish kg", get: (r) => r.s.finish },
    { label: "Material ₹", get: (r) => r.d.materialTotal, money: true },
    { label: "Charges ₹", get: (r) => r.d.chargesTotal, money: true },
    { label: "Bought ₹", get: (r) => r.d.boughtTotal, money: true },
    { label: "Total ₹", get: (r) => r.d.total, money: true },
  ];

  return (
    <>
      <PageTitle
        back={{ href: `/costings/${c.id}`, label: c.projectName }}
        title="Costing summary"
        sub={`${c.clientName} · ${c.projectName}${c.poNo ? ` · PO ${c.poNo}` : ""}`}
        action={
          <div className="flex gap-2">
            <a
              href={`/costings/${c.id}/export/excel`}
              download
              className="inline-flex h-10 items-center rounded-lg border border-line bg-white px-3.5 text-sm font-medium hover:bg-paper"
            >
              Export Excel
            </a>
            <button disabled title="Coming in step 4.2" className="h-10 rounded-lg border border-line bg-white px-3.5 text-sm font-medium opacity-50">
              PDF
            </button>
          </div>
        }
      />
      <MissingRatesBanner missing={result.missing} href={`/costings/${c.id}/pricing`} />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm tabular-nums">
            <thead>
              <tr className="text-right text-muted">
                <th className="px-4 py-2 text-left font-medium">#</th>
                <th className="px-2 py-2 text-left font-medium">Drawing</th>
                {cols.map((col) => (
                  <th key={col.label} className="px-2 py-2 font-medium last:pr-4">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.d.drawing.id} className="border-t border-line text-right">
                  <td className="px-4 py-2 text-left">{i + 1}</td>
                  <td className="px-2 py-2 text-left">
                    <span className="font-medium">{r.d.drawing.drawingNo}</span>
                    {r.d.drawing.title && <span className="block text-xs text-muted">{r.d.drawing.title}</span>}
                  </td>
                  {cols.map((col) => (
                    <td key={col.label} className="px-2 py-2 last:pr-4">{col.money ? inr(col.get(r)) : kg(col.get(r))}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ink text-right font-semibold">
                <td className="px-4 py-2 text-left" colSpan={2}>Total</td>
                {cols.map((col) => (
                  <td key={col.label} className="px-2 py-2 last:pr-4">{col.money ? inr(sum(col.get)) : kg(sum(col.get))}</td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
      <Card className="mt-4 max-w-md lg:ml-auto">
        <CardHeader title="Grand total" />
        <div className="px-4 py-2">
          <Stat label="Subtotal" value={inr(result.subtotal)} />
          <Stat label={`Profit ${c.profitPct}%`} value={inr(result.profit)} />
          <div className="mt-1 border-t border-line pt-1">
            <Stat label="Grand total" value={inr(result.grandTotal)} strong />
          </div>
          <p className="pb-2 text-xs text-muted">GST and transport not included.</p>
        </div>
      </Card>
    </>
  );
}
