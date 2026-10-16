import type { ItemType } from "./types";
import { bentPlate, disc, plate, rectFlange, ringFlange } from "./items/sheet";
import { cone, shell } from "./items/round";
import { pyramidHopper, rectDuct } from "./items/panels";
import {
  angleCustom, flat, pipeCustom, pipeIs1239, pipeSch, pipeSwg, rectTube, roundBar, squareBar, structural,
} from "./items/sections";
import { boughtDish, boughtFlange, boughtMisc, dishedEnd } from "./items/bought";
import { makeCustomItemType, type CustomShapeDef } from "./custom";

export const BUILT_IN_TYPES: ItemType[] = [
  plate, disc, ringFlange, rectFlange, shell, cone, pyramidHopper, rectDuct, bentPlate,
  pipeSch, pipeIs1239, pipeSwg, pipeCustom, rectTube, flat, roundBar, squareBar, structural, angleCustom,
  boughtFlange, boughtDish, boughtMisc, dishedEnd,
];

export function buildRegistry(customShapes: CustomShapeDef[] = []): Map<string, ItemType> {
  const map = new Map(BUILT_IN_TYPES.map((t) => [t.id, t]));
  for (const def of customShapes) {
    // A shape whose formula no longer compiles is skipped; its items report "Unknown item type".
    try {
      const t = makeCustomItemType(def);
      map.set(t.id, t);
    } catch {
      continue;
    }
  }
  return map;
}
