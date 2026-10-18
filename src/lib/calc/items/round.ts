// Older module path; the cone and shell now live in cones.ts and cylinders.ts.
export { coneFrustumHeight as cone } from "./cones";
export { cylinderFull as shell } from "./cylinders";

/**
 * Bounding box of an annular sector (fan) with radii R1 > R2 and angle θ,
 * laid out symmetric about the vertical axis.
 */
export function fanBoundingBox(R1: number, R2: number, thetaDeg: number) {
  const half = (thetaDeg * Math.PI) / 360;
  const pts: [number, number][] = [];
  for (const R of [R1, R2]) {
    pts.push([R * Math.sin(-half), R * Math.cos(-half)]);
    pts.push([R * Math.sin(half), R * Math.cos(half)]);
  }
  for (const a of [0, Math.PI / 2, -Math.PI / 2, Math.PI, -Math.PI]) {
    if (Math.abs(a) <= half + 1e-12) pts.push([R1 * Math.sin(a), R1 * Math.cos(a)]);
  }
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}
