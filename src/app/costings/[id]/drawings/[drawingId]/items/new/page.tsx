import { Suspense } from "react";
import { ItemEditor } from "@/components/item-editor";
import { PageTitle, Skeleton } from "@/components/ui";
import { loadDrawing } from "@/server/load";
import { getCustomShapes, getMaterials } from "@/server/queries";

export const metadata = { title: "Add item" };

export default function NewItemPage(props: PageProps<"/costings/[id]/drawings/[drawingId]/items/new">) {
  return (
    <Suspense fallback={<Skeleton lines={5} />}>
      <NewItem params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function NewItem({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; drawingId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ tree, drawing }, mats, shapes, sp] = await Promise.all([loadDrawing(params), getMaterials(), getCustomShapes(), searchParams]);
  const back = `/costings/${tree.costing.id}/drawings/${drawing.id}`;
  return (
    <>
      <PageTitle back={{ href: back, label: drawing.drawingNo }} title="Add item" sub="Pick the item type, then fill in the sizes from the drawing." />
      <ItemEditor
        costingId={tree.costing.id}
        drawingId={drawing.id}
        backHref={back}
        materials={mats}
        defaultMaterial={drawing.material ?? tree.costing.defaultMaterial}
        assemblies={drawing.assemblies.map(({ id, name, qty, material }) => ({ id, name, qty, material }))}
        customShapes={shapes}
        siblings={drawing.items.map(({ id, itemNo, assemblyId }) => ({ id, itemNo, assemblyId }))}
        initialType={typeof sp.type === "string" ? sp.type : undefined}
      />
    </>
  );
}
