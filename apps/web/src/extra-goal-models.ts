import type { CarPiece, Point3 } from "./car-model";

const c = { blue: "#2d87d8", yellow: "#ffd94e", red: "#e9473d", ivory: "#f6f0dc", dark: "#293432", rubber: "#292d28", glass: "#163755", metal: "#748064" };
function builder() {
  const pieces: CarPiece[] = [];
  const add = (position: Point3, size: Point3, color: string, label: string,
    kind: CarPiece["kind"] = "brick", rotation?: Point3, studs = false) =>
    pieces.push({ id: pieces.length, position, size, color, label, kind, rotation, studs, hubCap: label === "Wheel hub" });
  const bar = (from: Point3, to: Point3, segments: number, width: number, color: string, label: string) => {
    const dy = to[1] - from[1], dz = to[2] - from[2], length = Math.hypot(dy, dz);
    for (let i = 0; i < segments; i++) {
      const t = (i + .5) / segments;
      add([from[0] + (to[0] - from[0]) * t, from[1] + dy * t, from[2] + dz * t],
        [width, length / segments + .014, width], color, label, "brick", [Math.atan2(dz, dy), 0, 0]);
    }
  };
  return { pieces, add, bar };
}

function consoleModel() {
  const { pieces, add } = builder();
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++)
    add([-.9 + col * .6, .12, -.45 + row * .55], [.59, .2, .54], c.dark, "Console stand", "brick", undefined, true);
  for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) for (let depth = 0; depth < 2; depth++)
    add([-.35 + col * .35, .43 + row * .42, -.24 + depth * .48], [.34, .41, .47], c.dark, "Console core");
  for (const side of [-1, 1]) for (let row = 0; row < 4; row++) for (let depth = 0; depth < 4; depth++)
    add([side * (.68 + row * .035), .49 + row * .52, -.37 + depth * .25], [.18, .51, .24], c.ivory, "Ivory side panel", "brick", [0, 0, -side * .065], row === 3);
  for (let row = 0; row < 2; row++) for (let col = 0; col < 4; col++)
    add([-.23 + col * .15, 2.19 + row * .075, .28], [.065, .065, .15], c.metal, "Console cooling vent", "detail");
  for (let row = 0; row < 3; row++) {
    const count = row === 1 ? 6 : 4;
    for (let col = 0; col < count; col++) add([(col - (count - 1) / 2) * .24, .25, .90 + row * .23], [.235, .17, .225], c.ivory, "Controller shell", "brick", undefined, row === 1);
  }
  for (const side of [-1, 1]) add([side * .29, .39, 1.13], [.085, .085, .07], c.dark, "Controller thumbstick", "hub", [-Math.PI / 2, 0, 0]);
  add([.59, 1.27, .29], [.04, 1.62, .035], c.blue, "Blue light strip", "detail");
  add([.28, .49, .29], [.12, .06, .04], c.blue, "Final power button", "detail");
  return pieces;
}

function cameraModel() {
  const { pieces, add } = builder();
  for (let row = 0; row < 5; row++) for (let col = 0; col < 6; col++) for (let depth = 0; depth < 2; depth++)
    add([-1.25 + col * .5, .35 + row * .36, -.15 + depth * .3], [.49, .35, .29], col === 0 ? c.dark : c.yellow, "Camera body", "brick", undefined, row === 4);
  for (let ring = 0; ring < 5; ring++) add([0, 1.08, .33 + ring * .085], [.65 - ring * .06, .65 - ring * .06, .085], ring === 4 ? c.glass : ring === 1 ? c.metal : c.dark, "Lens barrel", "hub");
  for (let row = 0; row < 2; row++) for (let col = 0; col < 6; col++) add([-1.25 + col * .5, 2.0, -.14 + row * .28], [.49, .12, .27], c.dark, "Camera top plate", "brick", undefined, true);
  for (let row = 0; row < 2; row++) for (let col = 0; col < 4; col++) add([-.52 + col * .35, .82 + row * .37, -.322], [.34, .36, .04], row === 0 ? c.blue : c.glass, "Rear display", "detail");
  for (let col = 0; col < 6; col++) add([-.88 + col * .35, 2.11, -.05], [.1, .1, .10], col === 5 ? c.red : c.metal, "Top control dial", "hub", [-Math.PI / 2, 0, 0]);
  for (let col = 0; col < 4; col++) add([-.99 + col * .14, 1.62, .315], [.135, .17, .04], c.ivory, "Flash window", "detail");
  for (let row = 0; row < 4; row++) add([1.52, .68 + row * .21, 0], [.055, .16, .15], c.dark, "Side controls", "detail");
  add([.88, 1.63, .316], [.40, .12, .035], c.blue, "Final camera badge", "detail");
  return pieces;
}

