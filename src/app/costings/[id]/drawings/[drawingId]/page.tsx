import Link from "next/link";
import { Suspense } from "react";
import { AddAssemblyForm, AssemblyControls, DrawingSettings } from "@/components/drawing-controls";
import { ChargeList, MaterialTable } from "@/components/totals";
import { ButtonLink, Card, CardHeader, Empty, PageTitle, Skeleton, Stat } from "@/components/ui";
import type { ItemOutput } from "@/lib/calc/costing";
import { buildRegistry } from "@/lib/calc/registry";
import { inr, kg, num } from "@/lib/format";
import { compareItemNo } from "@/lib/item-no";
import { loadDrawing } from "@/server/load";
import { getCustomShapes, getMaterials } from "@/server/queries";

export default function DrawingPage(props: PageProps<"/costings/[id]/drawings/[drawingId]">) {
  return (
    <Suspense fallback={<Skeleton lines={6} />}>
      <Drawing params={props.params} />
    </Suspense>
  );
}

async function Drawing({ params }: { params: Promise<{ id: string; drawingId: string }> }) {
  const [{ tree, drawing, out }, mats, shapes] = await Promise.all([loadDrawing(params), getMaterials(), getCustomShapes()]);
  const c = tree.costing;
  const registry = buildRegistry(shapes);
  const base = `/costings/${c.id}/drawings/${drawing.id}`;
  const label = (type: string) => registry.get(type)?.label ?? type;

  const byNo = (x: ItemOutput, y: ItemOutput) => compareItemNo(x.item.itemNo ?? "", y.item.itemNo ?? "");
  const loose = out.items.filter((i) => !i.item.assemblyId).sort(byNo);
  const groups = drawing.assemblies.map((a) => ({ a, items: out.items.filter((i) => i.item.assemblyId === a.id).sort(byNo) }));

  const row = (it: ItemOutput) => (
    <li key={it.item.id}>
      <Link href={`${base}/items/${it.item.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-paper">
        <span
          className="mt-0.5 flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full border border-ink px-1.5 text-xs font-semibold tabular-nums"
          title="Item no."
        >
          {it.item.itemNo || "–"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {it.item.name}
            {it.item.dwgSheet && <span className="font-normal text-muted"> · sheet {it.item.dwgSheet}</span>}
          </p>
          <p className="truncate text-sm text-muted">
            {label(it.item.type)} · {it.unit?.costedByWeight === false ? "bought" : it.material} · qty {num(it.item.qty)}
            {it.multiplier !== it.item.qty && ` (× ${num(it.multiplier / it.item.qty)} = ${num(it.multiplier)})`}
          </p>
          {it.error && <p className="text-sm text-danger">{it.error}</p>}
        </div>
        <div className="shrink-0 text-right text-sm tabular-nums">
          {it.unit?.costedByWeight === false ? (
            <p className="font-medium">{inr(it.fixedAmount)}</p>
          ) : (
            <>
              <p className="font-medium">{kg(it.processWt)} kg</p>
              <p className="text-muted">fin {kg(it.finishWt)}</p>
              {it.fixedAmount > 0 && <p className="text-muted">+ {inr(it.fixedAmount)}</p>}
            </>
          )}
        </div>
      </Link>
    </li>
  );

  return (
    <>
      <PageTitle
        back={{ href: `/costings/${c.id}`, label: c.projectName }}
        title={drawing.drawingNo}
        sub={`${drawing.title || "Drawing"} · material ${drawing.material ?? c.defaultMaterial}${drawing.material ? "" : " (default)"}`}
        action={<ButtonLink href={`${base}/items/new`} variant="primary">+ Add item</ButtonLink>}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem] [&>*]:min-w-0">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Items" sub={`${out.items.length} item${out.items.length === 1 ? "" : "s"}`} />
            {loose.length > 0 ? (
              <ul className="divide-y divide-line">{loose.map(row)}</ul>
            ) : (
              <Empty>{out.items.length ? "All items are in the assemblies below." : "No items yet. Tap “+ Add item” to add the first one."}</Empty>
            )}
          </Card>

          {groups.map(({ a, items }) => (
            <Card key={a.id}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
                <h2 className="font-semibold">{a.name}</h2>
                <AssemblyControls costingId={c.id} assembly={{ id: a.id, name: a.name, qty: a.qty }} />
              </div>
              {items.length === 0 ? (
                <Empty>No items in this assembly. Pick it when adding or editing an item.</Empty>
              ) : (
                <ul className="divide-y divide-line">{items.map(row)}</ul>
              )}
            </Card>
          ))}

          <Card>
            <CardHeader title="Assemblies" sub="Group items under a name with a quantity, e.g. Cyclone assembly × 2" />
            <AddAssemblyForm costingId={c.id} drawingId={drawing.id} />
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Drawing total" />
            <div className="px-4 py-2">
              <Stat label="Material (net of scrap)" value={inr(out.materialTotal)} />
              <ChargeList charges={out.charges} />
              <Stat label={<>Bought / job work{out.boughtWt > 0 && <span className="text-xs"> ({kg(out.boughtWt)} kg)</span>}</>} value={inr(out.boughtTotal)} />
              <div className="mt-1 border-t border-line pt-1">
                <Stat label="Total" value={inr(out.total)} strong />
              </div>
            </div>
          </Card>
          <Card>
            <details>
              <summary className="cursor-pointer px-4 py-3 font-semibold">Drawing settings</summary>
              <DrawingSettings
                costingId={c.id}
                drawing={{ id: drawing.id, drawingNo: drawing.drawingNo, title: drawing.title, material: drawing.material, burningPct: drawing.burningPct }}
                materials={mats.map((m) => m.code)}
                costingDefaults={{ material: c.defaultMaterial, burningPct: c.burningPct }}
              />
            </details>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader title="Weights by material" sub="This drawing, all quantities included" />
        <MaterialTable rows={out.byMaterial} />
      </Card>
    </>
  );
}
