import Link from "next/link";
import { Suspense } from "react";
import { AddDrawingForm } from "@/components/add-drawing-form";
import { CostingRowActions } from "@/components/costing-row-actions";
import { MaterialTable } from "@/components/totals";
import { ButtonLink, Card, CardHeader, Empty, PageTitle, Skeleton, Stat } from "@/components/ui";
import { formatDate, inr, kg } from "@/lib/format";
import { loadCosting } from "@/server/load";

export default function CostingPage(props: PageProps<"/costings/[id]">) {
  return (
    <Suspense fallback={<Skeleton lines={5} />}>
      <Overview params={props.params} />
    </Suspense>
  );
}

async function Overview({ params }: { params: Promise<{ id: string }> }) {
  const { tree, result } = await loadCosting(params);
  const c = tree.costing;
  const ratesMissing = tree.rates.every((r) => r.rate === null);
  const base = `/costings/${c.id}`;

  return (
    <>
      <PageTitle
        back={{ href: "/", label: "Costings" }}
        title={c.projectName}
        sub={`${c.clientName}${c.poNo ? ` · PO ${c.poNo}` : ""} · ${formatDate(c.costingDate)} · default ${c.defaultMaterial}, burning ${c.burningPct}%`}
        action={
          <>
            <ButtonLink href={`${base}/setup`}>Rates & setup</ButtonLink>
            <ButtonLink href={`${base}/rates`}>Size rate chart</ButtonLink>
            <ButtonLink href={`${base}/summary`} variant="primary">Summary</ButtonLink>
          </>
        }
      />

      {ratesMissing && (
        <p className="mb-4 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-accent">
          No material rates yet — weights are shown, but ₹ amounts will be 0 until you enter rates in{" "}
          <Link href={`${base}/setup`} className="font-medium underline">Rates & setup</Link>.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader title="Drawings" sub="Each drawing holds its items and assemblies." />
          {tree.drawings.length === 0 ? (
            <Empty>No drawings yet. Add the first drawing below.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {result.drawings.map((d) => {
                const errors = d.items.filter((i) => i.error).length;
                const weight = d.byMaterial.reduce((a, t) => a + t.process, 0);
                return (
                  <li key={d.drawing.id}>
                    <Link href={`${base}/drawings/${d.drawing.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-paper">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {d.drawing.drawingNo}
                          {d.drawing.title && <span className="font-normal text-muted"> · {d.drawing.title}</span>}
                        </p>
                        <p className="text-sm text-muted">
                          {d.items.length} item{d.items.length === 1 ? "" : "s"} · {kg(weight)} kg process
                          {errors > 0 && <span className="text-danger"> · {errors} need attention</span>}
                        </p>
                      </div>
                      <span className="tabular-nums font-medium">{inr(d.total)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <AddDrawingForm costingId={c.id} />
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Totals" />
            <div className="px-4 py-2">
              <Stat label="Subtotal" value={inr(result.subtotal)} />
              <Stat label={`Profit ${c.profitPct}%`} value={inr(result.profit)} />
              <div className="mt-1 border-t border-line pt-1">
                <Stat label="Grand total" value={inr(result.grandTotal)} strong />
              </div>
              <p className="pb-2 text-xs text-muted">GST and transport not included.</p>
            </div>
          </Card>
          <Card>
            <CardHeader title="Danger zone" />
            <div className="px-4 py-3">
              <CostingRowActions id={c.id} name={c.projectName} redirectAfterDelete="/" />
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader title="Weights by material" sub="All drawings" />
        <MaterialTable rows={result.byMaterial} />
      </Card>
    </>
  );
}