function phoneModel() {
  const { pieces, add } = builder();
  for (let row = 0; row < 6; row++) for (let col = 0; col < 5; col++) for (let depth = 0; depth < 2; depth++)
    add([-.62 + col * .31, .30 + row * .43, -.095 + depth * .19], [.30, .42, .18], c.ivory, "Phone shell", "brick", undefined, row === 5);
  for (let row = 0; row < 6; row++) for (let col = 0; col < 4; col++) add([-.465 + col * .31, .38 + row * .35, .195], [.30, .34, .035], row > 3 ? c.glass : col === 1 && row === 2 ? c.yellow : c.blue, "Display tile", "detail");
  for (const side of [-1, 1]) for (let row = 0; row < 4; row++) add([side * .8, .5 + row * .53, 0], [.08, .52, .36], c.blue, "Side frame");
  for (const y of [.075, 2.68]) for (const side of [-1, 1]) add([side * .4, y, 0], [.79, .12, .36], c.blue, "Phone end cap");
  for (const [x, y] of [[-.45, 2.36], [-.15, 2.36], [-.45, 2.08]]) add([x, y, -.20], [.105, .105, .06], c.dark, "Rear camera", "hub");
  add([0, 2.43, .197], [.34, .045, .04], c.dark, "Final speaker", "detail");
  return pieces;
}

function travelModel() {
  const { pieces, add } = builder();
  for (let row = 0; row < 6; row++) for (let col = 0; col < 5; col++) for (let depth = 0; depth < 2; depth++)
    add([-.8 + col * .4, .51 + row * .34, -.19 + depth * .38], [.39, .33, .37], c.blue, "Suitcase shell", "brick", undefined, row === 5);
  for (const side of [-1, 1]) {
    add([side * .76, .195, 0], [.16, .16, .18], c.rubber, "Suitcase wheel", "tire", [0, Math.PI / 2, 0]);
    add([side * .85, .195, 0], [.09, .09, .04], c.ivory, "Wheel hub", "hub", [0, Math.PI / 2, 0]);
    for (let row = 0; row < 6; row++) add([side * 1.005, .51 + row * .34, 0], [.085, .33, .74], c.ivory, "Corner rail");
    for (let row = 0; row < 3; row++) add([side * .45, 2.45 + row * .20, 0], [.085, .21, .13], c.dark, "Telescoping handle rail");
    for (let row = 0; row < 4; row++) add([side * .47, .72 + row * .40, .39], [.12, .39, .04], c.yellow, "Luggage strap", "detail");
  }
  for (let col = 0; col < 4; col++) add([-.345 + col * .23, 2.96, 0], [.225, .13, .18], c.dark, "Handle grip");
  for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) add([-.1 + col * .2, 1.10 + row * .18, .397], [.19, .17, .05], c.ivory, "Travel sticker", "detail");
  add([.76, 2.02, .397], [.23, .30, .05], c.red, "Luggage tag", "detail", [0, 0, -.16]);
  add([1.06, 1.52, .22], [.08, .16, .07], c.dark, "Final zipper pull", "detail");
  return pieces;
}

