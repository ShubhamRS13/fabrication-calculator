"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { addItemAction, deleteItemAction, updateItemAction } from "@/app/actions";
import type { CustomShapeDef } from "@/lib/calc/custom";
import { buildRegistry } from "@/lib/calc/registry";
import type { FieldDef, InputValue, ItemCategory, ItemResult, ItemType, Material } from "@/lib/calc/types";
import { inr, kg, num, parseNum } from "@/lib/format";
import { DevelopmentSketch } from "./sketch";
import { Button, Card, CardHeader, cx, ErrorText, Input, Label, Select, Stat } from "./ui";

const CATEGORIES: { id: ItemCategory; label: string }[] = [
  { id: "fabricated", label: "Fabricated from sheet / plate" },
  { id: "section", label: "Sections & pipes" },
  { id: "outsourced", label: "Outsourced" },
  { id: "bought", label: "Bought items" },
  { id: "custom", label: "Your custom shapes" },
];

type Values = Record<string, string | boolean>;

export interface EditorItem {
  id: string;
  type: string;
  name: string;
  dwgSheet: string;
  qty: number;
  material: string | null;
  assemblyId: string | null;
  inputs: Record<string, InputValue>;
}

function initialValues(t: ItemType, inputs: Record<string, InputValue> = {}): Values {
  const v: Values = {};
  for (const f of t.fields) {
    const x = inputs[f.key] ?? f.default;
    if (f.kind === "boolean") v[f.key] = x === true || x === "true";
    else if (x !== undefined) v[f.key] = String(x);
    else if (f.kind === "select" && f.options?.length) v[f.key] = f.options[0].value;
    else v[f.key] = "";
  }
  return v;
}

/** Turn form values into engine inputs. Returns the fields that are not valid numbers. */
function toInputs(t: ItemType, values: Values) {
  const inputs: Record<string, number | string | boolean> = {};
  const bad: string[] = [];
  for (const f of t.fields) {
    const v = values[f.key];
    if (f.kind === "boolean") inputs[f.key] = v === true;
    else if (f.kind === "number") {
      const n = parseNum(String(v ?? ""));
      if (n === null) continue;
      if (Number.isNaN(n)) bad.push(f.label);
      else inputs[f.key] = n;
    } else if (v !== "" && v !== undefined) inputs[f.key] = String(v);
  }
  return { inputs, bad };
}

interface ItemEditorProps {
  costingId: string;
  backHref: string;
  drawingId: string;
  materials: Material[];
  defaultMaterial: string;
  assemblies: { id: string; name: string; qty: number; material: string | null }[];
  customShapes: CustomShapeDef[];
  item?: EditorItem;
  initialType?: string;
}

/**
 * Next.js keeps pages you leave alive (React <Activity>), so without a reset the
 * editor would reopen with the previous item's type and sizes. Keying on
 * bfcacheId starts a fresh form on every "+ Add item" / "Edit" link, while the
 * browser's Back button still restores a half-filled form.
 */
export function ItemEditor(props: ItemEditorProps) {
  const { bfcacheId } = useRouter();
  return <ItemEditorForm key={bfcacheId} {...props} />;
}

