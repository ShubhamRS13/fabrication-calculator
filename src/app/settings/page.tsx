import Image from "next/image";
import { Suspense } from "react";
import { CompanyForm, CustomShapeForm, DeleteShapeButton, MaterialsEditor } from "@/components/settings-forms";
import { SectionTablesEditor } from "@/components/section-tables-editor";
import { BoughtKindsEditor } from "@/components/bought-kinds-editor";
import { Card, CardHeader, Empty, PageTitle, Skeleton } from "@/components/ui";
import { getBoughtKinds, getCustomShapes, getMaterials, getSectionSizes, getSettings } from "@/server/queries";

export const metadata = { title: "Library & settings" };

export default function SettingsPage() {
  return (
    <>
      <PageTitle title="Library & settings" sub="Materials, custom shapes, section tables and company details." />
      <Suspense fallback={<Skeleton lines={6} />}>
        <Settings />
      </Suspense>
    </>
  );
}

async function Settings() {
  const [company, materials, shapes, sections, kinds] = await Promise.all([getSettings(), getMaterials(), getCustomShapes(), getSectionSizes(), getBoughtKinds()]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <Card>
          <CardHeader title="Materials & densities" sub="Changing a density updates every costing that uses it" />
          <MaterialsEditor materials={materials} />
        </Card>
        <Card>
          <CardHeader title="Company details" sub="Printed on the Excel and PDF exports" />
          <div className="flex items-center gap-4 px-4 pt-4">
            <Image src={company.logoPath} alt="Shubhangi Engineers logo" width={88} height={88} className="rounded-lg border border-line" />
            <p className="text-sm text-muted">Logo: the version you supplied. Uploading a new one comes with the exports (Milestone 4).</p>
          </div>
          <CompanyForm initial={{ companyName: company.companyName, address: company.address, email: company.email, phone: company.phone }} />
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader title="Custom shapes" sub="Your own inputs and weight formula, like the Excel LAMBDAs" />
          {shapes.length === 0 ? (
            <Empty>No custom shapes yet.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {shapes.map((s) => (
                <li key={s.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{s.name}</p>
                    <p className="truncate font-mono text-xs text-muted">({s.inputs.map((i) => i.key).join(", ")}) → {s.finishFormula}</p>
                  </div>
                  <DeleteShapeButton id={s.id} name={s.name} />
                </li>
              ))}
            </ul>
          )}
          <details className="border-t border-line">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">+ New custom shape</summary>
            <CustomShapeForm />
          </details>
        </Card>

        <Card>
          <CardHeader title="Bought-out items" sub="The list you pick bought-outs from. Add your own kinds; built-in ones stay" />
          <BoughtKindsEditor kinds={kinds.map(({ name, template, unit, builtIn }) => ({ name, template, unit, builtIn }))} />
        </Card>
        <Card>
          <CardHeader title="Section & pipe tables" sub="Starter values from IS 808 / ASME / IS 1239 — check against supplier data" />
          <SectionTablesEditor rows={sections.map(({ id, series, size, data, builtIn }) => ({ id, series, size, data, builtIn }))} />
        </Card>
      </div>
    </div>
  );
}
