import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ArrowRight, Box, LockKeyhole, Check, Plus } from "./icons";
import { Button, IconButton, Logo, WorkshopBoundary } from "./ui";
import { GoalIllustration } from "./GoalIllustration";
import type { WorkshopModel } from "./goal-models";
import { BuildingMark } from "./BuildingMark";
import { ChainStory } from "./ChainStory";
import { useLandingMotion } from "./useLandingMotion";
import "./landing.css";

const Workshop = lazy(() => import("./CarWorkshop"));
const models = [
  { id: "car", label: "A new car" },
  { id: "laptop", label: "A better laptop" },
  { id: "house", label: "A home" },
] as const;
export default function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [paused, setPaused] = useState(false);
  const motionDisabled = reducedMotion || paused;
  const refreshMotion = useLandingMotion(root, motionDisabled);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const [model, setModel] = useState<WorkshopModel>("car");
  const [previewMode, setPreviewMode] = useState<
    "poster" | "explore" | "build"
  >("poster");
  return (
    <div
      ref={root}
      className="landing"
      data-motion={motionDisabled ? "reduced" : "full"}
    >
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="landing-header">
        <div className="landing-reading-track" aria-hidden="true">
          <div className="landing-reading-progress" />
        </div>
        <a className="brand-link" href="/" aria-label="NabungFi home">
          <Logo />
        </a>
        <nav aria-label="Website navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#questions">Questions</a>
        </nav>
        <IconButton
          label={
            reducedMotion
              ? "Motion reduced by your device setting"
              : paused
                ? "Enable page motion"
                : "Pause page motion"
          }
          disabled={reducedMotion}
          aria-pressed={paused}
          onClick={() => setPaused((value) => !value)}
        >
          <Box size={20} />
        </IconButton>
        <a className="button button--build" href="/app">
          Open app
          <ArrowRight size={18} />
        </a>
      </header>
      <main id="main-content" tabIndex={-1}>
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <h1 aria-label="Build what you’re saving for.">
              {["Build", "what", "you’re", "saving", "for."].map((word, i) => (
                <span className="hero-word-frame" key={word}>
                  <span className="hero-word" aria-hidden="true">
                    {word}
                  </span>
                  {i < 4 ? " " : ""}
                </span>
              ))}
            </h1>
            <p>
              Your next car. A laptop for work. A place of your own. Turn a
              savings goal into something you can see taking shape, one block at
              a time.
            </p>
            <div className="landing-actions">
              <a className="button button--build" href="/app">
                Start a goal
                <Plus size={18} />
              </a>
              <a className="landing-text-link" href="#how-it-works">
                See how it works
                <ArrowRight size={18} />
              </a>
            </div>
            <p className="landing-release">
              <Box size={18} />
              Multichain USDC savings · Available on testnet
            </p>
          </div>
          <div className="landing-preview">
            <div className="landing-preview-heading">
              <span>
                <Box size={24} />
                Your goal, in pieces
              </span>
              <span className="preview-label">Build preview</span>
            </div>
            <div className="landing-model-choices" aria-label="Preview a goal">
              {models.map((choice) => (
                <button
                  type="button"
                  key={choice.id}
                  aria-pressed={model === choice.id}
                  onClick={() => setModel(choice.id)}
                >
                  {choice.label}
                </button>
              ))}
            </div>
            {previewMode !== "poster" ? (
              <WorkshopBoundary>
                <Suspense
                  fallback={
                    <div className="landing-poster">
                      <GoalIllustration model={model} />
                      <p role="status">Opening the 3D build…</p>
                    </div>
                  }
                >
                  <Workshop
                    key={model}
                    goalId={`landing-preview:${model}`}
                    model={model}
                    funded={100}
                    achieved={false}
                    reducedMotion={motionDisabled}
                    introBuild={previewMode === "build"}
                    preview
                  />
                </Suspense>
              </WorkshopBoundary>
            ) : (
              <>
                <div className="landing-poster">
                  <GoalIllustration model={model} />
                </div>
                <div className="landing-preview-bottom">
                  <p>
                    A goal becomes a 100-piece build.
                    <small>Example artwork. No funds are deposited.</small>
                  </p>
                  <div className="landing-preview-actions">
                    <Button
                      variant="primary"
                      onClick={() => setPreviewMode("explore")}
                    >
                      Explore 360°
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setPreviewMode("build")}
                    >
                      Try a build
                      <ArrowRight size={18} />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
        <section
          className="landing-chains"
          aria-label="Supported test networks"
        >
          <span>Available on testnet</span>
          <div>
            <span>Solana Devnet</span>
            <span>Base Sepolia</span>
            <span>Arbitrum Sepolia</span>
            <span>Ethereum Sepolia</span>
          </div>
        </section>
        <ChainStory />
        <section id="how-it-works" className="landing-explanation">
          <div>
            <h2>
              Small steps.
              <br />
              Something worth building.
            </h2>
            <p>
              Give each goal its own target. Your savings can stay on multiple
              chains while their progress contributes to the same build.
            </p>
            <a className="landing-text-link" href="/app">
              Make room for your next goal
              <ArrowRight size={18} />
            </a>
          </div>
          <ol className="landing-steps">
            <li>
              <span className="step-number">1</span>
              <div>
                <h3>Choose what you’re building toward</h3>
                <p>
                  Name your goal, set a USDC target and choose a model. Your
                  car, laptop and house each have their own savings.
                </p>
              </div>
            </li>
            <li>
              <span className="step-number">2</span>
              <div>
                <h3>Save, then snap pieces into place</h3>
                <p>
                  Add USDC from your selected chains. Each 1% funds another
                  piece; smaller deposits still contribute toward the next one.
                </p>
              </div>
            </li>
            <li>
              <span className="step-number">3</span>
              <div>
                <h3>Reach the target. Finish the build.</h3>
                <p>
                  Once completion is verified across your vaults, claim the
                  savings on each chain. Another goal’s balance never unlocks
                  this one.
                </p>
              </div>
            </li>
          </ol>
        </section>
        <section className="landing-commitment">
          <div className="commitment-icon">
            <LockKeyhole size={32} />
          </div>
          <div>
            <h2>A goal you commit to.</h2>
            <p>
              Deposits stay locked until that goal reaches its target and
              completion reaches its vaults. If the target is never reached, the
              funds remain locked. Choose a goal and an amount you are
              comfortable committing.
            </p>
          </div>
          <span>
            <Check size={18} />
            Clear before you save
          </span>
        </section>
        <section id="questions" className="landing-faq">
          <div>
            <h2>A few things to know.</h2>
            <p>Understand the build before you start.</p>
          </div>
          <div>
            <details onToggle={refreshMotion}>
              <summary>Is this using real money?</summary>
              <p>
                This release uses testnet USDC and testnet gas tokens. It
                connects to deployed testnet contracts and is not a mainnet
                launch.
              </p>
            </details>
            <details onToggle={refreshMotion}>
              <summary>Can I withdraw before the target?</summary>
              <p>
                No. Each goal is a commitment: deposits remain locked until its
                target is reached and completion is verified. There is no
                time-based unlock.
              </p>
            </details>
            <details onToggle={refreshMotion}>
              <summary>Do my savings earn yield?</summary>
              <p>
                Yield integrations are planned. Yield is not active in the
                current release; the vaults currently hold cash USDC.
              </p>
            </details>
            <details onToggle={refreshMotion}>
              <summary>Are my tokens bridged into one chain?</summary>
              <p>
                No. Savings remain in the vault on each chain. Cross-chain
                messages coordinate the goal’s progress and completion; claims
                happen separately on each chain.
              </p>
            </details>
            <details onToggle={refreshMotion}>
              <summary>Can I have more than one savings goal?</summary>
              <p>
                Yes. Create separate goals for a car, laptop, house or something
                else. Each has its own target, balances, progress and claims.
              </p>
            </details>
          </div>
        </section>
        <section className="landing-finish">
          <BuildingMark />
          <h2>What will you build next?</h2>
          <a className="button button--build" href="/app">
            Open your workshop
            <ArrowRight size={18} />
          </a>
        </section>
      </main>
      <footer className="landing-footer">
        <Logo />
        <span>Multichain savings, one piece at a time.</span>
        <a
          href="https://github.com/EndPx/nabungfi"
          target="_blank"
          rel="noreferrer"
        >
          View source
        </a>
        <a href="/?demo=1">Local demo</a>
      </footer>
    </div>
  );
}
