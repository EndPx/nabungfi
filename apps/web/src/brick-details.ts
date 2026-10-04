export const MODEL_POSTER_REVISION = "brick-detail-v2";
export const STUD_PITCH = 0.24;
export const STUD_RADIUS = 0.075;
export const STUD_HEIGHT = 0.066;
const EDGE_MARGIN = 0.012;

function centers(length: number) {
  if (length < 2 * (STUD_RADIUS + EDGE_MARGIN)) return [];
  const count = Math.min(
    8,
    Math.floor((length - 2 * (STUD_RADIUS + EDGE_MARGIN)) / STUD_PITCH) + 1,
  );
  return Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * STUD_PITCH);
}

/** Stud centers stay inside the brick footprint, including their full radius. */
export function studLayout(width: number, depth: number): readonly (readonly [number, number])[] {
  return centers(width).flatMap((x) => centers(depth).map((z) => [x, z] as const));
}

/** Body bevel follows thickness, preventing small details from becoming capsules. */
export function brickBevel(size: readonly number[]) {
  return Math.min(0.025, Math.min(...size) * 0.12);
}
