import { all, create, type EvalFunction } from "mathjs";
import { CalcError, type ItemType } from "./types";
import { f, num } from "./helpers";

/** A user-defined shape: named inputs + weight formulas (mm, g/cc → kg, per piece). */
export interface CustomShapeDef {
  id: string;
  name: string;
  inputs: { key: string; label: string; unit?: "mm" | "deg" }[];
  /** e.g. "PI*(OD^2-ID^2)/4*THK*density/1e6" */
  finishFormula: string;
  /** Optional; defaults to the finish weight. */
  processFormula?: string;
}

const math = create(all, {});
// Capture the parser before the functions below are disabled for formula authors.
const parse = math.parse;
// Lock down the parser (math.js security guidance): no defining or importing.
const blocked = () => {
  throw new Error("Function disabled");
};
math.import(
  {
    import: blocked,
    createUnit: blocked,
    evaluate: blocked,
    parse: blocked,
    simplify: blocked,
    derivative: blocked,
    resolve: blocked,
    reviver: blocked,
  },
  { override: true },
);

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RESERVED = new Set(["PI", "pi", "density", "e"]);

function compileFormula(expr: string, allowed: Set<string>): EvalFunction {
  let node;
  try {
    node = parse(expr);
  } catch (err) {
    throw new CalcError(`Formula error: ${(err as Error).message}`);
  }
  // Reject assignments, function definitions and unknown symbols.
  node.traverse((n, _path, parent) => {
    if (n.type === "AssignmentNode" || n.type === "FunctionAssignmentNode" || n.type === "BlockNode") {
      throw new CalcError("Formula may not assign variables");
    }
    if (n.type === "SymbolNode") {
      const name = (n as unknown as { name: string }).name;
      const isFnName = parent?.type === "FunctionNode" && (parent as unknown as { fn: unknown }).fn === n;
      if (!isFnName && !allowed.has(name)) throw new CalcError(`Unknown name "${name}" in formula`);
    }
  });
  return node.compile();
}

/** Check a definition; returns a list of problems (empty = valid). */
export function validateCustomShape(def: CustomShapeDef): string[] {
  const errors: string[] = [];
  const keys = new Set<string>();
  for (const i of def.inputs) {
    if (!IDENT.test(i.key)) errors.push(`Input name "${i.key}" must be letters, digits or _`);
    else if (RESERVED.has(i.key)) errors.push(`Input name "${i.key}" is reserved`);
    else if (keys.has(i.key)) errors.push(`Input name "${i.key}" is used twice`);
    keys.add(i.key);
  }
  const allowed = new Set([...keys, ...RESERVED]);
  for (const [label, expr] of [["Finish formula", def.finishFormula], ["Process formula", def.processFormula]] as const) {
    if (!expr) continue;
    try {
      compileFormula(expr, allowed);
    } catch (err) {
      errors.push(`${label}: ${(err as Error).message}`);
    }
  }
  if (!def.finishFormula?.trim()) errors.push("Finish formula is required");
  return errors;
}

export function makeCustomItemType(def: CustomShapeDef): ItemType {
  const allowed = new Set([...def.inputs.map((i) => i.key), ...RESERVED]);
  const finishFn = compileFormula(def.finishFormula, allowed);
  const processFn = def.processFormula ? compileFormula(def.processFormula, allowed) : undefined;

  return {
    id: `custom:${def.id}`,
    category: "custom",
    label: def.name,
    fields: def.inputs.map((i) => ({ key: i.key, label: i.label, kind: "number" as const, unit: i.unit })),
    compute(inp, { density }) {
      const scope: Record<string, number> = { PI: Math.PI, pi: Math.PI, e: Math.E, density };
      for (const i of def.inputs) scope[i.key] = num(inp, i.key, i.label);
      const run = (fn: EvalFunction, label: string) => {
        const v = fn.evaluate({ ...scope });
        if (typeof v !== "number" || !Number.isFinite(v)) throw new CalcError(`${label} did not give a number`);
        return v;
      };
      const finish = run(finishFn, "Finish formula");
      const process = processFn ? run(processFn, "Process formula") : finish;
      const values = def.inputs.map((i) => `${i.key} = ${f(scope[i.key])}`).join(", ");
      return {
        finishWt: finish,
        processWt: process,
        scrap: Math.max(0, process - finish),
        fixedCost: 0,
        costedByWeight: true,
        formula:
          `${values}, density = ${f(density)}\n` +
          `Finish = ${def.finishFormula} = ${f(finish)} kg` +
          (def.processFormula ? `\nProcess = ${def.processFormula} = ${f(process)} kg` : ""),
      };
    },
  };
}

