import type { ItemType } from "./types";
import { bentPlate, disc, flat, plate, rectFlange, ringFlange } from "./items/sheet";
import { CONE_TYPES } from "./items/cones";
import { CYLINDER_TYPES } from "./items/cylinders";
import { DISH_TYPES } from "./items/dish-ends";
import { pyramidHopper, rectDuct } from "./items/panels";
import { SECTION_TYPES } from "./items/sections";
import { boughtDish, boughtFlange, boughtMisc, dishedEnd } from "./items/bought";
import { makeCustomItemType, type CustomShapeDef } from "./custom";

export const BUILT_IN_TYPES: ItemType[] = [
  ...CYLINDER_TYPES, ...CONE_TYPES, ...DISH_TYPES,
  plate, flat, disc, ringFlange, rectFlange, pyramidHopper, rectDuct, bentPlate,
  ...SECTION_TYPES,
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
