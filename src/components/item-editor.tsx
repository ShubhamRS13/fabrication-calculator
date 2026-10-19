"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { addItemAction, deleteItemAction, updateItemAction } from "@/app/actions";
import type { CustomShapeDef } from "@/lib/calc/custom";
import { buildRegistry } from "@/lib/calc/registry";
import type { FieldDef, InputValue, ItemCategory, ItemResult, ItemType, Material } from "@/lib/calc/types";
import { inr, kg, num, parseNum } from "@/lib/format";
import { nextItemNo } from "@/lib/item-no";
import { devLabel } from "@/lib/dev-labels";
import type { SectionLibrary } from "@/lib/calc/sections-lib";
import { ReferenceDiagram, TypeTile, hasDiagram } from "./diagrams";
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
  itemNo: string;
  type: string;
  name: string;
  dwgSheet: string;
  qty: number;
  material: string | null;
  assemblyId: string | null;
  inputs: Record<string, InputValue>;
}

/** Options of a select field, which may depend on other values and the section library. */
const selectOptions = (f: FieldDef, values: Values, lib: SectionLibrary) =>
  f.dependentOptions?.(values as Record<string, InputValue>, lib) ?? f.options ?? [];

/**
 * Keep dependent selects valid: when a choice changes (e.g. series), any later
 * select whose value is no longer offered (e.g. size) takes its first option.
 */
const shown = (f: FieldDef, values: Values, lib: SectionLibrary) =>
  !f.showIf || f.showIf(values as Record<string, InputValue>, lib);

function reconcile(t: ItemType, values: Values, lib: SectionLibrary): Values {
  const v = { ...values };
  for (const f of t.fields) {
    // Hidden fields may share a key with a visible one (e.g. "rating"); leave them alone.
    if (f.kind !== "select" || !shown(f, v, lib)) continue;
    const options = selectOptions(f, v, lib);
    if (options.length && !options.some((o) => o.value === v[f.key])) v[f.key] = options[0].value;
  }
  return v;
}

