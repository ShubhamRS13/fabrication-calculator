"use client";

import { useMemo, useState, useTransition } from "react";
import { deleteSectionSizeAction, upsertSectionSizeAction } from "@/app/actions";
import { SERIES_INFO } from "@/lib/calc/data/sections";
import { bySize, kindOf, type SectionKind } from "@/lib/calc/sections-lib";
import { parseNum } from "@/lib/format";
import { Button, ErrorText, Input, Label, Select } from "./ui";

export interface SectionRowView {
  id: string;
  series: string;
  size: string;
  data: Record<string, number>;
  builtIn: boolean;
}

/** The numbers each kind of table holds, with their labels. */
const VALUE_FIELDS: Record<SectionKind, { key: string; label: string }[]> = {
  kgPerM: [{ key: "kgPerM", label: "kg/m (MS)" }],
  pipeSch: [{ key: "od", label: "OD mm" }, { key: "wall", label: "Wall mm" }],
  is1239: [{ key: "od", label: "OD mm" }, { key: "wall", label: "Wall mm" }],
  swg: [{ key: "thk", label: "Thickness mm" }],
};

const SIZE_HINT: Record<SectionKind, string> = {
  kgPerM: "e.g. 75x50x6 or 125",
  pipeSch: "e.g. 65 NB",
  is1239: "e.g. 65 NB",
  swg: "e.g. 12 SWG",
};

function seriesName(series: string) {
  if (SERIES_INFO[series]) return SERIES_INFO[series].name;
  const { kind, key } = kindOf(series);
  if (kind === "pipeSch") return `Pipe – SCH ${key}`;
  if (kind === "is1239") return `Pipe – IS 1239 ${({ L: "Light", M: "Medium", H: "Heavy" } as Record<string, string>)[key] ?? key}`;
  if (kind === "swg") return "SWG – wire gauge thickness";
  return `${series} (your series)`;
}

export function SectionTablesEditor({ rows }: { rows: SectionRowView[] }) {
  const [extraSeries, setExtraSeries] = useState<string[]>([]);
  const allSeries = useMemo(() => {
    const names = [...new Set([...rows.map((r) => r.series), ...extraSeries])];
    // Rolled sections first (IS 808 order), then pipes, then the rest.
    const rank = (s: string) => (SERIES_INFO[s] ? 0 : s.startsWith("PIPE-") ? 1 : s === "SWG" ? 2 : 3);
    return names.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  }, [rows, extraSeries]);
  const [series, setSeries] = useState(allSeries[0] ?? "ISA");
  const [newSeries, setNewSeries] = useState("");
  const kind = kindOf(series).kind;
  const list = rows.filter((r) => r.series === series).sort((a, b) => bySize(a.size, b.size));

  function addSeries() {
    const s = newSeries.trim().toUpperCase();
    if (!/^[A-Z0-9 _-]{1,40}$/.test(s) || s.startsWith("PIPE-") || s === "SWG") return;
    setExtraSeries((x) => (x.includes(s) ? x : [...x, s]));
    setSeries(s);
    setNewSeries("");
  }

  return (
    <div>
      <div className="grid gap-2 border-b border-line p-4">
        <label className="block">
          <Label hint={`${list.length} sizes`}>Series</Label>
          <Select value={series} onChange={(e) => setSeries(e.target.value)}>
            {allSeries.map((s) => (
              <option key={s} value={s}>{seriesName(s)}</option>
            ))}
          </Select>
        </label>
        <div className="flex items-end gap-2">
          <Input value={newSeries} onChange={(e) => setNewSeries(e.target.value)} placeholder="Start a new series, e.g. MC" aria-label="New series name" />
          <Button onClick={addSeries}>+ Series</Button>
        </div>
      </div>
      <div className="max-h-96 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="text-left text-muted">
              <th className="px-4 py-2 font-medium">Size</th>
              {VALUE_FIELDS[kind].map((v) => (
                <th key={v.key} className="px-2 py-2 font-medium">{v.label}</th>
              ))}
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <SizeRow key={r.id} row={r} kind={kind} />
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted">No sizes yet — add the first one below.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <AddSize series={series} kind={kind} />
    </div>
  );
}

