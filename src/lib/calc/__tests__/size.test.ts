import { describe, expect, it } from "vitest";
import { buildRegistry, BUILT_IN_TYPES } from "../registry";
import { BUILT_IN_LIBRARY } from "../sections-lib";
import { itemSize } from "../size";
import type { ItemInputs } from "../types";

const reg = buildRegistry();
const size = (type: string, inputs: ItemInputs) => itemSize(reg.get(type), inputs);

describe("item Size text", () => {
  it("reads like the drawing BOM", () => {
    expect(size("plate", { length: 12000, width: 600, thk: 5 })).toBe("5 THK × 600 × 12000");
    expect(size("pipe-sch", { sch: "10S", nb: "50", length: 3000 })).toBe("50 NB SCH 10S × 3000 L");
    expect(size("ring-flange", { madeFrom: "sheet", od: 130, id: 100, thk: 6 })).toBe("6 THK × ID 100 × OD 130");
    expect(size("cone", { d1: 700, d2: 1300, diaRef: "OD", height: 760, thk: 2 })).toBe("2 THK × D1 700 × D2 1300 × H 760");
    expect(size("cone", { d1: 700, d2: 1300, diaRef: "ID", height: 760, thk: 2 })).toBe("2 THK × D1 700 × D2 1300 × H 760 (ID)");
    expect(size("shell", { dia: 1300, diaRef: "OD", height: 1950, thk: 2 })).toBe("2 THK × OD 1300 × H 1950");
    expect(size("dish-tori", { dia: 800, diaRef: "OD", crown: 800, knuckle: 80, thk: 5, holeDia: 50 })).toBe("5 THK × OD 800 × CR 800 × KR 80 × hole Ø50");
    expect(size("disc", { dia: 500, thk: 5 })).toBe("5 THK × Ø500");
    expect(size("pipe-custom", { od: 60.3, thk: 3, length: 3000 })).toBe("OD 60.3 × 3 THK × 3000 L");
    expect(size("round-bar", { dia: 10, length: 648 })).toBe("Round bar Ø10 × 648 L");
    expect(size("dished-end", { blankDia: 1017, thk: 3, dishType: "torispherical" })).toBe("3 THK × blank Ø1017 × torispherical");
  });

  it("bought-outs use their catalogue name; older items their typed text", () => {
    expect(size("bought", { kind: "Stub end", nb: "50", stub: "Long", rating: "SCH 10S" })).toBe("Stub end 50 NB Long SCH 10S");
    expect(size("bought-flange", { size: "50 NB", class: "150#", flangeType: "SORF", rate: 1 })).toBe("50 NB 150# SORF");
    expect(size("bought-misc", { rate: 150 })).toBe("");
  });

  it("decimals are kept to 2 places, blanks show ?", () => {
    expect(size("plate", { length: 1000.456, width: 500, thk: 1.5 })).toBe("1.5 THK × 500 × 1000.46");
    expect(size("plate", { length: 1000, thk: 3 })).toBe("3 THK × ? × 1000");
  });

  it("every built-in type gives a complete Size when its fields are filled", () => {
    for (const t of BUILT_IN_TYPES) {
      const i: ItemInputs = {};
      for (let pass = 0; pass < 3; pass++) {
        for (const f of t.fields) {
          if (f.showIf && !f.showIf(i, BUILT_IN_LIBRARY)) continue;
          if (f.kind === "number") i[f.key] ??= f.optional ? undefined : ((f.default as number) ?? 100);
          else if (f.kind === "select") i[f.key] ??= (f.default as string) ?? (f.dependentOptions?.(i, BUILT_IN_LIBRARY) ?? f.options ?? [])[0]?.value;
          else if (f.kind === "diaRef") i[f.key] ??= "OD";
          else if (f.kind === "text") i[f.key] ??= "X";
          else i[f.key] ??= f.default;
        }
      }
      const s = itemSize(t, i);
      expect(s, t.id).not.toBe("");
      expect(s, t.id).not.toContain("?");
    }
  });

  it("custom shapes list their inputs", () => {
    const r = buildRegistry([
      { id: "c1", name: "Gusset", inputs: [{ key: "a", label: "A", unit: "mm" }, { key: "t", label: "THK", unit: "mm" }], finishFormula: "a*a*t*density/1e6", processFormula: "a*a*t*density/1e6" },
    ]);
    const t = [...r.values()].find((x) => x.label === "Gusset");
    expect(itemSize(t, { a: 200, t: 6 })).toBe("A 200 × THK 6");
  });
});
