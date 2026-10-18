import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ItemEditor } from "@/components/item-editor";
import { PageTitle, Skeleton } from "@/components/ui";
import { loadDrawing } from "@/server/load";
import { getCustomShapes, getMaterials, getSectionLibrary } from "@/server/queries";

export const metadata = { title: "Edit item" };

export default function EditItemPage(props: PageProps<"/costings/[id]/drawings/[drawingId]/items/[itemId]">) {
  return (
    <Suspense fallback={<Skeleton lines={5} />}>
      <EditItem params={props.params} />
    </Suspense>
  );
}

async function EditItem({ params }: { params: Promise<{ id: string; drawingId: string; itemId: string }> }) {
  const [{ tree, drawing }, mats, shapes, { itemId }, sectionLib] = await Promise.all([loadDrawing(params), getMaterials(), getCustomShapes(), params, getSectionLibrary()]);
  const item = drawing.items.find((i) => i.id === itemId);
  if (!item) notFound();
  const back = `/costings/${tree.costing.id}/drawings/${drawing.id}`;
  return (
    <>
      <PageTitle back={{ href: back, label: drawing.drawingNo }} title={item.name} sub="Results update as you type." />
      <ItemEditor
        costingId={tree.costing.id}
        drawingId={drawing.id}
        backHref={back}
        materials={mats}
        defaultMaterial={drawing.material ?? tree.costing.defaultMaterial}
        assemblies={drawing.assemblies.map(({ id, name, qty, material }) => ({ id, name, qty, material }))}
        customShapes={shapes}
        sectionLib={sectionLib}
        siblings={drawing.items.map(({ id, itemNo, assemblyId }) => ({ id, itemNo, assemblyId }))}
        item={{
          id: item.id,
          itemNo: item.itemNo,
          type: item.type,
          name: item.name,
          dwgSheet: item.dwgSheet,
          qty: item.qty,
          material: item.material,
          assemblyId: item.assemblyId,
          inputs: item.inputs,
        }}
      />
    </>
  );
}
