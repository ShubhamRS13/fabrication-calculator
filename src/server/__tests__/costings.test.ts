import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { seed } from "@/db/seed";
import * as dal from "../costings";

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

  it("deleting a costing cascades", async () => {
    const { id } = await sampleCosting();
    await dal.deleteCosting(db, id);
    expect(await dal.getCostingTree(db, id)).toBeNull();
  });
});
