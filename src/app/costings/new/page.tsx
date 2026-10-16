import { Suspense } from "react";
import { CostingHeaderForm } from "@/components/costing-header-form";
import { Card, PageTitle, Skeleton } from "@/components/ui";
import { getMaterials } from "@/server/queries";

export const metadata = { title: "New costing" };

export default function NewCostingPage() {
  return (
    <>
      <PageTitle title="New costing" back={{ href: "/", label: "Costings" }} sub="Rates and charge lines are filled in on the next screen." />
      <Card>
        <Suspense fallback={<div className="p-4"><Skeleton lines={3} /></div>}>
          <NewForm />
        </Suspense>
      </Card>
    </>
  );
}

async function NewForm() {
  const materials = (await getMaterials()).map((m) => m.code);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <CostingHeaderForm
      materials={materials}
      initial={{
        clientName: "",
        projectName: "",
        poNo: "",
        drawingRef: "",
        createdBy: "Shubham Shinde",
        costingDate: today,
        defaultMaterial: materials.includes("SS304") ? "SS304" : materials[0],
        burningPct: 3,
        profitPct: 0,
      }}
    />
  );
}
