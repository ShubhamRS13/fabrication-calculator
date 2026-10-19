"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  addCustomShapeAction, deleteCustomShapeAction, updateSettingsAction, upsertMaterialAction,
} from "@/app/actions";
import { makeCustomItemType, validateCustomShape, type CustomShapeDef } from "@/lib/calc/custom";
import type { Material } from "@/lib/calc/types";
import { kg, parseNum } from "@/lib/format";
import { Button, ErrorText, Input, Label, Select } from "./ui";

export function CompanyForm({ initial }: { initial: { companyName: string; address: string; email: string; phone: string } }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  function submit(fd: FormData) {
    const s = (k: string) => String(fd.get(k) ?? "").trim();
    setSaved(false);
    start(async () => {
      const res = await updateSettingsAction({ companyName: s("companyName"), address: s("address"), email: s("email"), phone: s("phone") });
      setError(res.ok ? undefined : res.error);
      setSaved(res.ok);
    });
  }

  return (
    <form action={submit} className="grid gap-3 p-4 sm:grid-cols-2">
      <label className="block sm:col-span-2"><Label>Company name</Label><Input name="companyName" defaultValue={initial.companyName} required /></label>
      <label className="block sm:col-span-2"><Label>Office address</Label><Input name="address" defaultValue={initial.address} /></label>
      <label className="block"><Label>Email</Label><Input name="email" type="email" defaultValue={initial.email} /></label>
      <label className="block"><Label>Mobile</Label><Input name="phone" defaultValue={initial.phone} /></label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" variant="primary" disabled={pending}>Save company details</Button>
        {saved && !pending && <span className="text-sm text-ok">Saved</span>}
        <ErrorText>{error}</ErrorText>
      </div>
    </form>
  );
}

