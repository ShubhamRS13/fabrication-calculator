"use client";

import { useState, useTransition } from "react";
import { addBoughtKindAction, deleteBoughtKindAction } from "@/app/actions";
import { TEMPLATE_LABEL, type Template } from "@/lib/calc/bought-catalogue";
import { Button, ErrorText, Input, Label, Select } from "./ui";

type Unit = "piece" | "set" | "kg" | "m";
const UNIT_LABEL: Record<Unit, string> = { piece: "per piece", set: "per set", kg: "per kg", m: "per metre" };

export function BoughtKindsEditor({ kinds }: { kinds: { name: string; template: string; unit: Unit; builtIn: boolean }[] }) {
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<Template>("fitting");
  const [unit, setUnit] = useState<Unit>("piece");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function add() {
    start(async () => {
      const res = await addBoughtKindAction({ name: name.trim(), template, unit });
      if (!res.ok) return setError(res.error);
      setError(undefined);
      setName("");
    });
  }

  function remove(n: string) {
    if (!confirm(`Remove “${n}” from the list?`)) return;
    start(async () => {
      const res = await deleteBoughtKindAction(n);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div>
      <ul className="flex flex-wrap gap-1.5 p-4">
        {kinds.map((k) => (
          <li key={k.name} className="flex items-center gap-1 rounded-md bg-paper px-2 py-1 text-sm" title={TEMPLATE_LABEL[k.template as Template]}>
            {k.name}
            <span className="text-xs text-muted">· {UNIT_LABEL[k.unit]}</span>
            {!k.builtIn && (
              <button onClick={() => remove(k.name)} disabled={pending} className="ml-1 text-danger" aria-label={`Remove ${k.name}`}>
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="grid gap-2 border-t border-line px-4 py-3 sm:grid-cols-[1fr_1fr_8rem_auto] sm:items-end">
        <label className="block">
          <Label>New item kind</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ball valve" />
        </label>
        <label className="block">
          <Label>Size fields</Label>
          <Select value={template} onChange={(e) => setTemplate(e.target.value as Template)}>
            {(Object.entries(TEMPLATE_LABEL) as [Template, string][]).map(([t, l]) => (
              <option key={t} value={t}>{l}</option>
            ))}
          </Select>
        </label>
        <label className="block">
          <Label>Priced</Label>
          <Select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
            {(Object.keys(UNIT_LABEL) as Unit[]).map((u) => (
              <option key={u} value={u}>{UNIT_LABEL[u]}</option>
            ))}
          </Select>
        </label>
        <Button variant="primary" onClick={add} disabled={pending || name.trim().length < 2}>+ Add</Button>
      </div>
      <div className="px-4 pb-3"><ErrorText>{error}</ErrorText></div>
    </div>
  );
}
