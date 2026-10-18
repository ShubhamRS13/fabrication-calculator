import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { seed } from "@/db/seed";
import * as dal from "../costings";
import * as lib from "../library";

let db: Db;

beforeAll(async () => {
  const pg = drizzle({ client: new PGlite(), schema });
  await migrate(pg, { migrationsFolder: "./drizzle" });
  db = pg as unknown as Db;
  await seed(db);
}, 60_000);

async function sampleCosting() {
  const id = await dal.createCosting(db, {
    clientName: "KnitCon Solutions Pvt. Ltd.",
    projectName: "Punch Line System",
    poNo: "PO-123",
    defaultMaterial: "SS304",
  });
  const drawingId = await dal.addDrawing(db, id, { drawingNo: "2600121050-SH", title: "Storage Hopper" });
  const asmId = await dal.addAssembly(db, drawingId, { name: "Cyclone assembly", qty: 2 });
  await dal.addItem(db, drawingId, { type: "plate", name: "PAD PLATE", qty: 4, inputs: { length: 160, width: 200, thk: 3 } });
  await dal.addItem(db, drawingId, { type: "disc", name: "PLATE (CIRCULAR)", qty: 1, assemblyId: asmId, inputs: { dia: 412, thk: 6 } });
  await dal.addItem(db, drawingId, { type: "bought-misc", name: "HEX BOLT", qty: 8, inputs: { rate: 12 } });
  return { id, drawingId, asmId };
}

