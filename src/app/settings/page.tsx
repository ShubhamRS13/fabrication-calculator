import Image from "next/image";
import { Suspense } from "react";
import { CompanyForm, CustomShapeForm, DeleteShapeButton, MaterialsEditor } from "@/components/settings-forms";
import { Card, CardHeader, Empty, PageTitle, Skeleton } from "@/components/ui";
import { num } from "@/lib/format";
import { getCustomShapes, getMaterials, getSectionSizes, getSettings } from "@/server/queries";

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
  const [company, materials, shapes, sections] = await Promise.all([getSettings(), getMaterials(), getCustomShapes(), getSectionSizes()]);
  const series = [...new Set(sections.map((s) => s.series))];

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
          <CardHeader title="Section & pipe tables" sub="Starter values; check against supplier data" />
          <p className="border-b border-line px-4 py-2 text-xs text-muted">
            Read-only for now. Adding and editing sizes here arrives with the next library update; until then, use “Pipe / tube custom”, a std kg/m override on tubes, or a custom shape for missing sizes.
          </p>
          {series.map((name) => {
            const rows = sections.filter((s) => s.series === name);
            return (
              <details key={name} className="border-b border-line last:border-0">
                <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">
                  {name} <span className="font-normal text-muted">· {rows.length} sizes</span>
                </summary>
                <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                  {rows.map((r) => (
                    <span key={r.id} className="rounded-md bg-paper px-2 py-1 text-xs tabular-nums">
                      {r.size}
                      <span className="text-muted">
                        {" "}
                        {r.data.kgPerM !== undefined
                          ? `${num(r.data.kgPerM)} kg/m`
                          : r.data.wall !== undefined
                            ? `OD ${num(r.data.od)} × ${num(r.data.wall)}`
                            : r.data.thk !== undefined
                              ? `${num(r.data.thk)} mm`
                              : ""}
                      </span>
                    </span>
                  ))}
                </div>
              </details>
            );
          })}
        </Card>
      </div>
    </div>
  );
}
