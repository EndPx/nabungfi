import { CAR_PIECES, type CarPiece, type Point3 } from "./car-model";
export type WorkshopModel = "car" | "laptop" | "house" | "custom";
const palette = {
  lime: "#c4dc6b",
  light: "#dceb9e",
  deep: "#9bb748",
  cream: "#f6f0dc",
  dark: "#292d28",
  glass: "#80abb0",
  coral: "#d9674f",
  trim: "#748064",
};
function builder() {
  const pieces: CarPiece[] = [];
  return {
    pieces,
    add(
      position: Point3,
      size: Point3,
      color: string,
      label: string,
      rotation?: Point3,
      kind: CarPiece["kind"] = "brick",
      studs = false,
    ) {
      pieces.push({
        id: pieces.length,
        position,
        size,
        color,
        label,
        rotation,
        kind,
        studs,
      });
    },
  };
}
function laptop() {
  const { add, pieces } = builder();
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 8; col++)
      add(
        [-1.75 + col * 0.5, 0.18, -0.65 + row * 0.44],
        [0.49, 0.16, 0.43],
        palette.lime,
        "Laptop base",
        undefined,
        "brick",
        col === 0 || col === 7 || (row === 3 && (col <= 1 || col >= 6)),
      );
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 6; col++)
      add(
        [-1.35 + col * 0.54, 0.29, -0.57 + row * 0.22],
        [0.45, 0.065, 0.18],
        palette.dark,
        "Keyboard keys",
      );
  for (const side of [-1, 1])
    add(
      [side * 1.35, 0.34, -0.92],
      [0.7, 0.17, 0.18],
      palette.trim,
      "Screen hinges",
    );
  for (const y of [0.5, 2.62])
    for (let col = 0; col < 8; col++) {
      add(
        [-1.75 + col * 0.5, y, -1],
        [0.49, 0.15, 0.16],
        palette.deep,
        "Screen frame",
      );
      if (y === 2.62 && col === 7) {
        pieces[pieces.length - 1].attachment = "laptop-lid";
      }
    }
  for (const x of [-1.95, 1.95])
    for (let row = 0; row < 4; row++)
      add(
        [x, 0.77 + row * 0.53, -1],
        [0.14, 0.52, 0.16],
        palette.deep,
        "Screen sides",
      );
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 4; col++)
      add(
        [-1.425 + col * 0.95, 0.79 + row * 0.52, -0.99],
        [0.94, 0.51, 0.07],
        row < 2 ? palette.glass : palette.dark,
        "Display pixels",
        undefined,
        "detail",
      );
  add([0, 0.285, 0.63], [1.35, 0.05, 0.35], palette.cream, "Trackpad");
  add(
    [0, 1.53, -0.91],
    [0.38, 0.38, 0.09],
    palette.lime,
    "Final display mark",
    [0, 0, Math.PI / 4],
  );
  return pieces;
}
function house() {
  const { add, pieces } = builder();
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 5; col++)
      add(
        [-1.6 + col * 0.8, 0.18, -1.2 + row * 0.8],
        [0.79, 0.2, 0.79],
        palette.trim,
        "Foundation",
        undefined,
        "brick",
        true,
      );
  for (let row = 0; row < 3; row++) {
    const y = 0.55 + row * 0.6;
    for (const x of [-1.48, -0.74, 0.74, 1.48])
      add(
        [x, y, 1.27],
        [0.7, 0.59, 0.22],
        row % 2 ? palette.light : palette.lime,
        "Front walls",
        undefined,
        "brick",
        true,
      );
    for (let col = 0; col < 4; col++)
      add(
        [-1.35 + col * 0.9, y, -1.27],
        [0.89, 0.59, 0.22],
        palette.lime,
        "Back walls",
        undefined,
        "brick",
        true,
      );
    for (const x of [-1.88, 1.88])
      for (const z of [-0.585, 0.585])
        add(
          [x, y, z],
          [0.22, 0.59, 1.16],
          palette.light,
          "Side walls",
          undefined,
          "brick",
          true,
        );
  }
  for (const x of [-1.2, 1.2])
    for (const y of [1.15, 1.64])
      add(
        [x, y, 1.41],
        [0.51, 0.43, 0.065],
        palette.glass,
        "Window panes",
        undefined,
        "glass",
      );
  for (const y of [0.65, 1.35])
    add([0, y, 1.3], [0.67, 0.69, 0.2], palette.cream, "Front door");
  for (const side of [-1, 1])
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 5; col++) {
        add(
          [side * (0.32 + row * 0.64), 2.94 - row * 0.29, -1.28 + col * 0.64],
          [0.75, 0.16, 0.63],
          row % 2 ? palette.deep : palette.lime,
          "Roof tiles",
          [0, 0, -side * 0.43],
          "brick",
          true,
        );
        // End caps belong to their roof piece, not an extra savings step.
        if (side === -1 && row === 0 && (col === 0 || col === 4)) {
          pieces[pieces.length - 1].attachment = col === 0 ? "back-gable" : "front-gable";
        }
      }
  for (let row = 0; row < 4; row++)
    add(
      [1.05, 2.48 + row * 0.22, -0.68],
      [0.4, 0.21, 0.4],
      palette.coral,
      "Chimney",
      undefined,
      "brick",
      true,
    );
  for (const x of [-1.4, -0.9, 1.1])
    add(
      [x, 0.4, 1.63],
      [0.35, 0.35, 0.32],
      palette.deep,
      "Garden blocks",
      undefined,
      "brick",
      true,
    );
  add(
    [0.18, 1, 1.42],
    [0.075, 0.075, 0.1],
    palette.coral,
    "Door handle",
    undefined,
    "detail",
  );
  return pieces;
}
function custom() {
  const { add, pieces } = builder();
  for (let level = 0; level < 5; level++)
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 7 - level; col++)
        add(
          [(col - (6 - level) / 2) * .35, .2 + level * .28, (row - 1.5) * .35],
          [.34, .27, .34],
          [palette.lime, palette.light, palette.cream, palette.deep, palette.lime][level],
          "Goal sculpture",
          undefined,
          "brick",
          true,
        );
  return pieces;
}
export const WORKSHOP_MODELS: Readonly<
  Record<WorkshopModel, readonly CarPiece[]>
> = Object.freeze({
  car: CAR_PIECES,
  laptop: laptop(),
  house: house(),
  custom: custom(),
});
for (const [name, pieces] of Object.entries(WORKSHOP_MODELS))
  if (pieces.length !== 100)
    throw new Error(`${name} must contain exactly 100 pieces.`);