function ItemEditorForm({
  costingId,
  backHref,
  drawingId,
  materials,
  defaultMaterial,
  assemblies,
  customShapes,
  item,
  initialType,
}: ItemEditorProps) {
  const router = useRouter();
  const registry = useMemo(() => buildRegistry(customShapes), [customShapes]);
  const [typeId, setTypeId] = useState<string | undefined>(() => {
    const t = item?.type ?? initialType;
    return t && registry.has(t) ? t : undefined;
  });
  const type = typeId ? registry.get(typeId) : undefined;

  const [name, setName] = useState(item?.name ?? "");
  const [dwgSheet, setDwgSheet] = useState(item?.dwgSheet ?? "");
  const [qty, setQty] = useState(String(item?.qty ?? 1));
  const [material, setMaterial] = useState(item?.material ?? "");
  const [assemblyId, setAssemblyId] = useState(item?.assemblyId ?? "");
  const [values, setValues] = useState<Values>(() => (type ? initialValues(type, item?.inputs) : {}));
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function pickType(t: ItemType) {
    setTypeId(t.id);
    setValues(initialValues(t));
    if (!name || !item) setName(t.category === "custom" ? t.label : "");
    setError(undefined);
  }

  // ---------- live result ----------
  const asm = assemblies.find((a) => a.id === assemblyId);
  const effMaterial = material || asm?.material || defaultMaterial;
  const density = materials.find((m) => m.code === effMaterial)?.density;
  const qtyNum = parseNum(qty);
  const multiplier = (qtyNum && qtyNum > 0 ? qtyNum : 0) * (asm?.qty ?? 1);

  const live = useMemo(() => {
    if (!type) return null;
    const { inputs, bad } = toInputs(type, values);
    if (bad.length) return { inputs, error: `${bad.join(", ")} must be a number` };
    if (density === undefined && type.category !== "bought") return { inputs, error: `Unknown material ${effMaterial}` };
    try {
      return { inputs, result: type.compute(inputs, { density: density ?? 0 }) as ItemResult };
    } catch (e) {
      return { inputs, error: (e as Error).message };
    }
  }, [type, values, density, effMaterial]);

  // ---------- save ----------
  function save(another: boolean) {
    if (!type || !live) return;
    if (qtyNum === null || Number.isNaN(qtyNum) || qtyNum <= 0) return setError("Quantity must be more than 0");
    if (!name.trim()) return setError("Name is required");
    if (live.error) return setError(live.error);
    const payload = {
      type: type.id,
      name: name.trim(),
      dwgSheet: dwgSheet.trim(),
      qty: qtyNum,
      material: type.category === "bought" ? null : material || null,
      assemblyId: assemblyId || null,
      inputs: live.inputs,
    };
    setError(undefined);
    start(async () => {
      const res = item
        ? await updateItemAction(costingId, item.id, payload)
        : await addItemAction(costingId, drawingId, payload);
      if (!res.ok) return setError(res.error);
      if (another) {
        setName("");
        setValues(initialValues(type));
        setQty("1");
        window.scrollTo({ top: 0 });
      } else {
        router.push(backHref);
      }
    });
  }

  function remove() {
    if (!item || !confirm(`Delete “${item.name}”?`)) return;
    start(async () => {
      const res = await deleteItemAction(costingId, item.id);
      if (res.ok) router.push(backHref);
      else setError(res.error);
    });
  }

  // ---------- type picker ----------
  if (!type) {
    return (
      <div className="space-y-4">
        {CATEGORIES.map((cat) => {
          const types = [...registry.values()].filter((t) => t.category === cat.id);
          if (!types.length) return null;
          return (
            <Card key={cat.id}>
              <CardHeader title={cat.label} />
              <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
                {types.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => pickType(t)}
                    className="rounded-lg border border-line bg-white px-3 py-3 text-left text-sm font-medium hover:border-ink"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    );
  }

  const isBought = type.category === "bought";
  const r = live?.result;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
      <div className="space-y-4">
        <Card>
          <CardHeader
            title={type.label}
            action={
              <Button variant="ghost" className="h-8 px-2" onClick={() => setTypeId(undefined)}>
                Change type
              </Button>
            }
          />
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <Label>Name on drawing *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. SHELL PLATE" autoFocus={!item} />
            </label>
            <label className="block">
              <Label>Qty *</Label>
              <Input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
            </label>
            <label className="block">
              <Label>DWG sheet no.</Label>
              <Input value={dwgSheet} onChange={(e) => setDwgSheet(e.target.value)} />
            </label>
            {!isBought && (
              <label className="block">
                <Label>Material</Label>
                <Select value={material} onChange={(e) => setMaterial(e.target.value)}>
                  <option value="">Default ({asm?.material ?? defaultMaterial})</option>
                  {materials.map((m) => <option key={m.code}>{m.code}</option>)}
                </Select>
              </label>
            )}
            {assemblies.length > 0 && (
              <label className="block">
                <Label>Assembly</Label>
                <Select value={assemblyId} onChange={(e) => setAssemblyId(e.target.value)}>
                  <option value="">None</option>
                  {assemblies.map((a) => <option key={a.id} value={a.id}>{a.name} × {num(a.qty)}</option>)}
                </Select>
              </label>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Sizes" sub="All lengths in mm" />
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {type.fields.map((f) => (
              <FieldInput key={f.key} field={f} values={values} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />
            ))}
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={() => save(false)} disabled={pending}>{pending ? "Saving…" : "Save item"}</Button>
          {!item && <Button onClick={() => save(true)} disabled={pending}>Save & add another</Button>}
          <Button variant="ghost" onClick={() => router.push(backHref)} disabled={pending}>Cancel</Button>
          {item && <Button variant="danger" onClick={remove} disabled={pending} className="ml-auto">Delete item</Button>}
        </div>
        <ErrorText>{error}</ErrorText>
      </div>

      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardHeader title="Result" sub={isBought ? "Priced qty × rate" : `${effMaterial} · density ${density ?? "?"} g/cc`} />
          <div className="px-4 py-2">
            {live?.error && <p className="py-2 text-sm text-muted">{live.error}</p>}
            {r && isBought && (
              <>
                <Stat label="Price per piece" value={inr(r.fixedCost)} />
                <Stat label={`Total for ${num(multiplier)}`} value={inr(r.fixedCost * multiplier)} strong />
                {r.finishWt > 0 && <Stat label="Weight (info only)" value={`${kg(r.finishWt * multiplier)} kg`} />}
              </>
            )}
            {r && !isBought && (
              <>
                <ResultTable r={r} multiplier={multiplier} />
                {r.sheetL !== undefined && r.sheetW !== undefined && <Stat label="Ideal sheet L × W" value={`${num(r.sheetL)} × ${num(r.sheetW)}`} />}
                {r.kgPerM !== undefined && <Stat label="kg/m" value={num(r.kgPerM)} />}
                {r.development &&
                  Object.entries(r.development).map(([k, v]) => <Stat key={k} label={devLabel(k)} value={k === "theta" ? `${num(v)}°` : num(v)} />)}
                {r.fixedCost > 0 && <Stat label="Job work" value={`${inr(r.fixedCost)} × ${num(multiplier)} = ${inr(r.fixedCost * multiplier)}`} />}
              </>
            )}
          </div>
          {r && (
            <details className="border-t border-line">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Show formula</summary>
              <pre className="overflow-x-auto whitespace-pre-wrap px-4 pb-4 font-mono text-xs leading-relaxed text-ink">{r.formula}</pre>
            </details>
          )}
        </Card>
        {r && !isBought && (
          <SketchCard typeId={type.id} result={r} inputs={live?.inputs ?? {}} />
        )}
      </div>
    </div>
  );
}

function SketchCard(props: { typeId: string; result: ItemResult; inputs: Record<string, unknown> }) {
  const sketch = DevelopmentSketch(props);
  if (!sketch) return null;
  return (
    <Card>
      <CardHeader title="Development" sub="Marking dimensions in mm" />
      <div className="p-3">{sketch}</div>
    </Card>
  );
}

const DEV_LABELS: Record<string, string> = {
  Dm: "Mean dia Dm", Dm1: "Mean dia Dm1", Dm2: "Mean dia Dm2", length: "Development length", height: "Height",
  slant: "Slant length", R1: "R1 (outer radius)", R2: "R2 (inner radius)", theta: "Angle θ", chord: "Chord",
  blankDia: "Blank dia", OD: "OD", ID: "ID", PCD: "PCD",
};
const devLabel = (k: string) => DEV_LABELS[k] ?? k;

function ResultTable({ r, multiplier }: { r: ItemResult; multiplier: number }) {
  const rows: [string, number][] = [
    ["Finish wt", r.finishWt],
    ["Process wt", r.processWt],
    ["Scrap", r.scrap],
  ];
  return (
    <table className="mb-1 w-full text-sm tabular-nums">
      <thead>
        <tr className="text-right text-muted">
          <th className="py-1.5 text-left font-medium">kg</th>
          <th className="py-1.5 font-medium">per piece</th>
          <th className="py-1.5 font-medium">× {num(multiplier)}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, v]) => (
          <tr key={label} className="border-t border-line text-right">
            <td className="py-1.5 text-left text-muted">{label}</td>
            <td className="py-1.5">{kg(v)}</td>
            <td className={cx("py-1.5", label === "Process wt" && "font-semibold")}>{kg(v * multiplier)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FieldInput({ field: f, values, onChange }: { field: FieldDef; values: Values; onChange: (v: string | boolean) => void }) {
  const v = values[f.key];
  const unit = f.unit && f.unit !== "nos" ? f.unit : undefined;
  const hint = [unit, f.optional ? "optional" : undefined].filter(Boolean).join(" · ");

  if (f.kind === "boolean") {
    return (
      <label className="flex h-10 items-center gap-2 self-end text-sm">
        <input type="checkbox" checked={v === true} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-ink" />
        {f.label}
      </label>
    );
  }
  if (f.kind === "diaRef") {
    return (
      <div>
        <Label>{f.label}</Label>
        <div className="grid h-10 grid-cols-2 rounded-lg border border-line bg-white p-0.5" role="radiogroup" aria-label={f.label}>
          {["OD", "ID"].map((o) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={v === o}
              onClick={() => onChange(o)}
              className={cx("rounded-md text-sm font-medium", v === o ? "bg-ink text-white" : "text-muted")}
            >
              {o}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (f.kind === "select") {
    const options = f.dependentOptions?.(values as Record<string, InputValue>) ?? f.options ?? [];
    const current = String(v ?? "");
    const valid = options.some((o) => o.value === current);
    return (
      <label className="block">
        <Label hint={hint}>{f.label}</Label>
        <Select value={valid ? current : ""} onChange={(e) => onChange(e.target.value)}>
          {!valid && <option value="">Choose…</option>}
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </label>
    );
  }
  return (
    <label className="block">
      <Label hint={hint}>{f.label}</Label>
      <Input
        value={String(v ?? "")}
        onChange={(e) => onChange(e.target.value)}
        inputMode={f.kind === "number" ? "decimal" : undefined}
        placeholder={f.help}
      />
    </label>
  );
}
