// Original marketing sculptures. These do not represent funded app goals.
export type LandingModelId = "camera" | "scooter" | "sailboat";
export type SculptureColor = keyof typeof SCULPTURE_COLORS;
export type Vec3 = [number, number, number];
export interface SculpturePiece {
  kind: "brick" | "disc" | "tire";
  position: Vec3;
  size: Vec3;
  color: SculptureColor;
  rotation?: Vec3;
  studs?: boolean;
}

export const SCULPTURE_COLORS = {
  blue: "#2d87d8",
  yellow: "#ffd94e",
  red: "#e9473d",
  ivory: "#fff0cc",
  teal: "#b9d2cd",
  graphite: "#293432",
  rubber: "#28302b",
  lens: "#8ec8d9",
} as const;

function brick(position: Vec3, size: Vec3, color: SculptureColor, studs = true): SculpturePiece {
  return { kind: "brick", position, size, color, studs };
}
function disc(position: Vec3, radius: number, depth: number, color: SculptureColor): SculpturePiece {
  return { kind: "disc", position, size: [radius, depth, radius], color, rotation: [Math.PI / 2, 0, 0] };
}

function camera(): SculpturePiece[] {
  const pieces: SculpturePiece[] = [];
  // Alternating full and half bricks make the body read as a real brick build.
  for (let row = 0; row < 6; row++) {
    const widths = row % 2 ? [0.4, 0.8, 0.8, 0.8, 0.8, 0.4] : [0.8, 0.8, 0.8, 0.8, 0.8];
    let x = -2;
    for (const width of widths) {
      pieces.push(brick([x + width / 2, 0.23 + row * 0.28, 0], [width - 0.025, 0.26, 1.14], row === 0 || row === 5 ? "blue" : x < -1.5 ? "graphite" : "ivory"));
      x += width;
    }
  }
  for (let i = 0; i < 3; i++) pieces.push(brick([-0.4 + i * 0.4, 1.99, 0], [0.375, 0.43, 0.86], "blue"));
  pieces.push(brick([0, 2.015, 0.45], [0.67, 0.25, 0.05], "graphite", false));
  pieces.push(brick([0, 2.015, 0.483], [0.5, 0.14, 0.015], "lens", false));
  pieces.push(brick([-1.45, 1.98, 0.04], [0.32, 0.12, 0.35], "red", false));
  pieces.push(brick([1.38, 1.46, 0.596], [0.63, 0.34, 0.06], "graphite", false));
  pieces.push(brick([1.38, 1.46, 0.637], [0.51, 0.24, 0.025], "yellow", false));
  pieces.push(disc([0.1, 1.05, 0.73], 0.78, 0.3, "graphite"));
  pieces.push(disc([0.1, 1.05, 0.96], 0.69, 0.18, "blue"));
  pieces.push(disc([0.1, 1.05, 1.075], 0.62, 0.08, "graphite"));
  pieces.push(disc([0.1, 1.05, 1.126], 0.5, 0.032, "lens"));
  pieces.push(disc([0.1, 1.05, 1.15], 0.26, 0.022, "graphite"));
  pieces.push(brick([-0.15, 1.33, 1.153], [0.22, 0.05, 0.018], "ivory", false));
  pieces.push(brick([1.52, 0.61, 0.595], [0.38, 0.13, 0.04], "red", false));
  // Small back controls are visible during the turn, rather than a blank slab.
  pieces.push(brick([0.35, 1.02, -0.589], [1.62, 0.89, 0.06], "graphite", false));
  pieces.push(brick([0.35, 1.02, -0.627], [1.44, 0.71, 0.024], "teal", false));
  for (let i = 0; i < 3; i++) pieces.push(disc([1.42, 0.68 + i * 0.28, -0.617], 0.07, 0.04, i === 2 ? "red" : "blue"));
  return pieces;
}

