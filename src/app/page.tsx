import Link from "next/link";
import { Suspense } from "react";
import { CostingRowActions } from "@/components/costing-row-actions";
import { ButtonLink, Card, Empty, Input, PageTitle, Skeleton } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { searchCostings } from "@/server/queries";

export default function CostingsPage(props: PageProps<"/">) {
  return (
    <>
      <PageTitle
        title="Costings"
        sub="Search by client, project, PO no. or drawing no."
        action={<ButtonLink href="/costings/new" variant="primary">+ New costing</ButtonLink>}
      />
      <Suspense fallback={<Skeleton lines={4} />}>
        <CostingList searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function CostingList({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const rows = await searchCostings(q);
  return (
    <>
      <form role="search" className="mb-4 flex gap-2">
        <Input name="q" type="search" defaultValue={q} placeholder="Search costings…" aria-label="Search costings" />
        <button className="h-10 rounded-lg border border-line bg-white px-4 text-sm font-medium hover:bg-paper">Search</button>
      </form>
      <Card>
        {rows.length === 0 ? (
          <Empty>{q ? `No costings match “${q}”.` : "No costings yet. Start with “New costing”."}</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                <Link href={`/costings/${r.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{r.projectName}</p>
                  <p className="truncate text-sm text-muted">
                    {r.clientName}
                    {r.poNo && ` · PO ${r.poNo}`} · {r.drawingCount} drawing{r.drawingCount === 1 ? "" : "s"} · {formatDate(r.costingDate)}
                  </p>
                </Link>
                <CostingRowActions id={r.id} name={r.projectName} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