export function MaterialsEditor({ materials }: { materials: Material[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const form = useRef<HTMLFormElement>(null);

  function saveDensity(m: Material, value: string) {
    const d = parseNum(value);
    if (d === null || Number.isNaN(d) || d <= 0) return setError(`${m.code}: density must be more than 0`);
    if (d === m.density) return;
    start(async () => {
      const res = await upsertMaterialAction({ code: m.code, density: d, family: m.family });
      setError(res.ok ? undefined : res.error);
    });
  }

  function add(fd: FormData) {
    const d = parseNum(String(fd.get("density") ?? ""));
    if (d === null || Number.isNaN(d)) return setError("Density must be a number");
    start(async () => {
      const res = await upsertMaterialAction({
        code: String(fd.get("code") ?? "").trim().toUpperCase(),
        density: d,
        family: String(fd.get("family")) as Material["family"],
      });
      if (!res.ok) return setError(res.error);
      setError(undefined);
      form.current?.reset();
    });
  }

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted">
            <th className="px-4 py-2 font-medium">Material</th>
            <th className="px-2 py-2 font-medium">Group</th>
            <th className="px-2 py-2 pr-4 font-medium">Density g/cc</th>
          </tr>
        </thead>
        <tbody>
          {materials.map((m) => (
            <tr key={m.code} className="border-t border-line">
              <td className="px-4 py-2 font-medium">{m.code}</td>
              <td className="px-2 py-2 text-muted">{m.family}</td>
              <td className="px-2 py-2 pr-4">
                <Input defaultValue={String(m.density)} inputMode="decimal" onBlur={(e) => saveDensity(m, e.target.value)} aria-label={`${m.code} density`} className="w-24" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form ref={form} action={add} className="grid grid-cols-[1fr_1fr_auto] gap-2 border-t border-line px-4 py-3 sm:grid-cols-[1fr_7rem_6rem_auto]">
        <Input name="code" required placeholder="e.g. AL6061" aria-label="New material code" className="col-span-3 sm:col-span-1" />
        <Select name="family" defaultValue="OTHER" aria-label="Group">
          <option value="SS">SS</option>
          <option value="MS">MS</option>
          <option value="OTHER">Other</option>
        </Select>
        <Input name="density" required inputMode="decimal" placeholder="g/cc" aria-label="Density g/cc" />
        <Button type="submit" disabled={pending}>+ Add</Button>
      </form>
      <div className="px-4 pb-3"><ErrorText>{error}</ErrorText></div>
    </div>
  );
}

/** "OD, ID, THK" → inputs. A key may carry a unit: "ANG:deg". */
function parseInputs(text: string): CustomShapeDef["inputs"] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [key, unit] = s.split(":").map((x) => x.trim());
      return { key, label: key, unit: unit === "deg" ? "deg" : "mm" };
    });
}

export function CustomShapeForm() {
  const [name, setName] = useState("");
  const [inputsText, setInputsText] = useState("OD, ID, THK");
  const [finish, setFinish] = useState("PI*(OD^2-ID^2)/4*THK*density/1e6");
  const [process, setProcess] = useState("OD*OD*THK*density/1e6");
  const [test, setTest] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const def: CustomShapeDef = useMemo(
    () => ({ id: "preview", name: name || "Preview", inputs: parseInputs(inputsText), finishFormula: finish, processFormula: process || undefined }),
    [name, inputsText, finish, process],
  );
  const problems = useMemo(() => validateCustomShape(def), [def]);
  const preview = useMemo(() => {
    if (problems.length) return null;
    try {
      const t = makeCustomItemType(def);
      const inputs = Object.fromEntries(def.inputs.map((i) => [i.key, Number(test[i.key] ?? "")]));
      if (def.inputs.some((i) => !test[i.key])) return { hint: "Enter test values to try the formula (density 8)" };
      const r = t.compute(inputs, { density: 8 });
      return { r };
    } catch (e) {
      return { hint: (e as Error).message };
    }
  }, [def, problems, test]);

  function save() {
    if (!name.trim()) return setError("Name is required");
    if (problems.length) return setError(problems[0]);
    start(async () => {
      const res = await addCustomShapeAction({ name: name.trim(), inputs: def.inputs, finishFormula: finish, processFormula: process || null });
      if (!res.ok) return setError(res.error);
      setError(undefined);
      setName("");
    });
  }

  return (
    <div className="grid gap-3 p-4">
      <label className="block"><Label>Shape name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ring with holes" /></label>
      <label className="block">
        <Label hint="comma separated; add :deg for angles">Input names</Label>
        <Input value={inputsText} onChange={(e) => setInputsText(e.target.value)} className="font-mono" />
      </label>
      <label className="block">
        <Label hint="kg per piece; use PI, density, sqrt, sin…">Finish weight formula</Label>
        <Input value={finish} onChange={(e) => setFinish(e.target.value)} className="font-mono" />
      </label>
      <label className="block">
        <Label hint="optional; defaults to finish">Process weight formula</Label>
        <Input value={process} onChange={(e) => setProcess(e.target.value)} className="font-mono" />
      </label>
      {problems.length > 0 ? (
        <ErrorText>{problems[0]}</ErrorText>
      ) : (
        <div className="rounded-lg bg-paper p-3">
          <p className="mb-2 text-sm font-medium">Try it</p>
          <div className="grid grid-cols-3 gap-2">
            {def.inputs.map((i) => (
              <label key={i.key} className="block">
                <Label>{i.key}</Label>
                <Input inputMode="decimal" value={test[i.key] ?? ""} onChange={(e) => setTest((t) => ({ ...t, [i.key]: e.target.value }))} />
              </label>
            ))}
          </div>
          {preview?.r ? (
            <p className="mt-2 text-sm tabular-nums">Finish {kg(preview.r.finishWt)} kg · Process {kg(preview.r.processWt)} kg</p>
          ) : (
            <p className="mt-2 text-sm text-muted">{preview?.hint}</p>
          )}
        </div>
      )}
      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={save} disabled={pending}>Save shape</Button>
        <ErrorText>{error}</ErrorText>
      </div>
    </div>
  );
}

export function DeleteShapeButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      className="h-8 px-2 text-danger"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Delete custom shape “${name}”?`)) return;
        start(async () => {
          const res = await deleteCustomShapeAction(id);
          if (!res.ok) alert(res.error);
        });
      }}
    >
      Delete
    </Button>
  );
}