function vehicle(motor: boolean) {
  const { pieces, add, bar } = builder();
  for (const z of [-1.17, 1.17]) {
    add([0, .49, z], [.49, .49, .20], c.rubber, "Wheel tire", "tire", [0, Math.PI / 2, 0]);
    add([.06, .49, z], [.11, .11, .24], c.ivory, "Wheel hub", "hub", [0, Math.PI / 2, 0]);
    for (let spoke = 0; spoke < 8; spoke++) add([.12, .49, z], [.045, .84, .045], c.metal, "Wheel spoke", "detail", [spoke * Math.PI / 8, 0, 0]);
  }
  const rear: Point3 = [0, .49, -1.17], front: Point3 = [0, .49, 1.17];
  const crank: Point3 = [0, .68, -.26], seat: Point3 = [0, 1.32, -.47], neck: Point3 = [0, 1.43, .83];
  for (const [a, b, label] of [[rear, crank, "Rear swingarm"], [rear, seat, "Seat stay"], [crank, seat, "Seat tube"], [seat, neck, "Top frame"], [crank, neck, "Down tube"], [neck, front, "Front fork"]] as const)
    bar(a, b, motor ? 4 : 8, motor ? .14 : .095, motor ? c.dark : c.blue, label);
  if (motor) {
    for (let row = 0; row < 5; row++) for (let col = 0; col < 4; col++) add([-.3 + col * .2, 1.11 + Math.sin(row * Math.PI / 4) * .07, -.36 + row * .20], [.19, .28, .19], col === 1 ? c.ivory : c.red, "Fuel tank", "brick", undefined, true);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) add([-.24 + col * .16, 1.29, -.96 + row * .17], [.15, .13, .16], c.dark, "Saddle");
    for (let row = 0; row < 2; row++) for (let col = 0; col < 4; col++) add([0, .73 + row * .13, -.44 + col * .17], [.43, .12, .16], c.metal, "Engine block");
    for (const z of [-1.17, 1.17]) for (const angle of [-.6, -.2, .2, .6]) add([0, .49 + Math.cos(angle) * .55, z + Math.sin(angle) * .55], [.34, .075, .20], c.red, "Wheel fender", "brick", [angle, 0, 0]);
  } else {
    for (let row = 0; row < 2; row++) for (let col = 0; col < 4; col++) add([-.285 + col * .19, 1.40, -.55 + row * .19], [.18, .12, .18], c.ivory, "Bicycle saddle", "brick", undefined, true);
    for (const side of [-1, 1]) for (let col = 0; col < 3; col++) add([side * (.05 + col * .09), .67, -.26], [.095, .07, .15], c.dark, "Pedal");
    for (const offset of [-.055, .055]) bar([.06, crank[1] + offset, crank[2]], [.06, rear[1] + offset, rear[2]], 5, .03, c.metal, "Chain link");
  }
  for (let col = 0; col < 5; col++) add([-.34 + col * .17, 1.48, .86], [.165, .08, .09], col === 0 || col === 4 ? c.dark : c.ivory, "Handlebar grip");
  if (motor) add([.35, .68, -.72], [.075, .075, .68], c.dark, "Exhaust", "hub");
  else add([.24, 1.56, .86], [.065, .065, .065], c.yellow, "Handlebar bell", "hub", [-Math.PI / 2, 0, 0]);
  add([0, 1.36, .92], [.11, .11, .09], c.ivory, "Headlight", "hub");
  add([0, 1.34, -1.065], [.22, .075, .08], c.red, "Final rear light", "detail");
  return pieces;
}

export const EXTRA_GOAL_MODELS = {
  console: consoleModel(), camera: cameraModel(), motorcycle: vehicle(true),
  bicycle: vehicle(false), phone: phoneModel(), travel: travelModel(),
} as const;