describe("data layer", () => {
  it("seeds materials and section sizes", async () => {
    const mats = await dal.listMaterials(db);
    expect(mats.map((m) => m.code)).toEqual(["MS", "SS304", "SS316", "SS202"]);
    await seed(db); // idempotent
    expect(await dal.listMaterials(db)).toHaveLength(4);
  });

  it("creates a costing with blank rates and default charge lines", async () => {
    const { id } = await sampleCosting();
    const tree = (await dal.getCostingTree(db, id))!;
    expect(tree.rates).toHaveLength(4);
    expect(tree.rates.every((r) => r.rate === null)).toBe(true);
    expect(tree.chargeLines.map((l) => l.name)).toEqual(["Labour – SS", "Labour – MS", "Painting", "Polishing", "Packaging"]);
    expect(tree.costing.burningPct).toBe(3);
  });

  it("computes totals from stored inputs", async () => {
    const { id } = await sampleCosting();
    await dal.setMaterialRate(db, id, { material: "SS304", rate: 220, scrapRate: 110 });
    const out = (await dal.computeCostingById(db, id))!;
    const d = out.result.drawings[0];
    const ss = d.byMaterial.find((t) => t.material === "SS304")!;
    // pad plate 4 × 0.768 + disc 2 × 8.147712 (assembly qty 2)
    expect(ss.process).toBeCloseTo(3.072 + 2 * 8.147712, 9);
    expect(ss.finish).toBeCloseTo(3.072 + 2 * 6.399198041, 6);
    expect(d.boughtTotal).toBe(96);
    expect(ss.net).toBeCloseTo((ss.process * 1.03) * 220 - ss.scrap * 110, 6);
  });

  it("rejects bad input", async () => {
    const { drawingId } = await sampleCosting();
    await expect(dal.addItem(db, drawingId, { type: "nope", name: "x", qty: 1, inputs: {} })).rejects.toThrow(/Unknown item type/);
    await expect(dal.addItem(db, drawingId, { type: "plate", name: "x", qty: 1, material: "XYZ", inputs: {} })).rejects.toThrow(/Unknown material/);
    await expect(dal.addItem(db, drawingId, { type: "plate", name: "x", qty: 0, inputs: {} })).rejects.toThrow();
    const other = await sampleCosting();
    await expect(
      dal.addItem(db, drawingId, { type: "plate", name: "x", qty: 1, assemblyId: other.asmId, inputs: {} }),
    ).rejects.toThrow(/does not belong/);
  });

  it("duplicates a costing deeply and independently", async () => {
    const { id } = await sampleCosting();
    await dal.setMaterialRate(db, id, { material: "SS304", rate: 220, scrapRate: 110 });
    const copyId = await dal.duplicateCosting(db, id);
    const [a, b] = await Promise.all([dal.computeCostingById(db, id), dal.computeCostingById(db, copyId)]);
    expect(b!.tree.costing.projectName).toBe("Punch Line System (copy)");
    expect(b!.result.grandTotal).toBeCloseTo(a!.result.grandTotal, 9);
    const copyDisc = b!.tree.drawings[0].items.find((i) => i.type === "disc")!;
    expect(copyDisc.assemblyId).toBe(b!.tree.drawings[0].assemblies[0].id);
    expect(copyDisc.assemblyId).not.toBe(a!.tree.drawings[0].assemblies[0].id);
    await dal.deleteItem(db, copyDisc.id);
    expect((await dal.getCostingTree(db, id))!.drawings[0].items).toHaveLength(3);
  });

  it("searches by client, PO and drawing no.", async () => {
    await dal.createCosting(db, { clientName: "Anubhav Industries", projectName: "Medical Waste", defaultMaterial: "MS" });
    expect((await dal.searchCostings(db, { q: "anubhav" })).map((r) => r.clientName)).toEqual(["Anubhav Industries"]);
    expect((await dal.searchCostings(db, { q: "PO-123" })).length).toBeGreaterThan(0);
    const byDrawing = await dal.searchCostings(db, { q: "2600121050-SH" });
    expect(byDrawing.length).toBeGreaterThan(0);
    expect(byDrawing[0].drawingCount).toBe(1);
    expect(await dal.searchCostings(db, { q: "100%_" })).toEqual([]);
  });

  it("numbers items per drawing, restarting in each assembly", async () => {
    const { id, drawingId, asmId } = await sampleCosting();
    // sampleCosting: pad plate (loose) → 1, disc (assembly) → 1, bolt (loose) → 2
    const items = () => dal.getCostingTree(db, id).then((t) => t!.drawings[0].items);
    const no = async (name: string) => (await items()).find((i) => i.name === name)!.itemNo;
    expect(await no("PAD PLATE")).toBe("1");
    expect(await no("PLATE (CIRCULAR)")).toBe("1");
    expect(await no("HEX BOLT")).toBe("2");

    await dal.addItem(db, drawingId, { itemNo: "19A", type: "plate", name: "RIB", qty: 1, inputs: {} });
    await dal.addItem(db, drawingId, { type: "plate", name: "NEXT", qty: 1, inputs: {} });
    expect(await no("RIB")).toBe("19A");
    expect(await no("NEXT")).toBe("20");

    await dal.addItem(db, drawingId, { type: "plate", name: "IN ASM", qty: 1, assemblyId: asmId, inputs: {} });
    expect(await no("IN ASM")).toBe("2");

    // Moving into the assembly without a number takes the assembly's next one.
    const next = (await items()).find((i) => i.name === "NEXT")!;
    await dal.updateItem(db, next.id, { assemblyId: asmId });
    expect(await no("NEXT")).toBe("3");
    // A number given explicitly is kept.
    await dal.updateItem(db, next.id, { itemNo: "7", assemblyId: null });
    expect(await no("NEXT")).toBe("7");

    // Duplicate keeps the numbers.
    const copyId = await dal.duplicateCosting(db, id);
    const copy = (await dal.getCostingTree(db, copyId))!.drawings[0].items;
    expect(copy.find((i) => i.name === "RIB")!.itemNo).toBe("19A");

    // Deleting the assembly moves its items after the last loose number (19A, 7 → next is 20).
    await dal.deleteAssembly(db, asmId);
    const after = await items();
    const moved = ["PLATE (CIRCULAR)", "IN ASM"].map((n) => after.find((i) => i.name === n)!.itemNo).sort();
    expect(moved).toEqual(["20", "21"]);
  });

  it("section tables: add a size, correct a built-in one, built-ins cannot be deleted", async () => {
    await lib.upsertSectionSize(db, { series: "MC", size: "250", data: { kgPerM: 30.6 } });
    await lib.upsertSectionSize(db, { series: "ISMC", size: "100", data: { kgPerM: 9.56 } });
    await lib.upsertSectionSize(db, { series: "PIPE-SCH-40", size: "65 NB", data: { od: 73, wall: 5.16 } });
    const libNow = await dal.loadSectionLibrary(db);
    expect(libNow.kgPerM.MC["250"]).toBe(30.6);
    expect(libNow.kgPerM.ISMC["100"]).toBe(9.56);
    expect(libNow.pipeSch["40"]["65"]).toEqual({ od: 73, wall: 5.16 });
    await expect(lib.upsertSectionSize(db, { series: "PIPE-SCH-40", size: "65 NB", data: { od: 10, wall: 6 } })).rejects.toThrow(/too thick/);
    const rows = await lib.listSectionSizes(db);
    const builtIn = rows.find((r) => r.series === "ISMB" && r.size === "200")!;
    await expect(lib.deleteSectionSize(db, builtIn.id)).rejects.toThrow(/cannot be deleted/);
    const mine = rows.find((r) => r.series === "MC")!;
    await lib.deleteSectionSize(db, mine.id);
    expect((await dal.loadSectionLibrary(db)).kgPerM.MC).toBeUndefined();
    // Re-seeding adds missing built-ins but keeps the corrected value.
    await seed(db);
    expect((await dal.loadSectionLibrary(db)).kgPerM.ISMC["100"]).toBe(9.56);
  });

  it("deleting a costing cascades", async () => {
    const { id } = await sampleCosting();
    await dal.deleteCosting(db, id);
    expect(await dal.getCostingTree(db, id)).toBeNull();
  });
});
