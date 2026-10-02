import {
  Box,
  History,
  Wallet,
  Settings2,
  LockKeyhole,
  Plus,
  Check,
  ArrowRight,
  TriangleAlert,
} from "./icons";
import { lazy, Suspense, useState } from "react";
import { Button, Logo, PageHeading, WorkshopBoundary } from "./ui";
import { GoalIllustration } from "./GoalIllustration";
import type { WorkshopModel } from "./goal-models";
import "./live.css";
import "./design-showcase.css";
const Workshop = lazy(() => import("./CarWorkshop"));

export default function DesignShowcase() {
  const [previewModel, setPreviewModel] = useState<WorkshopModel | null>(null);
  return (
    <main className="system-page">
      <header className="system-header">
        <a href="/" className="brand-link">
          <Logo />
        </a>
        <a className="button button--secondary" href="/app">
          Open app
        </a>
      </header>
      <PageHeading
        title="One workshop. Every screen."
        description="NabungFi’s shared colors, block icons, typography and interface states. These are design examples, with no wallet actions."
      />
      <section className="system-section">
        <h2>The building palette</h2>
        <div className="system-swatches">
          {[
            ["Blue", "blue"],
            ["Yellow", "yellow"],
            ["Green", "green"],
          ].map(([name, color]) => (
            <div key={color}>
              <i className={`swatch-${color}`} />
              <strong>{name}</strong>
            </div>
          ))}
        </div>
        <p>
          Color brings the build to life. Ink text keeps every amount readable.
        </p>
      </section>
      <section className="system-section">
        <h2>A family of block icons</h2>
        <div className="system-icons">
          {[
            ["Goals", Box],
            ["Activity", History],
            ["Wallets", Wallet],
            ["Settings", Settings2],
            ["Locked", LockKeyhole],
            ["Add", Plus],
            ["Confirmed", Check],
            ["Continue", ArrowRight],
          ].map(([label, Icon]) => {
            const Glyph = Icon as typeof Box;
            return (
              <div key={String(label)}>
                <Glyph size={32} />
                <span>{String(label)}</span>
              </div>
            );
          })}
        </div>
      </section>
      <section className="system-section">
        <h2>Every goal has a build</h2>
        <div className="system-models">
          {(["car", "laptop", "house", "custom"] as WorkshopModel[]).map(
            (model) => (
              <button
                type="button"
                key={model}
                aria-label={`Preview ${model} in 3D`}
                aria-pressed={previewModel === model}
                onClick={() => setPreviewModel(model)}
              >
                <GoalIllustration model={model} />
                <span>{model}</span>
              </button>
            ),
          )}
        </div>
        <p>
          The original 3D builds keep their own colors and materials. Select a
          model to explore it.
        </p>
        {previewModel && (
          <div className="system-workshop">
            <WorkshopBoundary>
              <Suspense
                fallback={<p role="status">Opening the original 3D model…</p>}
              >
                <Workshop
                  key={previewModel}
                  goalId={`system-preview:${previewModel}`}
                  model={previewModel}
                  funded={100}
                  achieved={false}
                  reducedMotion={
                    matchMedia("(prefers-reduced-motion: reduce)").matches
                  }
                  preview
                />
              </Suspense>
            </WorkshopBoundary>
          </div>
        )}
      </section>
      <section className="system-section">
        <h2>Actions and states</h2>
        <div className="live-actions">
          <Button variant="build">
            <Plus size={18} />
            New goal
          </Button>
          <Button>Confirm in wallet</Button>
          <Button variant="secondary">Cancel</Button>
          <Button variant="quiet">View history</Button>
          <Button disabled>Unavailable</Button>
          <Button busy>Saving</Button>
        </div>
      </section>
      <section className="system-section">
        <h2>Clear fields and feedback</h2>
        <label className="live-field">
          Amount in USDC
          <input placeholder="100.00" inputMode="decimal" />
          <small>Up to six decimal places.</small>
        </label>
        <p className="live-error">
          <TriangleAlert size={18} /> Enter a positive amount.
        </p>
        <div className="live-actions">
          <span className="live-state-badge">
            <LockKeyhole size={16} />
            Saving
          </span>
          <span className="status-badge status-badge--success">
            <Check size={16} />
            Goal achieved
          </span>
        </div>
      </section>
      <section className="system-section">
        <h2>Readable by design</h2>
        <p className="system-amount">$1,250.000001</p>
        <p>
          Outfit for goals and balances. Work Sans for everything you need to
          read and do. Keyboard focus, disabled states and exact amounts stay
          visible across all pages.
        </p>
      </section>
    </main>
  );
}
