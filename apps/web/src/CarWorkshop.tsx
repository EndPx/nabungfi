import {
  Component,
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { gsap } from "gsap";
import {
  Box,
  ChevronLeft,
  ChevronRight,
  Move,
  RotateCcw,
  Volume2,
  VolumeX,
} from "./icons";
import {
  PCFShadowMap,
  CylinderGeometry,
  LatheGeometry,
  Matrix4,
  Vector2,
  BoxGeometry,
  ExtrudeGeometry,
  Shape,
  MeshPhysicalMaterial,
  PMREMGenerator,
  type InstancedMesh,
  MeshStandardMaterial,
  type BufferGeometry,
  type Group,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { brickBevel, studLayout, STUD_RADIUS, STUD_HEIGHT } from "./brick-details";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { type CarPiece } from "./car-model";
import { WORKSHOP_MODELS, type WorkshopModel } from "./goal-models";
import {
  playBuildFinish,
  playBuildStep,
  setAudioEnabled,
  stopBuildAudio,
  unlockAudio,
} from "./sound";
import { Button, IconButton } from "./ui";
import { formatUsdc } from "./live-api";
import { buildFinishKind } from "./build-feedback";

export interface BuildSequence {
  key: number;
  from: number;
  to: number;
}
interface WorkshopProps {
  goalId: string;
  funded: number;
  achieved: boolean;
  reducedMotion: boolean;
  model?: WorkshopModel;
  preview?: boolean;
  introBuild?: boolean;
  nextPiece?: {
    fractionBasisPoints: number;
    remainingRaw: string;
    targetFunded: boolean;
  };
}
const SCENE_CAMERA = {
  position: [6.7, 5, 7.5] as [number, number, number],
  zoom: 73,
  near: 0.1,
  far: 60,
};
const MODEL_TARGETS: Record<WorkshopModel, [number, number, number]> = {
  car: [0, 0.85, 0],
  laptop: [0, 1.15, 0],
  house: [0, 1.35, 0],
  custom: [0, 0.75, 0],
  console: [0, 1.15, .2], camera: [0, 1.1, .15], motorcycle: [0, .9, 0],
  bicycle: [0, .9, 0], phone: [0, 1.35, 0], travel: [0, 1.5, 0],
};
const MODEL_HOME: [number,number,number] = [0,0.06,0];

function readBuilt(goalId: string, funded: number) {
  try {
    const saved = localStorage.getItem(`nabungfi:built:${goalId}`);
    return saved === null
      ? funded
      : Math.min(funded, Math.max(0, Number(saved) || 0));
  } catch {
    return funded;
  }
}

// Original geometry/materials are immutable and shared by the finite model catalog.
// Creating the same bevel geometry twice per piece stalled initial mobile rendering.
const geometryCache = new Map<string, BufferGeometry>();
const materialCache = new Map<string, MeshStandardMaterial>();
const studGeometry = new LatheGeometry(
  [
    new Vector2(0, -STUD_HEIGHT / 2),
    new Vector2(STUD_RADIUS * 0.88, -STUD_HEIGHT / 2),
    new Vector2(STUD_RADIUS, -STUD_HEIGHT / 2 + 0.005),
    new Vector2(STUD_RADIUS, STUD_HEIGHT / 2 - 0.007),
    new Vector2(STUD_RADIUS - 0.006, STUD_HEIGHT / 2 - 0.001),
    new Vector2(STUD_RADIUS - 0.009, STUD_HEIGHT / 2),
    new Vector2(0, STUD_HEIGHT / 2),
  ],
  24,
);
const hubCapGeometry = new CylinderGeometry(0.063, 0.063, 0.008, 20);
const hubCapMaterial = new MeshStandardMaterial({
  color: "#41483b",
  roughness: 0.5,
  metalness: 0,
});
const gableOutline = new Shape();
gableOutline.moveTo(-1.96, 2.02);
gableOutline.lineTo(-0.38, 2.02);
gableOutline.lineTo(-0.38, 1.71);
gableOutline.lineTo(0.38, 1.71);
gableOutline.lineTo(0.38, 2.02);
gableOutline.lineTo(1.96, 2.02);
gableOutline.lineTo(1.96, 2.11);
gableOutline.lineTo(0, 3);
gableOutline.lineTo(-1.96, 2.11);
gableOutline.closePath();
const gableGeometry = new ExtrudeGeometry(gableOutline, {
  depth: 0.2,
  bevelEnabled: true,
  bevelThickness: 0.006,
  bevelSize: 0.006,
  bevelSegments: 2,
  steps: 1,
});
gableGeometry.translate(0, 0, -0.1);
const laptopLidGeometry = new RoundedBoxGeometry(3.98, 2.26, 0.08, 3, 0.015);

function geometryFor(piece: CarPiece) {
  const key = `${piece.kind}:${piece.size.join(":")}`;
  let geometry = geometryCache.get(key);
  if (!geometry) {
    if (piece.kind === "tire") {
      const radius = piece.size[0];
      const half = piece.size[2] / 2;
      geometry = new LatheGeometry(
        [
          new Vector2(radius * 0.49, -half),
          new Vector2(radius * 0.87, -half),
          new Vector2(radius * 0.965, -half * 0.72),
          new Vector2(radius * 0.965, half * 0.72),
          new Vector2(radius * 0.87, half),
          new Vector2(radius * 0.49, half),
          new Vector2(radius * 0.49, -half),
        ],
        32,
      );
    } else if (piece.kind === "hub") {
      geometry = new CylinderGeometry(...piece.size, 32);
    } else {
      geometry = new RoundedBoxGeometry(...piece.size, 3, brickBevel(piece.size));
    }
    geometryCache.set(key, geometry);
  }
  return geometry;
}
function materialFor(piece: CarPiece, ghost: boolean) {
  const key = `${piece.color}:${piece.kind}:${ghost}`;
  let material = materialCache.get(key);
  if (!material) {
    const settings = {
      color: ghost ? "#c8ccba" : piece.color,
      transparent: ghost || piece.kind === "glass",
      opacity: ghost ? 0.09 : piece.kind === "glass" ? 0.6 : 1,
      roughness: piece.kind === "tire" ? 0.84 : piece.kind === "glass" ? 0.12 : 0.28,
      metalness: piece.kind === "hub" ? 0.12 : 0,
      depthWrite: !ghost && piece.kind !== "glass",
    };
    material = ghost || piece.kind === "tire"
      ? new MeshStandardMaterial(settings)
      : new MeshPhysicalMaterial({
          ...settings,
          clearcoat: piece.kind === "glass" ? 0.85 : 0.36,
          clearcoatRoughness: 0.2,
        });
    materialCache.set(key, material);
  }
  return material;
}
const PieceGeometry = memo(function PieceGeometry({
  piece,
  ghost = false,
}: {
  piece: CarPiece;
  ghost?: boolean;
}) {
  const material = materialFor(piece, ghost);
  const geometry = geometryFor(piece);
  if (piece.kind === "tire" || piece.kind === "hub")
    return (
      <group rotation={[Math.PI / 2, 0, 0]}>
        <mesh geometry={geometry} material={material} dispose={null} castShadow={!ghost} receiveShadow />
        {!ghost && piece.kind === "tire" && <TireTread piece={piece} material={material} />}
        {!ghost && piece.kind === "hub" && piece.hubCap !== false && (
          <mesh
            geometry={hubCapGeometry}
            material={hubCapMaterial}
            position={[0, Math.sign(piece.position[2]) * (piece.size[2] / 2 + 0.005), 0]}
            dispose={null}
          />
        )}
      </group>
    );
  return (
    <>
      <mesh
        geometry={geometry}
        material={material}
        dispose={null}
        castShadow={!ghost}
        receiveShadow
      />
      {piece.studs && !ghost && <BrickStuds piece={piece} material={material} />}
      {piece.attachment && (
        <group rotation={[0, 0, -(piece.rotation?.[2] ?? 0)]}>
          <mesh
            geometry={piece.attachment === "laptop-lid" ? laptopLidGeometry : gableGeometry}
            material={material}
            dispose={null}
            position={[
              -piece.position[0],
              (piece.attachment === "laptop-lid" ? 1.56 : 0) - piece.position[1],
              (piece.attachment === "laptop-lid" ? -1.1 : piece.attachment === "front-gable" ? 1.27 : -1.27) - piece.position[2],
            ]}
            castShadow={!ghost}
            receiveShadow
          />
        </group>
      )}
    </>
  );
});

function BrickStuds({ piece, material }: { piece: CarPiece; material: MeshStandardMaterial }) {
  const ref = useRef<InstancedMesh>(null);
  const points = useMemo(() => studLayout(piece.size[0], piece.size[2]), [piece]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new Matrix4();
    points.forEach(([x, z], i) => {
      matrix.makeTranslation(x, piece.size[1] / 2 + STUD_HEIGHT / 2 - 0.001, z);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [points, piece]);
  return points.length ? (
    <instancedMesh ref={ref} args={[studGeometry, material, points.length]} dispose={null} castShadow receiveShadow />
  ) : null;
}

function TireTread({ piece, material }: { piece: CarPiece; material: MeshStandardMaterial }) {
  const ref = useRef<InstancedMesh>(null);
  const tread = useMemo(() => {
    const key = `tread:${piece.size.join(":")}`;
    let geometry = geometryCache.get(key);
    if (!geometry) {
      geometry = new BoxGeometry(piece.size[0] * 0.19, piece.size[2] * 0.8, 0.024);
      geometryCache.set(key, geometry);
    }
    return geometry;
  }, [piece]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new Matrix4();
    for (let i = 0; i < 24; i++) {
      const angle = i * Math.PI * 2 / 24;
      matrix.makeRotationY(angle);
      matrix.setPosition(
        Math.sin(angle) * piece.size[0] * 0.97,
        0,
        Math.cos(angle) * piece.size[0] * 0.97,
      );
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [piece]);
  return <instancedMesh ref={ref} args={[tread, material, 24]} dispose={null} castShadow receiveShadow />;
}

function StudioReflection() {
  const { gl, scene, invalidate } = useThree();
  useEffect(() => {
    const oldEnvironment = scene.environment;
    const oldIntensity = scene.environmentIntensity;
    const room = new RoomEnvironment();
    const generator = new PMREMGenerator(gl);
    const map = generator.fromScene(room, 0.04);
    scene.environment = map.texture;
    scene.environmentIntensity = 0.45;
    invalidate();
    return () => {
      scene.environment = oldEnvironment;
      scene.environmentIntensity = oldIntensity;
      map.dispose();
      room.dispose();
      generator.dispose();
    };
  }, [gl, scene, invalidate]);
  return null;
}

function Car({
  pieces,
  built,
  sequence,
  reducedMotion,
  sound,
  fullCompletionAllowed,
  onCelebrating,
  onPiece,
  onComplete,
}: {
  pieces: readonly CarPiece[];
  built: number;
  sequence: BuildSequence | null;
  reducedMotion: boolean;
  sound: boolean;
  fullCompletionAllowed: boolean;
  onCelebrating: (value: boolean) => void;
  onPiece: (count: number) => void;
  onComplete: () => void;
}) {
  const groups = useRef<(Group | null)[]>([]);
  const assembled = useRef<Group>(null);
  const { invalidate } = useThree();
  const callback = useRef({ onPiece, onComplete, sound, onCelebrating });
  useEffect(() => {
    callback.current = { onPiece, onComplete, sound, onCelebrating };
  }, [onPiece, onComplete, sound, onCelebrating]);

  useEffect(() => {
    if (!sequence) return;
    const { from, to } = sequence;
    const finishKind = buildFinishKind(to,fullCompletionAllowed);
    let completed = false;
    if (reducedMotion) {
      if (callback.current.sound) playBuildFinish(to - from,finishKind);
      callback.current.onPiece(to);
      callback.current.onComplete();
      invalidate();
      return;
    }
    const timeline = gsap.timeline({
      onUpdate: invalidate,
      onComplete: () => {
        completed = true;
        callback.current.onCelebrating(false);
        callback.current.onComplete();
      },
    });
    const count = Math.max(1, to - from);
    const stagger = Math.min(0.085, 6 / count);
    for (let index = from; index < to; index++) {
      const group = groups.current[index];
      if (!group) continue;
      const piece = pieces[index];
      const start = (index - from) * stagger;
      const side = index % 2 ? -1 : 1;
      group.visible = false;
      group.position.set(
        piece.position[0] + side * (2.8 + (index % 3)),
        3.6 + (index % 4) * 0.5,
        piece.position[2] + side * 2.6,
      );
      group.rotation.set(0.8 + (index % 3), side * 1.5, 0.8);
      group.scale.setScalar(0.65);
      timeline.set(group, { visible: true }, start);
      timeline.to(
        group.position,
        {
          x: piece.position[0],
          y: piece.position[1],
          z: piece.position[2],
          duration: 0.6,
          ease: "power3.inOut",
        },
        start,
      );
      timeline.to(
        group.rotation,
        {
          x: piece.rotation?.[0] ?? 0,
          y: piece.rotation?.[1] ?? 0,
          z: piece.rotation?.[2] ?? 0,
          duration: 0.6,
          ease: "power3.out",
        },
        start,
      );
      timeline.to(
        group.scale,
        { x: 1, y: 1, z: 1, duration: 0.6, ease: "back.out(1.15)" },
        start,
      );
      timeline.call(
        () => {
          callback.current.onPiece(index + 1);
          if (callback.current.sound) playBuildStep();
        },
        [],
        start + 0.6,
      );
    }
    // Celebrate only after the last child brick has landed; the same group stays intact.
    timeline.call(() => {
      if(callback.current.sound) playBuildFinish(to-from,finishKind);
      if(finishKind === "goal") callback.current.onCelebrating(true);
    });
    if(finishKind === "goal" && assembled.current) {
      timeline.to(assembled.current.position,{y:0.61,duration:0.25,ease:"power2.out"},"+=0.085");
      timeline.to(assembled.current.position,{y:0.61,duration:0.08});
      timeline.to(assembled.current.position,{y:0.06,duration:0.27,ease:"power2.in"});
      timeline.to(assembled.current.position,{y:0.13,duration:0.10,ease:"power2.out"});
      timeline.to(assembled.current.position,{y:0.06,duration:0.13,ease:"power2.in"});
    }
    return () => {
      timeline.kill();
      if(assembled.current) assembled.current.position.y=0.06;
      callback.current.onCelebrating(false);
      if (!completed) stopBuildAudio();
    };
  }, [sequence, reducedMotion, invalidate, pieces, fullCompletionAllowed]);

  return (
    <group ref={assembled} position={MODEL_HOME}>
      {pieces.map((piece) => (
        <group key={piece.id}>
          {piece.id >= built && (
            <group
              position={piece.position}
              rotation={piece.rotation}
              visible={piece.id >= built && !sequence}
            >
              <PieceGeometry piece={piece} ghost />
            </group>
          )}
          <group
            ref={(element) => {
              groups.current[piece.id] = element;
            }}
            position={piece.position}
            rotation={piece.rotation}
            visible={
              piece.id < built ||
              Boolean(
                sequence && piece.id < sequence.to && piece.id >= sequence.from,
              )
            }
          >
            <PieceGeometry piece={piece} />
          </group>
        </group>
      ))}
    </group>
  );
}

function CameraControl({
  turn,
  tilt,
  reset,
  spin,
  onSpinning,
  onBelowView,
  reducedMotion,
  model,
}: {
  turn: number;
  tilt: number;
  reset: number;
  spin: { id: number; run: boolean };
  onSpinning: (value: boolean) => void;
  onBelowView: (value: boolean) => void;
  reducedMotion: boolean;
  model: WorkshopModel;
}) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const previousTurn = useRef(turn);
  const previousTilt = useRef(tilt);
  const previousReset = useRef(reset);
  const consumedSpin = useRef(0);
  const spinTween = useRef<ReturnType<typeof gsap.to> | null>(null);
  const { camera, size, invalidate } = useThree();
  const cancelSpin = useCallback(() => {
    spinTween.current?.kill();
    spinTween.current = null;
    if (controls.current) controls.current.enableDamping = !reducedMotion;
    onSpinning(false);
    invalidate();
  }, [reducedMotion, onSpinning, invalidate]);
  useEffect(() => {
    camera.zoom = Math.min(82, size.width / 8.2, size.height / 4.8);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, invalidate]);
  useEffect(() => {
    const control = controls.current;
    if (!control) return;
    cancelSpin();
    const delta = turn - previousTurn.current;
    previousTurn.current = turn;
    if (delta)
      control.setAzimuthalAngle(
        control.getAzimuthalAngle() + (delta * Math.PI) / 8,
      );
    control.update();
  }, [turn, cancelSpin]);
  useEffect(() => {
    const control = controls.current;
    if (!control) return;
    const delta = tilt - previousTilt.current;
    previousTilt.current = tilt;
    if (!delta) return;
    cancelSpin();
    control.setPolarAngle(Math.max(0.06, Math.min(Math.PI - 0.06, control.getPolarAngle() + delta * Math.PI / 8)));
    control.update();
    invalidate();
  }, [tilt, cancelSpin, invalidate]);
  useEffect(() => {
    if (reset === previousReset.current) return;
    previousReset.current = reset;
    cancelSpin();
    const control = controls.current;
    if (!control) return;
    const fittedZoom = camera.zoom;
    control.reset();
    control.target.set(...MODEL_TARGETS[model]);
    camera.zoom = fittedZoom;
    camera.updateProjectionMatrix();
    control.update();
    invalidate();
  }, [reset, cancelSpin, camera, model, invalidate]);
  useEffect(() => {
    if (spin.id === consumedSpin.current) return;
    consumedSpin.current = spin.id;
    cancelSpin();
    const control = controls.current;
    if (!control || !spin.run || reducedMotion) return;
    const angle = { value: control.getAzimuthalAngle() };
    control.enableDamping = false;
    onSpinning(true);
    spinTween.current = gsap.to(angle, {
      value: angle.value + Math.PI * 2,
      duration: 8,
      ease: "none",
      onUpdate: () => {
        control.setAzimuthalAngle(angle.value);
        invalidate();
      },
      onComplete: cancelSpin,
    });
    return cancelSpin;
  }, [spin, reducedMotion, cancelSpin, onSpinning, invalidate]);
  return (
    <OrbitControls
      ref={controls}
      target={MODEL_TARGETS[model]}
      enablePan={false}
      enableZoom={false}
      enableDamping={!reducedMotion}
      minAzimuthAngle={-Infinity}
      maxAzimuthAngle={Infinity}
      minPolarAngle={0.06}
      maxPolarAngle={Math.PI - 0.06}
      onStart={cancelSpin}
      onChange={() => onBelowView((controls.current?.getPolarAngle() ?? 0) > Math.PI / 2)}
      makeDefault
    />
  );
}

class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div className="scene-fallback">
          <Box size={40} />
          <h3>The workshop needs WebGL</h3>
          <p>
            Try a browser with graphics acceleration enabled. Your savings
            details and actions remain available.
          </p>
        </div>
      );
    return this.props.children;
  }
}

export default function CarWorkshop({
  goalId,
  funded,
  achieved,
  reducedMotion,
  model = "car",
  preview = false,
  introBuild = false,
  nextPiece,
}: WorkshopProps) {
  const pieces = WORKSHOP_MODELS[model];
  const [built, setBuilt] = useState(() =>
    preview
      ? introBuild && !reducedMotion
        ? 0
        : funded
      : readBuilt(goalId, funded),
  );
  const [sequence, setSequence] = useState<BuildSequence | null>(() =>
    preview && introBuild && !reducedMotion
      ? { key: 1, from: 0, to: funded }
      : null,
  );
  const [sound, setSound] = useState(() => {
    if (preview && introBuild) return false;
    try {
      return localStorage.getItem("nabungfi:assembly-sound") !== "off";
    } catch {
      return true;
    }
  });
  const [turn, setTurn] = useState(0);
  const [tilt, setTilt] = useState(0);
  const [belowView, setBelowView] = useState(false);
  const [freeOrbit, setFreeOrbit] = useState(false);
  const [reset, setReset] = useState(0);
  const [spin, setSpin] = useState({ id: 0, run: false });
  const [spinning, setSpinning] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const starting = useRef<symbol | null>(null);
  const cursor = Math.min(built, funded);
  const unbuilt = Math.max(0, funded - cursor);
  const validSequence = sequence && sequence.to === funded ? sequence : null;
  const active = validSequence !== null;
  const displayCount = cursor;
  const modelKey = `${goalId}:${model}:${funded}`;

  // Parent keys this workshop by goal + funded count. A funding change destroys
  // an older animation before it can draw or announce an unfunded piece.
  useEffect(() => {
    setAudioEnabled(sound);
    try {
      if (!(preview && introBuild))
        localStorage.setItem("nabungfi:assembly-sound", sound ? "on" : "off");
    } catch {
      /* Optional sound preference only. */
    }
  }, [sound, preview, introBuild]);

  useLayoutEffect(() => {
    starting.current=null;
    setPreparing(false);
    return () => {starting.current=null;stopBuildAudio();};
  }, [goalId,model,funded]);

  useEffect(() => {
    try {
      localStorage.setItem(
        `nabungfi:built:${goalId}`,
        String(Math.min(built, funded)),
      );
    } catch {
      /* Optional visual persistence only. */
    }
  }, [goalId, built, funded]);

  const start = async (replay = false) => {
    if (active || !funded || starting.current) return;
    const token=Symbol();
    starting.current=token;
    stopBuildAudio();
    if (sound) {setPreparing(true); await unlockAudio();}
    if(starting.current !== token) return;
    starting.current=null;
    setPreparing(false);
    const from = replay ? 0 : cursor;
    setBuilt(from);
    setSequence({ key: Date.now(), from, to: funded });
  };

  return (
    <section
      className={`workshop ${achieved ? "workshop--complete" : ""}`}
      data-spinning={spinning ? "true" : "false"}
      data-view={belowView ? "underside" : "studio"}
      data-free-orbit={freeOrbit ? "true" : "false"}
      data-celebrating={celebrating ? "true" : "false"}
      onKeyDown={event => { if(event.key === "Escape") setFreeOrbit(false); }}
      aria-label={
        preview
          ? "Interactive model preview, no savings or transactions"
          : "Your savings build"
      }
    >
      <div className="workshop-top">
        <span className="stage-label">
          <span className="status-dot" />
          {preview
            ? "Model preview · no funds"
            : achieved
              ? "Goal completed"
              : "A little closer, piece by piece"}
        </span>
        <span className="model-label">
          {model === "car"
            ? "Roadster"
            : model === "house"
              ? "Home"
              : model === "laptop"
                ? "Laptop"
                : model === "console" ? "Game console" : model === "camera" ? "Camera" : model === "motorcycle" ? "Motorcycle"
                : model === "bicycle" ? "Bicycle" : model === "phone" ? "Smartphone" : model === "travel" ? "Travel suitcase" : "Your sculpture"}{" "}
          / 100 pieces
        </span>
      </div>
      <div
        className="car-stage"
        aria-label={`Three dimensional ${model === "custom" ? "goal sculpture" : model} ${preview ? "preview" : "savings build"} with ${displayCount} of 100 pieces assembled. ${belowView ? "Underside view. " : ""}Drag or use arrow keys and rotation controls to turn and tilt.`}
        role="img"
        tabIndex={0}
        onPointerDown={() => { if(spinning) setSpin(value => ({id:value.id + 1,run:false})); }}
        onKeyDown={event => {
          if(event.key === "ArrowLeft") {event.preventDefault();setTurn(value => value - 1);}
          if(event.key === "ArrowRight") {event.preventDefault();setTurn(value => value + 1);}
          if(event.key === "ArrowUp") {event.preventDefault();setTilt(value => value - 1);}
          if(event.key === "ArrowDown") {event.preventDefault();setTilt(value => value + 1);}
          if(event.key === "Home") {event.preventDefault();setReset(value => value + 1);}
        }}
      >
        <SceneBoundary>
          <Suspense
            fallback={
              <div className="scene-fallback">
                <span className="loader-dot" />
                Opening your workshop…
              </div>
            }
          >
            <Canvas
              orthographic
              camera={SCENE_CAMERA}
              shadows={{ type: PCFShadowMap }}
              dpr={[1, 1.5]}
              frameloop="demand"
              gl={{ antialias: true, alpha: true }}
            >
              <StudioReflection />
              <ambientLight intensity={0.8} />
              <hemisphereLight args={["#ffffff", "#b7ba9f", 0.65]} />
              <directionalLight
                position={[3, 8, 5]}
                intensity={2.5}
                castShadow
                shadow-mapSize={[1024, 1024]}
                shadow-normalBias={0.035}
              />
              <directionalLight
                position={[-5, 3, -3]}
                intensity={1.2}
                color="#f6f0dc"
              />
              <Car
                pieces={pieces}
                key={modelKey}
                built={cursor}
                sequence={validSequence}
                reducedMotion={reducedMotion}
                sound={sound}
                fullCompletionAllowed={achieved || preview}
                onCelebrating={setCelebrating}
                onPiece={setBuilt}
                onComplete={() => setSequence(null)}
              />
              <group visible={!belowView}>
                <mesh position={[0, -0.07, 0]} receiveShadow>
                  <cylinderGeometry args={[3.3, 3.4, 0.1, 80]} />
                  <meshStandardMaterial color="#eeeddf" roughness={0.85} />
                </mesh>
                <ContactShadows
                  position={[0, -0.01, 0]}
                  opacity={0.3}
                  scale={10}
                  blur={2.5}
                  far={3}
                  resolution={256}
                  color="#807d68"
                  frames={active ? Infinity : 1}
                />
              </group>
              <CameraControl
                turn={turn}
                tilt={tilt}
                reset={reset}
                spin={spin}
                onSpinning={setSpinning}
                onBelowView={setBelowView}
                reducedMotion={reducedMotion}
                model={model}
              />
            </Canvas>
          </Suspense>
        </SceneBoundary>
      </div>
      <div className="workshop-bottom">
        <div className="piece-counter">
          <span className="piece-icon">
            <Box size={21} />
          </span>
          <div>
            <strong>
              {displayCount}
              <span> / 100 {preview ? "pieces" : "assembled"}</span>
            </strong>
            <p>
              {celebrating ? "You built your goal!" : active
                ? `Building ${pieces[Math.min(built, 99)].label.toLowerCase()}…`
                : unbuilt > 0
                  ? `${funded} funded · ${unbuilt} ready to assemble`
                  : achieved
                    ? "You built something worth saving for."
                    : preview
                      ? "Try the assembly. No wallet needed."
                      : "Every deposit brings it a little closer."}
            </p>
          </div>
        </div>
        <Button
          variant="build"
          className="build-button"
          onClick={() => void start(unbuilt === 0)}
          disabled={!funded || active || preparing}
        >
          {preparing ? "Preparing…" : active ? (
            <>
              <span className="build-spinner">
                <Box size={18} />
              </span>
              Building…
            </>
          ) : unbuilt ? (
            <>
              <Box size={18} />
              Build {unbuilt} {unbuilt === 1 ? "piece" : "pieces"}
            </>
          ) : (
            <>
              <RotateCcw size={17} />
              {preview ? "Try assembly" : "Replay build"}
            </>
          )}
        </Button>
      </div>
      {!preview && <p className="workshop-explanation">{funded} / 100 pieces funded by this goal. Assembly is visual; it doesn’t change your savings or unlock funds.</p>}
      {nextPiece && !active && (
        <div className="next-piece-tray">
          <div>
            <strong>
              {nextPiece.targetFunded
                ? "Your target is funded"
                : "Your next piece is taking shape"}
            </strong>
            <p>
              {nextPiece.targetFunded
                ? "The last piece waits for verified goal completion."
                : `$${formatUsdc(nextPiece.remainingRaw)} USDC to the next whole piece. Smaller deposits count too.`}
            </p>
          </div>
          <div
            className="next-piece-meter"
            role="progressbar"
            aria-label="Funding toward the next piece"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={nextPiece.fractionBasisPoints / 100}
          >
            <i
              style={{
                transform: `scaleX(${nextPiece.fractionBasisPoints / 10000})`,
              }}
            />
          </div>
        </div>
      )}
      <div className="stage-tools">
        <div className="rotate-tools">
          <IconButton
            label="Rotate build left"
            onClick={() => setTurn((value) => value - 1)}
          >
            <ChevronLeft size={17} />
          </IconButton>
          <span>
            <Move size={13} />
            Turn and tilt
          </span>
          <IconButton
            label="Rotate build right"
            onClick={() => setTurn((value) => value + 1)}
          >
            <ChevronRight size={17} />
          </IconButton>
          <IconButton label="Tilt build up" onClick={() => setTilt(value => value - 1)}><ChevronLeft size={17} style={{transform:"rotate(90deg)"}} /></IconButton>
          <IconButton label="Tilt build down" onClick={() => setTilt(value => value + 1)}><ChevronRight size={17} style={{transform:"rotate(90deg)"}} /></IconButton>
        </div>
        <div className="stage-tools-right">
          <Button variant="quiet" className="turn-button" aria-pressed={freeOrbit} onClick={() => setFreeOrbit(value => !value)}><Move size={16} />{freeOrbit ? "Done rotating" : "Rotate freely"}</Button>
          <Button
            variant="quiet"
            className="turn-button"
            disabled={reducedMotion}
            title={
              reducedMotion
                ? "Use drag or rotation arrows with reduced motion."
                : undefined
            }
            onClick={() =>
              setSpin((value) => ({ id: value.id + 1, run: !spinning }))
            }
          >
            <RotateCcw size={16} />
            {spinning ? "Stop rotation" : "Rotate 360°"}
          </Button>
          <IconButton
            label="Reset build view"
            onClick={() => setReset((value) => value + 1)}
          >
            <RotateCcw size={16} />
          </IconButton>
          <IconButton
            label={sound ? "Mute assembly sound" : "Enable assembly sound"}
            aria-pressed={sound}
            onClick={() => {
              setAudioEnabled(!sound);
              if (!sound) void unlockAudio();
              setSound((value) => !value);
            }}
          >
            {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </IconButton>
        </div>
      </div>
      <div className="sr-only" aria-live="polite">
        {!active &&
          `${displayCount} of 100 pieces assembled. ${preview ? "Preview only." : achieved ? "Goal achieved." : ""}`}
      </div>
    </section>
  );
}
