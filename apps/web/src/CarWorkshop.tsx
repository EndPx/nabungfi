import {
  Component,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls, RoundedBox } from "@react-three/drei";
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
} from "lucide-react";
import { PCFShadowMap, type Group } from "three";
import { CAR_PIECES, type CarPiece } from "./car-model";
import {
  playBuildFinish,
  playBuildStep,
  setAudioEnabled,
  stopBuildAudio,
  unlockAudio,
} from "./sound";
import { Button, IconButton } from "./ui";

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
}

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

function PieceGeometry({
  piece,
  ghost = false,
}: {
  piece: CarPiece;
  ghost?: boolean;
}) {
  const material = (
    <meshStandardMaterial
      color={ghost ? "#c8ccba" : piece.color}
      transparent={ghost || piece.kind === "glass"}
      opacity={ghost ? 0.09 : piece.kind === "glass" ? 0.72 : 1}
      roughness={piece.kind === "glass" ? 0.15 : 0.3}
      metalness={piece.kind === "hub" ? 0.35 : 0.04}
      depthWrite={!ghost}
    />
  );
  if (piece.kind === "tire" || piece.kind === "hub")
    return (
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow={!ghost} receiveShadow>
        <cylinderGeometry
          args={[
            piece.size[0],
            piece.size[1],
            piece.size[2],
            piece.kind === "tire" ? 28 : 16,
          ]}
        />
        {material}
      </mesh>
    );
  return (
    <>
      <RoundedBox
        args={piece.size}
        radius={0.035}
        smoothness={2}
        castShadow={!ghost}
        receiveShadow
      >
        {material}
      </RoundedBox>
      {piece.studs &&
        !ghost &&
        [-0.22, 0.22]
          .filter((value) => Math.abs(value) < piece.size[2] / 2)
          .map((z) => (
            <mesh
              key={z}
              position={[0, piece.size[1] / 2 + 0.022, z]}
              castShadow
            >
              <cylinderGeometry args={[0.076, 0.078, 0.048, 12]} />
              <meshStandardMaterial color={piece.color} roughness={0.34} />
            </mesh>
          ))}
    </>
  );
}

function Car({
  built,
  sequence,
  reducedMotion,
  sound,
  onPiece,
  onComplete,
}: {
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
      const piece = CAR_PIECES[index];
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
  }, [sequence, reducedMotion, invalidate]);

  return (
    <group position={[0, 0.06, 0]}>
      {CAR_PIECES.map((piece) => (
        <group key={piece.id}>
          <group
            position={piece.position}
            rotation={piece.rotation}
            visible={piece.id >= built && !sequence}
          >
            <PieceGeometry piece={piece} ghost />
          </group>
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
  reducedMotion,
}: {
  turn: number;
  reset: number;
  reducedMotion: boolean;
}) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const previousTurn = useRef(turn);
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    camera.zoom = Math.min(82, size.width / 7.4);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, invalidate]);
  useEffect(() => {
    const control = controls.current;
    if (!control) return;
    const delta = turn - previousTurn.current;
    previousTurn.current = turn;
    if (delta)
      control.setAzimuthalAngle(
        control.getAzimuthalAngle() + (delta * Math.PI) / 8,
      );
    control.update();
  }, [turn]);
  useEffect(() => {
    controls.current?.reset();
  }, [reset]);
  return (
    <OrbitControls
      ref={controls}
      target={[0, 0.7, 0]}
      enablePan={false}
      enableZoom={false}
      enableDamping={!reducedMotion}
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
}: WorkshopProps) {
  const [built, setBuilt] = useState(() => readBuilt(goalId, funded));
  const [sequence, setSequence] = useState<BuildSequence | null>(null);
  const [sound, setSound] = useState(() => {
    try {
      return localStorage.getItem("nabungfi:assembly-sound") === "on";
    } catch {
      return false;
    }
  });
  const [turn, setTurn] = useState(0);
  const [reset, setReset] = useState(0);
  const cursor = Math.min(built, funded);
  const unbuilt = Math.max(0, funded - cursor);
  const validSequence = sequence && sequence.to === funded ? sequence : null;
  const active = validSequence !== null;
  const displayCount = cursor;
  const modelKey = `${goalId}:${funded}`;

  // Parent keys this workshop by goal + funded count. A funding change destroys
  // an older animation before it can draw or announce an unfunded piece.
  useEffect(() => {
    setAudioEnabled(sound);
    try {
      localStorage.setItem("nabungfi:assembly-sound", sound ? "on" : "off");
    } catch {
      /* Optional sound preference only. */
    }
  }, [sound]);

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
      aria-label="Your savings build"
    >
      <div className="workshop-top">
        <span className="stage-label">
          <span className="status-dot" />
          {achieved ? "Goal completed" : "A little closer, piece by piece"}
        </span>
        <span className="model-label">Roadster / 100 pieces</span>
      </div>
      <div
        className="car-stage"
        aria-label={`Three dimensional car with ${displayCount} of 100 funded pieces assembled. Drag to rotate, or use the rotation buttons below.`}
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
              camera={{ position: [6.7, 5, 7.5], zoom: 73, near: 0.1, far: 60 }}
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
                reducedMotion={reducedMotion}
              />
            </Canvas>
          </Suspense>
        </SceneBoundary>
      </div>
      <div className="stage-side-note" aria-hidden="true">
        <span>Made of</span>
        <strong>small steps.</strong>
      </div>
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
                ? `Building ${CAR_PIECES[Math.min(built, 99)].label.toLowerCase()}…`
                : unbuilt > 0
                  ? `${unbuilt} new ${unbuilt === 1 ? "piece is" : "pieces are"} ready to build`
                  : achieved
                    ? "You built something worth saving for."
                    : "Every whole step brings it to life."}
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
              Replay build
            </>
          )}
        </Button>
      </div>
      <div className="stage-tools">
        <div className="rotate-tools">
          <IconButton
            label="Rotate car left"
            onClick={() => setTurn((value) => value - 1)}
          >
            <ChevronLeft size={17} />
          </IconButton>
          <span>
            <Move size={13} />
            Drag to explore
          </span>
          <IconButton
            label="Rotate car right"
            onClick={() => setTurn((value) => value + 1)}
          >
            <ChevronRight size={17} />
          </IconButton>
        </div>
        <div className="stage-tools-right">
          <IconButton
            label="Reset car view"
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
          `${displayCount} of 100 pieces assembled. ${achieved ? "Goal achieved." : ""}`}
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
