import { Suspense } from "react";
import { RateChartEditor } from "@/components/rate-chart-editor";
import { Card, CardHeader, Empty, PageTitle, Skeleton } from "@/components/ui";
import { sizeRateRows } from "@/lib/calc/costing";
import { loadCosting } from "@/server/load";

export const metadata = { title: "Size rate chart" };

export default function RateChartPage(props: PageProps<"/costings/[id]/rates">) {
  return (
    <Suspense fallback={<Skeleton lines={6} />}>
      <RateChart params={props.params} />
    </Suspense>
  );
}

async function RateChart({ params }: { params: Promise<{ id: string }> }) {
  const { tree, result } = await loadCosting(params);
  const c = tree.costing;
  const stored = new Map(tree.sizeRates.map((r) => [r.key, r]));
  const rows = sizeRateRows(result).map((r) => ({
    ...r,
    rate: stored.get(r.key)?.rate ?? null,
    unit: stored.get(r.key)?.unit ?? ("kg" as const),
  }));
  const materialRates = Object.fromEntries(tree.rates.map((r) => [r.material, r.rate]));

  return (
    <>
      <PageTitle
        back={{ href: `/costings/${c.id}`, label: c.projectName }}
        title="Size rate chart"
        sub="Pipes, tubes, bars, flats and rolled sections priced by size. Leave a rate blank to use the material ₹/kg rate."
      />
      <Card>
        <CardHeader title={`${rows.length} size${rows.length === 1 ? "" : "s"} in this costing`} sub="Quantities include every drawing and assembly. Saved when you leave a box." />
        {rows.length === 0 ? (
          <Empty>No pipes, tubes, bars or sections in this costing yet.</Empty>
        ) : (
          <RateChartEditor costingId={c.id} rows={rows} materialRates={materialRates} />
        )}
      </Card>
      <p className="mt-3 text-xs text-muted">
        ₹/kg includes the burning allowance, like the material rate. ₹/m prices the total cut length; ₹/piece prices each piece. Duplicating the costing copies this chart.
      </p>
    </>
  );
}
