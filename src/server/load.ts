import { notFound } from "next/navigation";
import { getComputedCosting } from "./queries";

/** Load and compute a costing for a page, or render the 404 page. */
export async function loadCosting(params: Promise<{ id: string }>) {
  const { id } = await params;
  const data = await getComputedCosting(id);
  if (!data) notFound();
  return data;
}

export async function loadDrawing(params: Promise<{ id: string; drawingId: string }>) {
  const { id, drawingId } = await params;
  const data = await getComputedCosting(id);
  const index = data?.tree.drawings.findIndex((d) => d.id === drawingId) ?? -1;
  if (!data || index < 0) notFound();
  return { ...data, drawing: data.tree.drawings[index], out: data.result.drawings[index] };
}