function scooter(): SculpturePiece[] {
  const pieces: SculpturePiece[] = [];
  for (const x of [-1.37, 1.37]) {
    pieces.push({ kind: "tire", position: [x, 0.5, 0], size: [0.47, 0.47, 0.26], color: "rubber" });
    for (const z of [-0.135, 0.135]) {
      pieces.push(disc([x, 0.5, z], 0.3, 0.035, "ivory"));
      pieces.push(disc([x, 0.5, z * 1.2], 0.09, 0.03, "blue"));
    }
  }
  for (let i = 0; i < 6; i++) pieces.push(brick([-1.42 + i * 0.48, 0.61, 0], [0.455, 0.18, 0.82], "blue"));
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < (row < 2 ? 3 : 4); i++) {
      pieces.push(brick([-1.67 + i * 0.4, 0.87 + row * 0.25, 0], [0.375, 0.23, 0.8], row === 2 ? "ivory" : "red"));
    }
  }
  for (let i = 0; i < 3; i++) pieces.push(brick([-1.4 + i * 0.4, 1.81, 0], [0.375, 0.18, 0.88], "graphite", false));
  for (let row = 0; row < 6; row++) {
    pieces.push(brick([0.93 + row * 0.045, 0.87 + row * 0.25, 0], [0.34, 0.23, row > 3 ? 0.58 : 0.79], row === 3 ? "ivory" : "red"));
  }
  for (let i = 0; i < 3; i++) pieces.push(brick([1.42, 1.05 + i * 0.28, 0], [0.14, 0.26, 0.2], "graphite", false));
  pieces.push(brick([1.2, 2.44, 0], [0.2, 0.28, 0.22], "ivory", false));
  pieces.push(brick([1.2, 2.63, 0], [0.21, 0.12, 1.17], "graphite", false));
  for (const z of [-0.48, 0.48]) pieces.push(brick([1.2, 2.64, z], [0.3, 0.18, 0.28], "blue", false));
  pieces.push({ ...disc([1.4, 2.18, 0], 0.18, 0.16, "ivory"), rotation: [0, 0, Math.PI / 2] });
  pieces.push({ ...disc([1.5, 2.18, 0], 0.135, 0.025, "yellow"), rotation: [0, 0, Math.PI / 2] });
  pieces.push(brick([-1.89, 1.41, 0], [0.12, 0.18, 0.4], "yellow", false));
  return pieces;
}

function sailboat(): SculpturePiece[] {
  const pieces: SculpturePiece[] = [];
  for (let row = 0; row < 3; row++) {
    const cells = 5 + row * 2;
    for (let i = 0; i < cells; i++) {
      pieces.push(brick([(i - (cells - 1) / 2) * 0.4, 0.23 + row * 0.27, 0], [0.375, 0.25, 0.64 + row * 0.23], row === 1 ? "ivory" : "blue"));
    }
  }
  for (let i = 0; i < 10; i++) pieces.push(brick([(i - 4.5) * 0.4, 0.93, 0], [0.375, 0.12, 1.04], "ivory"));
  for (let i = 0; i < 11; i++) pieces.push(brick([-0.12, 1.16 + i * 0.26, 0], [0.11, 0.24, 0.13], "graphite", false));
  // Two stepped brick sails; the joins and studs remain visible from both sides.
  for (let row = 0; row < 9; row++) {
    const cells = 6 - Math.floor(row * 0.63);
    for (let i = 0; i < cells; i++) {
      pieces.push(brick([0.12 + i * 0.32, 1.32 + row * 0.28, 0], [0.3, 0.26, 0.15], row === 1 ? "yellow" : "ivory", false));
    }
  }
  for (let row = 0; row < 7; row++) {
    const cells = 4 - Math.floor(row * 0.5);
    for (let i = 0; i < cells; i++) {
      pieces.push(brick([-0.35 - i * 0.31, 1.33 + row * 0.28, 0], [0.29, 0.26, 0.15], row < 2 ? "teal" : "ivory", false));
    }
  }
  pieces.push(brick([0.15, 3.96, 0], [0.5, 0.18, 0.08], "red", false));
  pieces.push(brick([-1.39, 1.04, 0], [0.39, 0.1, 0.67], "yellow"));
  pieces.push(brick([1.79, 1.04, 0], [0.23, 0.1, 0.67], "red"));
  return pieces;
}

const ordered = (pieces: SculpturePiece[]) => {
  const floor=Math.min(...pieces.map(piece=>piece.position[1]-(piece.kind==="brick" ? piece.size[1]/2 : piece.size[0])));
  return pieces.map(piece=>({...piece,position:[piece.position[0],piece.position[1]-floor,piece.position[2]] as Vec3}))
    .sort((a,b)=>a.position[1]-b.position[1]);
};
export const LANDING_MODELS = [
  { id: "camera", name: "Camera", pieces: ordered(camera()) },
  { id: "scooter", name: "Scooter", pieces: ordered(scooter()) },
  { id: "sailboat", name: "Sailboat", pieces: ordered(sailboat()) },
] as const;
