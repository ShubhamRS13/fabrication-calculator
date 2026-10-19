"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteCostingAction, duplicateCostingAction } from "@/app/actions";
import { Button } from "./ui";

export function CostingRowActions({ id, name, redirectAfterDelete }: { id: string; name: string; redirectAfterDelete?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const duplicate = () =>
    start(async () => {
      const res = await duplicateCostingAction(id);
      if (res.ok) router.push(`/costings/${res.data}/pricing`);
      else alert(res.error);
    });

  const remove = () => {
    if (!confirm(`Delete “${name}” and all its drawings? This cannot be undone.`)) return;
    start(async () => {
      const res = await deleteCostingAction(id);
      if (!res.ok) alert(res.error);
      else if (redirectAfterDelete) router.push(redirectAfterDelete);
    });
  };

  return (
    <div className="flex shrink-0 gap-1.5 self-end sm:self-auto">
      <Button onClick={duplicate} disabled={pending} title="Duplicate for a similar job" className="h-9 px-3">
        Duplicate
      </Button>
      <Button onClick={remove} disabled={pending} variant="danger" title="Delete costing" className="h-9 px-3">
        Delete
      </Button>
    </div>
  );
}
