import { Suspense } from "react";
import { PricingBoard, type PricingData } from "@/components/pricing-board";
import { PageTitle, Skeleton } from "@/components/ui";
import { UNITS_BY_GROUP } from "@/lib/calc/costing";
import { formatDate } from "@/lib/format";
import { loadCosting } from "@/server/load";
import { getLastUsedRates, getMaterials, searchCostings } from "@/server/queries";

export const metadata = { title: "Pricing" };

export default function PricingPage(props: PageProps<"/costings/[id]/pricing">) {
  return (
    <Suspense fallback={<Skeleton lines={8} />}>
      <Pricing params={props.params} />
    </Suspense>
  );
}

async function Pricing({ params }: { params: Promise<{ id: string }> }) {
  const { tree, result } = await loadCosting(params);
  const c = tree.costing;
  const [mats, hints, others] = await Promise.all([getMaterials(), getLastUsedRates(c.id), searchCostings("")]);

  const items = result.drawings.flatMap((d) => d.items);
  const materialKg = new Map<string, number>();
  for (const it of items) if (it.pricedBy === "material") materialKg.set(it.material, (materialKg.get(it.material) ?? 0) + it.processWt + it.burning);

  const sum = (f: (d: (typeof result.drawings)[number]) => number) => result.drawings.reduce((a, d) => a + f(d), 0);
  const data: PricingData = {
    costingId: c.id,
    materials: mats.map((m) => {
      const r = tree.rates.find((x) => x.material === m.code);
      return { material: m.code, rate: r?.rate ?? null, scrapRate: r?.scrapRate ?? null, used: materialKg.has(m.code), kg: materialKg.get(m.code) ?? 0 };
    }),
    materialCodes: mats.map((m) => m.code),
    scrapCredit: result.byMaterial.reduce((a, t) => a + t.scrapCredit, 0),
    prices: result.prices,
    units: UNITS_BY_GROUP,
    charges: tree.chargeLines.map((l) => ({
      id: l.id,
      name: l.name,
      rate: l.rate,
      basis: l.basis,
      appliesTo: l.appliesTo,
      weight: result.drawings.reduce((a, d) => a + (d.charges.find((x) => x.line.id === l.id)?.weight ?? 0), 0),
      amount: result.drawings.reduce((a, d) => a + (d.charges.find((x) => x.line.id === l.id)?.amount ?? 0), 0),
    })),
    profitPct: c.profitPct,
    totals: {
      material: sum((d) => d.materialTotal),
      charges: sum((d) => d.chargesTotal),
      bought: sum((d) => d.boughtTotal),
      subtotal: result.subtotal,
      profit: result.profit,
      grand: result.grandTotal,
    },
    missing: result.missing,
    hints,
    otherCostings: others
      .filter((o) => o.id !== c.id)
      .map((o) => ({ id: o.id, label: `${o.projectName} – ${o.clientName} (${formatDate(o.costingDate)})` })),
  };

  return (
    <>
      <PageTitle
        back={{ href: `/costings/${c.id}`, label: c.projectName }}
        title="Pricing"
        sub="Every rate for this costing in one place. Saved when you leave a box. Blank = missing; 0 = free."
      />
      <PricingBoard data={data} />
    </>
  );
}
