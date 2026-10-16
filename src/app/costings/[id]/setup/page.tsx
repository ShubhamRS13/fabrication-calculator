import { Suspense } from "react";
import { ChargeLinesEditor } from "@/components/charge-lines-editor";
import { CostingHeaderForm } from "@/components/costing-header-form";
import { RatesEditor } from "@/components/rates-editor";
import { Card, CardHeader, PageTitle, Skeleton } from "@/components/ui";
import { getMaterials } from "@/server/queries";
import { loadCosting } from "@/server/load";

export const metadata = { title: "Rates & setup" };

export default function SetupPage(props: PageProps<"/costings/[id]/setup">) {
  return (
    <Suspense fallback={<Skeleton lines={6} />}>
      <Setup params={props.params} />
    </Suspense>
  );
}

async function Setup({ params }: { params: Promise<{ id: string }> }) {
  const [{ tree }, mats] = await Promise.all([loadCosting(params), getMaterials()]);
  const c = tree.costing;
  const materials = mats.map((m) => m.code);
  // Show a rate row for every material, even ones added after the costing was created.
  const rates = materials.map((code) => {
    const r = tree.rates.find((x) => x.material === code);
    return { material: code, rate: r?.rate ?? null, scrapRate: r?.scrapRate ?? null };
  });

  return (
    <>
      <PageTitle back={{ href: `/costings/${c.id}`, label: c.projectName }} title="Rates & setup" sub="All rates are negotiated per costing. Blank counts as 0." />
      <div className="space-y-4">
        <Card>
          <CardHeader title="Costing details" />
          <CostingHeaderForm
            costingId={c.id}
            materials={materials}
            initial={{
              clientName: c.clientName,
              projectName: c.projectName,
              poNo: c.poNo,
              drawingRef: c.drawingRef,
              createdBy: c.createdBy,
              costingDate: c.costingDate,
              defaultMaterial: c.defaultMaterial,
              burningPct: c.burningPct,
              profitPct: c.profitPct,
            }}
          />
        </Card>
        <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
          <Card>
            <CardHeader title="Material rates" sub="Saved when you leave a field" />
            <RatesEditor costingId={c.id} rows={rates} />
          </Card>
          <Card>
            <CardHeader title="Charge lines" sub="₹/kg on process or finish weight, worked out per drawing" />
            <ChargeLinesEditor
              costingId={c.id}
              materials={materials}
              lines={tree.chargeLines.map(({ id, name, rate, basis, appliesTo }) => ({ id, name, rate, basis, appliesTo }))}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
