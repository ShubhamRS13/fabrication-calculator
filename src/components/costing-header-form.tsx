"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCostingAction, updateCostingAction } from "@/app/actions";
import { parseNum } from "@/lib/format";
import { Button, ErrorText, Input, Label, Select } from "./ui";

export interface HeaderValues {
  clientName: string;
  projectName: string;
  poNo: string;
  drawingRef: string;
  createdBy: string;
  costingDate: string;
  defaultMaterial: string;
  burningPct: number;
  profitPct: number;
}

export function CostingHeaderForm({
  costingId,
  initial,
  materials,
}: {
  costingId?: string;
  initial: HeaderValues;
  materials: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  function submit(fd: FormData) {
    const s = (k: string) => String(fd.get(k) ?? "").trim();
    const burning = parseNum(s("burningPct"));
    const profit = parseNum(s("profitPct"));
    if (burning === null || Number.isNaN(burning)) return setError("Burning % must be a number");
    if (profit === null || Number.isNaN(profit)) return setError("Profit % must be a number");
    const data = {
      clientName: s("clientName"),
      projectName: s("projectName"),
      poNo: s("poNo"),
      drawingRef: s("drawingRef"),
      createdBy: s("createdBy"),
      costingDate: s("costingDate") || undefined,
      defaultMaterial: s("defaultMaterial"),
      burningPct: burning,
      profitPct: profit,
    };
    setError(undefined);
    setSaved(false);
    start(async () => {
      if (costingId) {
        const res = await updateCostingAction(costingId, data);
        if (!res.ok) return setError(res.error);
        setSaved(true);
      } else {
        const res = await createCostingAction(data);
        if (!res.ok) return setError(res.error);
        router.push(`/costings/${res.data}`);
      }
    });
  }

  return (
    <form action={submit} className="grid gap-4 p-4 sm:grid-cols-2">
      <label className="block">
        <Label>Client name *</Label>
        <Input name="clientName" required defaultValue={initial.clientName} autoComplete="off" />
      </label>
      <label className="block">
        <Label>Project name *</Label>
        <Input name="projectName" required defaultValue={initial.projectName} autoComplete="off" />
      </label>
      <label className="block">
        <Label>PO no.</Label>
        <Input name="poNo" defaultValue={initial.poNo} autoComplete="off" />
      </label>
      <label className="block">
        <Label>Drawing ref</Label>
        <Input name="drawingRef" defaultValue={initial.drawingRef} autoComplete="off" />
      </label>
      <label className="block">
        <Label>Created by</Label>
        <Input name="createdBy" defaultValue={initial.createdBy} />
      </label>
      <label className="block">
        <Label>Date</Label>
        <Input name="costingDate" type="date" defaultValue={initial.costingDate} />
      </label>
      <label className="block">
        <Label hint="Drawings and items can override">Default material</Label>
        <Select name="defaultMaterial" defaultValue={initial.defaultMaterial}>
          {materials.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </Select>
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <Label>Burning %</Label>
          <Input name="burningPct" inputMode="decimal" defaultValue={String(initial.burningPct)} />
        </label>
        <label className="block">
          <Label>Profit %</Label>
          <Input name="profitPct" inputMode="decimal" defaultValue={String(initial.profitPct)} />
        </label>
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : costingId ? "Save details" : "Create costing"}
        </Button>
        {saved && !pending && <span className="text-sm text-ok">Saved</span>}
        <ErrorText>{error}</ErrorText>
      </div>
    </form>
  );
}
