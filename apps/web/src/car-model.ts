export type Point3 = [number, number, number];
export interface CarPiece {
  id: number;
  kind: "brick" | "tire" | "hub" | "glass" | "detail";
  position: Point3;
  size: Point3;
  rotation?: Point3;
  color: string;
  studs?: boolean;
  label: string;
}

const colors = {
  lime: "#c4dc6b",
  light: "#dceb9e",
  deep: "#9bb748",
  cream: "#f6f0dc",
  rubber: "#292d28",
  chassis: "#41483b",
  glass: "#80abb0",
  rim: "#e0dfd4",
  lamp: "#fff1b6",
  red: "#d9674f",
  trim: "#748064",
};
const pieces: CarPiece[] = [];
function add(
  kind: CarPiece["kind"],
  position: Point3,
  size: Point3,
  color: string,
  label: string,
  studs = false,
  rotation?: Point3,
) {
  pieces.push({
    id: pieces.length,
    kind,
    position,
    size,
    color,
    label,
    studs,
    rotation,
  });
}

// Each numbered piece is one construction step. Studs and tire treads belong to their piece.
for (let x = 0; x < 10; x++)
  for (const side of [-1, 1])
    add(
      "brick",
      [-2.025 + x * 0.45, 0.32, side * 0.435],
      [0.445, 0.18, 0.86],
      colors.chassis,
      "Chassis",
      true,
    );
for (const x of [-1.45, 1.45])
  for (const z of [-1.04, 1.04])
    add("tire", [x, 0.46, z], [0.48, 0.48, 0.33], colors.rubber, "Wheels");
for (const x of [-1.45, 1.45])
  for (const z of [-1.23, 1.23])
    add("hub", [x, 0.46, z], [0.285, 0.285, 0.08], colors.rim, "Wheel hubs");
for (const x of [-2.34, 2.34])
  for (const z of [-0.46, 0.46])
    add("brick", [x, 0.49, z], [0.18, 0.22, 0.9], colors.cream, "Bumpers");
for (const z of [-0.94, 0.94])
  for (let x = 0; x < 4; x++)
    add(
      "brick",
      [-0.7 + x * 0.47, 0.49, z],
      [0.455, 0.22, 0.14],
      colors.deep,
      "Side rails",
    );
for (const z of [-0.83, 0.83])
  for (let x = 0; x < 6; x++)
    add(
      "brick",
      [-1.83 + x * 0.73, 0.89, z],
      [0.715, 0.45, 0.26],
      colors.lime,
      "Bodywork",
      true,
    );
for (let x = 0; x < 4; x++)
  for (const z of [-0.36, 0.36])
    add(
      "brick",
      [0.97 + x * 0.34, 1.08, z],
      [0.33, 0.23, 0.71],
      x > 2 ? colors.light : colors.lime,
      "Front hood",
      true,
    );
for (let x = 0; x < 3; x++)
  for (const z of [-0.36, 0.36])
    add(
      "brick",
      [-2.0 + x * 0.35, 1.08, z],
      [0.34, 0.23, 0.71],
      colors.lime,
      "Rear deck",
      true,
    );
for (const x of [-0.65, 0.1])
  for (const z of [-0.39, 0.39])
    add("brick", [x, 1.1, z], [0.5, 0.38, 0.49], colors.cream, "Seats");
add(
  "detail",
  [0.1, 0.91, 0],
  [0.6, 0.17, 0.15],
  colors.chassis,
  "Center console",
);
add("detail", [0.58, 1.24, 0], [0.17, 0.18, 1.29], colors.chassis, "Dashboard");
for (const x of [-1.02, 0.75])
  for (const z of [-0.75, 0.75])
    add(
      "brick",
      [x, 1.5, z],
      [0.12, 0.65, 0.12],
      colors.lime,
      "Cabin pillars",
      false,
      [0, 0, x > 0 ? 0.25 : -0.18],
    );
for (const z of [-0.35, 0.35])
  add(
    "glass",
    [0.76, 1.51, z],
    [0.055, 0.64, 0.69],
    colors.glass,
    "Windshield",
    false,
    [0, 0, 0.25],
  );
for (const z of [-0.35, 0.35])
  add(
    "glass",
    [-1.04, 1.51, z],
    [0.055, 0.61, 0.69],
    colors.glass,
    "Rear window",
    false,
    [0, 0, -0.18],
  );
for (const z of [-0.77, 0.77])
  for (const x of [-0.65, 0.2])
    add(
      "glass",
      [x, 1.49, z],
      [0.79, 0.56, 0.055],
      colors.glass,
      "Side windows",
    );
for (let x = 0; x < 4; x++)
  for (const z of [-0.37, 0.37])
    add(
      "brick",
      [-0.85 + x * 0.47, 1.86, z],
      [0.455, 0.16, 0.73],
      colors.cream,
      "Roof",
      true,
    );
for (const z of [-0.65, 0.65])
  add(
    "detail",
    [2.305, 0.91, z],
    [0.08, 0.22, 0.31],
    colors.lamp,
    "Headlights",
  );
for (const z of [-0.7, 0.7])
  add("detail", [-2.285, 0.88, z], [0.08, 0.2, 0.22], colors.red, "Taillights");
for (const z of [-1.0, 1.0])
  add("brick", [0.62, 1.38, z], [0.24, 0.13, 0.23], colors.cream, "Mirrors");
add(
  "detail",
  [2.316, 0.69, 0],
  [0.08, 0.12, 0.76],
  colors.chassis,
  "Front grille",
);
add(
  "detail",
  [2.37, 0.53, 0],
  [0.03, 0.11, 0.38],
  colors.cream,
  "Final detail",
);

if (pieces.length !== 100)
  throw new Error(
    `Car must contain exactly 100 pieces, received ${pieces.length}`,
  );
export const CAR_PIECES: readonly CarPiece[] = pieces;