function initialValues(t: ItemType, lib: SectionLibrary, inputs: Record<string, InputValue> = {}): Values {
  const v: Values = {};
  for (const f of t.fields) {
    const x = inputs[f.key] ?? f.default;
    if (f.kind === "boolean") v[f.key] = x === true || x === "true";
    else if (x !== undefined) v[f.key] = String(x);
    else v[f.key] = "";
  }
  return reconcile(t, v, lib);
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
  /** Every item already on the drawing, for suggesting the next item number. */
  siblings: { id: string; itemNo: string; assemblyId: string | null }[];
  /** Section & pipe tables from Settings. */
  sectionLib: SectionLibrary;
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
  siblings,
  sectionLib,
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
  const [values, setValues] = useState<Values>(() => (type ? initialValues(type, sectionLib, item?.inputs) : {}));

  // ---------- item number: restarts per assembly, always editable ----------
  // Items saved with "Save & add another" count too, so the next suggestion moves on.
  const [savedHere, setSavedHere] = useState<{ itemNo: string; assemblyId: string }[]>([]);
  const numbersIn = (asmId: string) => [
    ...siblings.filter((x) => (x.assemblyId ?? "") === asmId && x.id !== item?.id).map((x) => x.itemNo),
    ...savedHere.filter((x) => x.assemblyId === asmId).map((x) => x.itemNo),
  ];
  const [itemNo, setItemNo] = useState(() => item?.itemNo || nextItemNo(numbersIn(item?.assemblyId ?? "")));
  const [itemNoTyped, setItemNoTyped] = useState(false);
  const itemNoTaken = numbersIn(assemblyId).some((n) => n.trim().toLowerCase() === itemNo.trim().toLowerCase() && n.trim() !== "");

  function changeAssembly(id: string) {
    setAssemblyId(id);
    if (itemNoTyped) return;
    // Back in its original group the item keeps its number; elsewhere it takes the next free one.
    setItemNo(item && id === (item.assemblyId ?? "") ? item.itemNo : nextItemNo(numbersIn(id)));
  }
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function pickType(t: ItemType) {
    setTypeId(t.id);
    setValues(initialValues(t, sectionLib));
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
      return { inputs, result: type.compute(inputs, { density: density ?? 0, lib: sectionLib }) as ItemResult };
    } catch (e) {
      return { inputs, error: (e as Error).message };
    }
  }, [type, values, density, effMaterial, sectionLib]);

  const priceName = type && live && !live.error ? type.priceRef?.(live.inputs, sectionLib)?.label : undefined;

  // ---------- save ----------
  function save(another: boolean) {
    if (!type || !live) return;
    if (qtyNum === null || Number.isNaN(qtyNum) || qtyNum <= 0) return setError("Quantity must be more than 0");
    if (!name.trim()) return setError("Name is required");
    if (live.error) return setError(live.error);
    const payload = {
      itemNo: itemNo.trim(),
      type: type.id,
      name: name.trim(),
      dwgSheet: dwgSheet.trim(),
      qty: qtyNum,
      material: material || null,
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
        const saved = { itemNo: payload.itemNo || nextItemNo(numbersIn(assemblyId)), assemblyId };
        setSavedHere((s) => [...s, saved]);
        setItemNo(nextItemNo([...numbersIn(assemblyId), saved.itemNo]));
        setItemNoTyped(false);
        setName("");
        setValues(initialValues(type, sectionLib));
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
          const types = [...registry.values()].filter((t) => t.category === cat.id && (!t.hidden || t.id === typeId));
          if (!types.length) return null;
          // Group by family (Cylinders, Cones, Vessel end caps…), keeping registry order.
          const families = [...new Set(types.map((t) => t.family ?? ""))];
          return (
            <Card key={cat.id}>
              <CardHeader title={cat.label} />
              {families.map((fam) => (
                <div key={fam} className="border-t border-line first:border-t-0">
                  {fam && <h3 className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-muted">{fam}</h3>}
                  <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
                    {types
                      .filter((t) => (t.family ?? "") === fam)
                      .map((t) => (
                        <button
                          key={t.id}
                          onClick={() => pickType(t)}
                          className="flex items-center gap-3 rounded-lg border border-line bg-white p-2.5 text-left hover:border-ink"
                        >
                          <TypeTile typeId={t.id} />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium leading-snug">{t.label}</span>
                            {t.description && <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{t.description}</span>}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </Card>
          );
        })}
      </div>
    );
  }

  const isBought = type.category === "bought";
  const r = live?.result;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_24rem] [&>*]:min-w-0">
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
            <div className="grid grid-cols-[6.5rem_1fr] gap-3 sm:col-span-2">
              <label className="block">
                <Label>Item no.</Label>
                <Input
                  value={itemNo}
                  onChange={(e) => {
                    setItemNo(e.target.value);
                    setItemNoTyped(true);
                  }}
                  placeholder="auto"
                  aria-describedby={itemNoTaken ? "item-no-taken" : undefined}
                />
              </label>
              <label className="block">
                <Label>Name on drawing *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. SHELL PLATE" autoFocus={!item} />
              </label>
              {itemNoTaken && (
                <p id="item-no-taken" className="col-span-2 -mt-1 text-sm text-accent">
                  No. {itemNo.trim()} is already used {assemblyId ? "in this assembly" : "on this drawing"}.
                </p>
              )}
            </div>
            <label className="block">
              <Label>Qty *</Label>
              <Input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
            </label>
            <label className="block">
              <Label>DWG sheet no.</Label>
              <Input value={dwgSheet} onChange={(e) => setDwgSheet(e.target.value)} />
            </label>
            {(
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
                <Select value={assemblyId} onChange={(e) => changeAssembly(e.target.value)}>
                  <option value="">None</option>
                  {assemblies.map((a) => <option key={a.id} value={a.id}>{a.name} × {num(a.qty)}</option>)}
                </Select>
              </label>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Sizes" sub="All lengths in mm; letters match the drawing" />
          {(hasDiagram(type.id) || type.description) && (
            <div className="grid items-center gap-3 border-b border-line p-4 sm:grid-cols-[15rem_1fr]">
              {hasDiagram(type.id) && (
                <div className="mx-auto w-full max-w-60 rounded-lg border border-line bg-white p-1">
                  <ReferenceDiagram typeId={type.id} />
                </div>
              )}
              {type.description && <p className="text-sm text-muted">{type.description}</p>}
            </div>
          )}
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {type.fields
              .filter((f) => shown(f, values, sectionLib))
              .map((f) => (
                <FieldInput key={f.key} field={f} values={values} lib={sectionLib} onChange={(v) => setValues((s) => reconcile(type, { ...s, [f.key]: v }, sectionLib))} />
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
          <CardHeader title="Result" sub={isBought ? `${effMaterial} · priced on the Rates page` : `${effMaterial} · density ${density ?? "?"} g/cc`} />
          <div className="px-4 py-2">
            {live?.error && <p className="py-2 text-sm text-muted">{live.error}</p>}
            {r && isBought && (
              <>
                {priceName && <Stat label="Priced as" value={priceName} />}
                <Stat label="Quantity" value={num(multiplier)} />
                {r.fixedCost > 0 && <Stat label="Rate on this item (older entry)" value={inr(r.fixedCost)} />}
                <p className="py-2 text-xs text-muted">
                  The same item, size and material on any drawing shares one rate, entered on the costing&apos;s Rates page. Price only — no weight is added.
                </p>
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
          {type.formulaText && (
            <details className="border-t border-line">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Formula</summary>
              <div className="px-4 pb-4">
                {hasDiagram(type.id) && (
                  <div className="mx-auto mb-2 max-w-52">
                    <ReferenceDiagram typeId={type.id} />
                  </div>
                )}
                <ul className="space-y-1 font-mono text-xs leading-relaxed">
                  {type.formulaText.map((line) => <li key={line}>{line}</li>)}
                </ul>
                <p className="mt-2 text-xs text-muted">t = thickness, ρ = density (g/cc). Weights in kg, lengths in mm.</p>
              </div>
            </details>
          )}
          {r && (
            <details className="border-t border-line">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Show calculation</summary>
              <pre className="overflow-x-auto whitespace-pre-wrap px-4 pb-4 font-mono text-xs leading-relaxed text-ink">{r.formula}</pre>
            </details>
          )}
        </Card>
        {r?.dev && !isBought && (
          <Card>
            <CardHeader title="Development" sub="Flat pattern; dashed frame = ideal sheet, mm" />
            <div className="p-3">
              <DevelopmentSketch dev={r.dev} />
            </div>
            {r.markTable && <MarkTableView table={r.markTable} />}
          </Card>
        )}
        {r?.mass && !isBought && <MassCard r={r} multiplier={multiplier} />}
      </div>
    </div>
  );
}

/** Plate'n'Sheets-style mass report: the sheet rectangle vs the actual shape. */
function MassCard({ r, multiplier }: { r: ItemResult; multiplier: number }) {
  const m = r.mass!;
  const rows: [string, (x: typeof m.frame) => string][] = [
    ["Area m²", (x) => num(x.area * multiplier)],
    ["Perimeter mm", (x) => num(x.perimeter * multiplier)],
    ["Mass kg", (x) => kg(x.mass * multiplier)],
  ];
  return (
    <Card>
      <CardHeader title="Mass report" sub={`For ${num(multiplier)} piece${multiplier === 1 ? "" : "s"}; perimeter = cutting length`} />
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-right text-muted">
            <th className="px-4 py-2 text-left font-medium"></th>
            <th className="px-2 py-2 font-medium">Single rectangle</th>
            <th className="px-4 py-2 font-medium">Actual shape</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, get]) => (
            <tr key={label} className="border-t border-line text-right">
              <td className="px-4 py-1.5 text-left text-muted">{label}</td>
              <td className="px-2 py-1.5">{get(m.frame)}</td>
              <td className="px-4 py-1.5">{get(m.actual)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {m.pieces.length > 1 && (
        <ul className="border-t border-line px-4 py-2 text-xs text-muted">
          {m.pieces.map((p) => (
            <li key={p.name}>
              {p.name} × {p.count}: frame {num(p.frameW)} × {num(p.frameH)}, {kg(p.actual.mass / p.count)} kg each
            </li>
          ))}
        </ul>
      )}
      {r.surfaceArea !== undefined && (
        <p className="border-t border-line px-4 py-2 text-xs text-muted">True surface of the formed part: {num(r.surfaceArea / 1e6)} m² per piece.</p>
      )}
    </Card>
  );
}

function MarkTableView({ table }: { table: NonNullable<ItemResult["markTable"]> }) {
  return (
    <details className="border-t border-line">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">{table.title}</summary>
      <div className="max-h-72 overflow-auto px-2 pb-3">
        <table className="w-full text-xs tabular-nums">
          <thead className="sticky top-0 bg-white">
            <tr className="text-right text-muted">
              {table.columns.map((c) => <th key={c} className="px-2 py-1 font-medium">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i} className="border-t border-line text-right">
                {row.map((v, j) => <td key={j} className="px-2 py-1">{j === 0 ? v : num(v)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

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

function FieldInput({ field: f, values, lib, onChange }: { field: FieldDef; values: Values; lib: SectionLibrary; onChange: (v: string | boolean) => void }) {
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
    const options = selectOptions(f, values, lib);
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
