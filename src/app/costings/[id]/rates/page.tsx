import { redirect } from "next/navigation";
import { Suspense } from "react";

/** The size rate chart is now part of the Rates page (route /pricing). */
export default function OldRatesPage(props: PageProps<"/costings/[id]/rates">) {
  return (
    <Suspense>
      <Forward params={props.params} />
    </Suspense>
  );
}

async function Forward({ params }: { params: Promise<{ id: string }> }): Promise<null> {
  const { id } = await params;
  redirect(`/costings/${encodeURIComponent(id)}/pricing`);
}
