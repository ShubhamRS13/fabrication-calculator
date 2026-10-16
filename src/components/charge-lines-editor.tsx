"use client";

import { useState, useTransition } from "react";
import { addChargeLineAction, deleteChargeLineAction, updateChargeLineAction } from "@/app/actions";
import { parseNum } from "@/lib/format";
import { Button, ErrorText, Input, Select } from "./ui";

interface Line {
  id: string;
  name: string;
  rate: number | null;
  basis: "process" | "finish";
  appliesTo: string;
}

function appliesOptions(materials: string[]) {
  return [
    { value: "ALL", label: "All materials" },
    { value: "SS", label: "SS only" },
    { value: "MS", label: "MS only" },
    ...materials.map((m) => ({ value: `MAT:${m}`, label: `${m} only` })),
  ];
}

/** Every extra charge is name + ₹/kg on process or finish weight, for chosen materials. */
export function ChargeLinesEditor({ costingId, lines, materials }: { costingId: string; lines: Line[]; materials: string[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const options = appliesOptions(materials);

  const add = () =>
    start(async () => {
      const res = await addChargeLineAction(costingId, { name: "New charge", rate: null, basis: "finish", appliesTo: "ALL" });
      setError(res.ok ? undefined : res.error);
    });

  return (
    <div>
      <ul className="divide-y divide-line">
        {lines.map((l) => (
          <LineRow key={l.id} costingId={costingId} line={l} options={options} />
        ))}
      </ul>
      <div className="flex items-center gap-3 border-t border-line px-4 py-3">
        <Button onClick={add} disabled={pending}>+ Add charge line</Button>
        <ErrorText>{error}</ErrorText>
      </div>
    </div>
  );
}

function LineRow({ costingId, line, options }: { costingId: string; line: Line; options: { value: string; label: string }[] }) {
  const [name, setName] = useState(line.name);
  const [rate, setRate] = useState(line.rate?.toString() ?? "");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function save(patch: Partial<Omit<Line, "id">>) {
    setError(undefined);
    start(async () => {
      const res = await updateChargeLineAction(costingId, line.id, patch);
      if (!res.ok) setError(res.error);
    });
  }

  function saveRate() {
    const r = parseNum(rate);
    if (Number.isNaN(r)) return setError("Rate must be a number");
    if (r !== line.rate) save({ rate: r });
  }

  function remove() {
    if (!confirm(`Remove charge line “${line.name}”?`)) return;
    start(async () => {
      const res = await deleteChargeLineAction(costingId, line.id);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <li className="grid grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-[1fr_7rem_9rem_10rem_auto] sm:items-center">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name !== line.name && save({ name: name.trim() })}
        aria-label="Charge name"
        className="col-span-2 sm:col-span-1"
      />
      <Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} onBlur={saveRate} placeholder="₹/kg" aria-label="Rate ₹/kg" />
      <Select defaultValue={line.basis} onChange={(e) => save({ basis: e.target.value as Line["basis"] })} aria-label="Weight basis">
        <option value="finish">Finish wt</option>
        <option value="process">Process wt</option>
      </Select>
      <Select defaultValue={line.appliesTo} onChange={(e) => save({ appliesTo: e.target.value })} aria-label="Applies to">
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
      <Button variant="ghost" onClick={remove} disabled={pending} aria-label={`Remove ${line.name}`} className="text-danger">
        Remove
      </Button>
      {error && <div className="col-span-2 sm:col-span-5"><ErrorText>{error}</ErrorText></div>}
    </li>
  );
}
