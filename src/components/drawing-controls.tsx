"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  addAssemblyAction, deleteAssemblyAction, deleteDrawingAction, updateAssemblyAction, updateDrawingAction,
} from "@/app/actions";
import { parseNum } from "@/lib/format";
import { Button, ErrorText, Input, Label, Select } from "./ui";

/** Drawing no., title, material and burning overrides; delete. */
export function DrawingSettings({
  costingId,
  drawing,
  materials,
  costingDefaults,
}: {
  costingId: string;
  drawing: { id: string; drawingNo: string; title: string; material: string | null; burningPct: number | null };
  materials: string[];
  costingDefaults: { material: string; burningPct: number };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  function submit(fd: FormData) {
    const burning = parseNum(String(fd.get("burningPct") ?? ""));
    if (Number.isNaN(burning)) return setError("Burning % must be a number");
    const material = String(fd.get("material") ?? "");
    setSaved(false);
    start(async () => {
      const res = await updateDrawingAction(costingId, drawing.id, {
        drawingNo: String(fd.get("drawingNo") ?? "").trim(),
        title: String(fd.get("title") ?? "").trim(),
        material: material || null,
        burningPct: burning,
      });
      setError(res.ok ? undefined : res.error);
      setSaved(res.ok);
    });
  }

  function remove() {
    if (!confirm(`Delete drawing ${drawing.drawingNo} and all its items?`)) return;
    start(async () => {
      const res = await deleteDrawingAction(costingId, drawing.id);
      if (res.ok) router.push(`/costings/${costingId}`);
      else setError(res.error);
    });
  }

  return (
    <form action={submit} className="grid gap-3 p-4 sm:grid-cols-2">
      <label className="block">
        <Label>Drawing no.</Label>
        <Input name="drawingNo" required defaultValue={drawing.drawingNo} />
      </label>
      <label className="block">
        <Label>Title</Label>
        <Input name="title" defaultValue={drawing.title} />
      </label>
      <label className="block">
        <Label>Material</Label>
        <Select name="material" defaultValue={drawing.material ?? ""}>
          <option value="">Costing default ({costingDefaults.material})</option>
          {materials.map((m) => <option key={m}>{m}</option>)}
        </Select>
      </label>
      <label className="block">
        <Label>Burning %</Label>
        <Input name="burningPct" inputMode="decimal" defaultValue={drawing.burningPct?.toString() ?? ""} placeholder={`Costing default (${costingDefaults.burningPct})`} />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" variant="primary" disabled={pending}>Save drawing</Button>
        <Button type="button" variant="danger" onClick={remove} disabled={pending}>Delete drawing</Button>
        {saved && !pending && <span className="text-sm text-ok">Saved</span>}
        <ErrorText>{error}</ErrorText>
      </div>
    </form>
  );
}

export function AddAssemblyForm({ costingId, drawingId }: { costingId: string; drawingId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const form = useRef<HTMLFormElement>(null);

  function submit(fd: FormData) {
    const qty = parseNum(String(fd.get("qty") ?? ""));
    if (qty === null || Number.isNaN(qty) || qty <= 0) return setError("Quantity must be more than 0");
    start(async () => {
      const res = await addAssemblyAction(costingId, drawingId, { name: String(fd.get("name") ?? "").trim(), qty });
      if (!res.ok) return setError(res.error);
      setError(undefined);
      form.current?.reset();
    });
  }

  return (
    <form ref={form} action={submit} className="grid grid-cols-[1fr_7.5rem] gap-2 px-4 py-3 sm:grid-cols-[1fr_7.5rem_auto]">
      <Input name="name" required placeholder="Assembly name, e.g. Cyclone assembly" aria-label="Assembly name" />
      <Input name="qty" required inputMode="decimal" placeholder="Qty, e.g. 1" aria-label="Assembly quantity" />
      <Button type="submit" disabled={pending} className="col-span-2 sm:col-span-1">+ Add assembly</Button>
      <div className="col-span-2 sm:col-span-3"><ErrorText>{error}</ErrorText></div>
    </form>
  );
}

/** Inline quantity edit and delete for an assembly header. */
export function AssemblyControls({ costingId, assembly }: { costingId: string; assembly: { id: string; name: string; qty: number } }) {
  const [qty, setQty] = useState(String(assembly.qty));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();

  function saveQty() {
    const n = parseNum(qty);
    if (n === null || Number.isNaN(n) || n <= 0) return setError("Qty must be more than 0");
    if (n === assembly.qty) return;
    start(async () => {
      const res = await updateAssemblyAction(costingId, assembly.id, { qty: n });
      setError(res.ok ? undefined : res.error);
    });
  }

  function remove() {
    if (!confirm(`Remove assembly “${assembly.name}”? Its items stay on the drawing, ungrouped.`)) return;
    start(async () => {
      const res = await deleteAssemblyAction(costingId, assembly.id);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-1 text-sm text-muted">
        ×
        <Input value={qty} onChange={(e) => setQty(e.target.value)} onBlur={saveQty} inputMode="decimal" aria-label={`${assembly.name} quantity`} className="h-8 w-16 px-2" />
      </label>
      <Button variant="ghost" onClick={remove} disabled={pending} className="h-8 px-2 text-danger">Remove</Button>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
