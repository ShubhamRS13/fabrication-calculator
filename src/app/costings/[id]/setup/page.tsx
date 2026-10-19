import { Suspense } from "react";
import { CostingHeaderForm } from "@/components/costing-header-form";
import { ButtonLink, Card, CardHeader, PageTitle, Skeleton } from "@/components/ui";
import { getMaterials } from "@/server/queries";
import { loadCosting } from "@/server/load";

export const metadata = { title: "Details" };

/** Costing details: client, project, PO, defaults. All rates live on the Rates page. */
export default function DetailsPage(props: PageProps<"/costings/[id]/setup">) {
  return (
    <Suspense fallback={<Skeleton lines={4} />}>
      <Details params={props.params} />
    </Suspense>
  );
}

async function Details({ params }: { params: Promise<{ id: string }> }) {
  const [{ tree }, mats] = await Promise.all([loadCosting(params), getMaterials()]);
  const c = tree.costing;
  return (
    <>
      <PageTitle
        back={{ href: `/costings/${c.id}`, label: c.projectName }}
        title="Details"
        sub="Client, project and defaults. Rates, charges and profit are on the Rates page."
        action={<ButtonLink href={`/costings/${c.id}/pricing`} variant="primary">Rates →</ButtonLink>}
      />
      <Card>
        <CardHeader title="Costing details" />
        <CostingHeaderForm
          costingId={c.id}
          materials={mats.map((m) => m.code)}
          initial={{
            clientName: c.clientName,
            projectName: c.projectName,
            poNo: c.poNo,
            drawingRef: c.drawingRef,
            createdBy: c.createdBy,
            costingDate: c.costingDate,
            defaultMaterial: c.defaultMaterial,
            burningPct: c.burningPct,
          }}
        />
      </Card>
    </>
  );
}
