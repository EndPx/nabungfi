import {
  Component,
  memo,
  useCallback,
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
  Check,
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
  MeshStandardMaterial,
  type BufferGeometry,
  type Group,
} from "three";
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
};

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
const studGeometry = new CylinderGeometry(0.076, 0.078, 0.048, 12);
function geometryFor(piece: CarPiece) {
  const key = `${piece.kind}:${piece.size.join(":")}`;
  let geometry = geometryCache.get(key);
  if (!geometry) {
    geometry =
      piece.kind === "tire" || piece.kind === "hub"
        ? new CylinderGeometry(
            piece.size[0],
            piece.size[1],
            piece.size[2],
            piece.kind === "tire" ? 28 : 16,
          )
        : new RoundedBoxGeometry(
            piece.size[0],
            piece.size[1],
            piece.size[2],
            2,
            0.035,
          );
    geometryCache.set(key, geometry);
  }
  return geometry;
}
function materialFor(piece: CarPiece, ghost: boolean) {
  const key = `${piece.color}:${piece.kind}:${ghost}`;
  let material = materialCache.get(key);
  if (!material) {
    material = new MeshStandardMaterial({
      color: ghost ? "#c8ccba" : piece.color,
      transparent: ghost || piece.kind === "glass",
      opacity: ghost ? 0.09 : piece.kind === "glass" ? 0.72 : 1,
      roughness: piece.kind === "glass" ? 0.15 : 0.3,
      metalness: piece.kind === "hub" ? 0.35 : 0.04,
      depthWrite: !ghost,
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
      <mesh
        geometry={geometry}
        material={material}
        dispose={null}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow={!ghost}
        receiveShadow
      />
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
      {piece.studs &&
        !ghost &&
        [-0.22, 0.22]
          .filter((value) => Math.abs(value) < piece.size[2] / 2)
          .map((z) => (
            <mesh
              key={z}
              position={[0, piece.size[1] / 2 + 0.022, z]}
              castShadow
              geometry={studGeometry}
              material={material}
              dispose={null}
            ></mesh>
          ))}
    </>
  );
});

function Car({
  pieces,
  built,
  sequence,
  reducedMotion,
  sound,
  onPiece,
  onComplete,
}: {
  pieces: readonly CarPiece[];
  built: number;
  sequence: BuildSequence | null;
  reducedMotion: boolean;
  sound: boolean;
  onPiece: (count: number) => void;
  onComplete: () => void;
}) {
  const groups = useRef<(Group | null)[]>([]);
  const { invalidate } = useThree();
  const callback = useRef({ onPiece, onComplete, sound });
  useEffect(() => {
    callback.current = { onPiece, onComplete, sound };
  }, [onPiece, onComplete, sound]);

  useEffect(() => {
    if (!sequence) return;
    const { from, to } = sequence;
    let completed = false;
    if (reducedMotion) {
      if (callback.current.sound) playBuildFinish(to - from);
      callback.current.onPiece(to);
      callback.current.onComplete();
      invalidate();
      return;
    }
    const timeline = gsap.timeline({
      onUpdate: invalidate,
      onComplete: () => {
        completed = true;
        if (callback.current.sound) playBuildFinish(to - from);
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
    return () => {
      timeline.kill();
      if (!completed) stopBuildAudio();
    };
  }, [sequence, reducedMotion, invalidate, pieces]);

  return (
    <group position={[0, 0.06, 0]}>
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
  reset,
  spin,
  onSpinning,
  reducedMotion,
  model,
}: {
  turn: number;
  reset: number;
  spin: { id: number; run: boolean };
  onSpinning: (value: boolean) => void;
  reducedMotion: boolean;
  model: WorkshopModel;
}) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const previousTurn = useRef(turn);
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
    const control = controls.current;
    if (!control) return;
    control.addEventListener("start", cancelSpin);
    return () => control.removeEventListener("start", cancelSpin);
  }, [cancelSpin]);
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
      duration: 3.2,
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
      minPolarAngle={0.3}
      maxPolarAngle={Math.PI / 2.2}
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
      return localStorage.getItem("nabungfi:assembly-sound") === "on";
    } catch {
      return false;
    }
  });
  const [turn, setTurn] = useState(0);
  const [reset, setReset] = useState(0);
  const [spin, setSpin] = useState({ id: 0, run: false });
  const [spinning, setSpinning] = useState(false);
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

  useEffect(() => () => stopBuildAudio(), []);

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

  const start = (replay = false) => {
    if (active || !funded) return;
    stopBuildAudio();
    if (sound) void unlockAudio();
    const from = replay ? 0 : cursor;
    setBuilt(from);
    setSequence({ key: Date.now(), from, to: funded });
  };

  return (
    <section
      className={`workshop ${achieved ? "workshop--complete" : ""}`}
      data-spinning={spinning ? "true" : "false"}
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
                : "Your sculpture"}{" "}
          / 100 pieces
        </span>
      </div>
      <div
        className="car-stage"
        aria-label={`Three dimensional ${model === "custom" ? "goal sculpture" : model} ${preview ? "preview" : "savings build"} with ${displayCount} of 100 pieces assembled. Drag to rotate, or use the rotation buttons below.`}
        role="img"
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
              <ambientLight intensity={1.35} />
              <hemisphereLight args={["#ffffff", "#b7ba9f", 1]} />
              <directionalLight
                position={[3, 8, 5]}
                intensity={3.2}
                castShadow
                shadow-mapSize={[1024, 1024]}
                shadow-normalBias={0.035}
              />
              <directionalLight
                position={[-5, 3, -3]}
                intensity={1.8}
                color="#f6f0dc"
              />
              <Car
                pieces={pieces}
                key={modelKey}
                built={cursor}
                sequence={validSequence}
                reducedMotion={reducedMotion}
                sound={sound}
                onPiece={setBuilt}
                onComplete={() => setSequence(null)}
              />
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
              <CameraControl
                turn={turn}
                reset={reset}
                spin={spin}
                onSpinning={setSpinning}
                reducedMotion={reducedMotion}
                model={model}
              />
            </Canvas>
          </Suspense>
        </SceneBoundary>
      </div>
      {!preview && (
        <div className="stage-side-note" aria-hidden="true">
          <span>Made of</span>
          <strong>small steps.</strong>
        </div>
      )}
      <div className="workshop-bottom">
        <div className="piece-counter">
          <span className="piece-icon">
            <Box size={21} />
          </span>
          <div>
            <strong>
              {displayCount}
              <span> / 100 pieces</span>
            </strong>
            <p>
              {active
                ? `Building ${pieces[Math.min(built, 99)].label.toLowerCase()}…`
                : unbuilt > 0
                  ? `${unbuilt} new ${unbuilt === 1 ? "piece is" : "pieces are"} ready to build`
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
          onClick={() => start(unbuilt === 0)}
          disabled={!funded || active}
        >
          {active ? (
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
            Drag to rotate 360°
          </span>
          <IconButton
            label="Rotate build right"
            onClick={() => setTurn((value) => value + 1)}
          >
            <ChevronRight size={17} />
          </IconButton>
        </div>
        <div className="stage-tools-right">
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
      {achieved && (
        <div className="completion-stamp">
          <Check size={14} />
          Built with commitment
        </div>
      )}
    </section>
  );
}