function SizeRow({ row, kind }: { row: SectionRowView; kind: SectionKind }) {
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(VALUE_FIELDS[kind].map((v) => [v.key, row.data[v.key]?.toString() ?? ""])),
  );
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function save() {
    const data: Record<string, number> = {};
    for (const v of VALUE_FIELDS[kind]) {
      const n = parseNum(vals[v.key]);
      if (n === null || Number.isNaN(n)) return setError(`${v.label} must be a number`);
      data[v.key] = n;
    }
    if (VALUE_FIELDS[kind].every((v) => data[v.key] === row.data[v.key])) return;
    start(async () => {
      const res = await upsertSectionSizeAction({ series: row.series, size: row.size, data });
      setError(res.ok ? undefined : res.error);
    });
  }

  function remove() {
    if (!confirm(`Delete ${row.series} ${row.size}? Items using it will show an error.`)) return;
    start(async () => {
      const res = await deleteSectionSizeAction(row.id);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <tr className="border-t border-line">
      <td className="px-4 py-1.5 font-medium tabular-nums">
        {row.size}
        {!row.builtIn && <span className="ml-1.5 rounded bg-accent/10 px-1 text-[10px] font-semibold text-accent">YOURS</span>}
        <ErrorText>{error}</ErrorText>
      </td>
      {VALUE_FIELDS[kind].map((v) => (
        <td key={v.key} className="px-2 py-1.5">
          <Input
            value={vals[v.key]}
            onChange={(e) => setVals((s) => ({ ...s, [v.key]: e.target.value }))}
            onBlur={save}
            inputMode="decimal"
            aria-label={`${row.size} ${v.label}`}
            className="h-9 w-24"
          />
        </td>
      ))}
      <td className="px-4 py-1.5 text-right">
        {!row.builtIn && (
          <Button variant="ghost" onClick={remove} disabled={pending} className="h-8 px-2 text-danger">Delete</Button>
        )}
      </td>
    </tr>
  );
}

function AddSize({ series, kind }: { series: string; kind: SectionKind }) {
  const [size, setSize] = useState("");
  const [vals, setVals] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function add() {
    if (!size.trim()) return setError("Size is required");
    const data: Record<string, number> = {};
    for (const v of VALUE_FIELDS[kind]) {
      const n = parseNum(vals[v.key] ?? "");
      if (n === null || Number.isNaN(n)) return setError(`${v.label} is required`);
      data[v.key] = n;
    }
    start(async () => {
      const res = await upsertSectionSizeAction({ series, size: size.trim(), data });
      if (!res.ok) return setError(res.error);
      setError(undefined);
      setSize("");
      setVals({});
    });
  }

  return (
    <div className="border-t border-line px-4 py-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <Label>New size</Label>
          <Input value={size} onChange={(e) => setSize(e.target.value)} placeholder={SIZE_HINT[kind]} className="w-36" />
        </label>
        {VALUE_FIELDS[kind].map((v) => (
          <label key={v.key} className="block">
            <Label>{v.label}</Label>
            <Input value={vals[v.key] ?? ""} onChange={(e) => setVals((s) => ({ ...s, [v.key]: e.target.value }))} inputMode="decimal" className="w-24" />
          </label>
        ))}
        <Button variant="primary" onClick={add} disabled={pending}>+ Add size</Button>
      </div>
      <ErrorText>{error}</ErrorText>
      <p className="mt-2 text-xs text-muted">
        Changing a value updates every costing that uses that size. Rolled sections are entered as MS kg/m; other materials are scaled by density.
      </p>
    </div>
  );
}
