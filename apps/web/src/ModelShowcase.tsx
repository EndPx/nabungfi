import { lazy, Suspense, useState } from "react";
import type { WorkshopModel } from "./goal-models";
import { GOAL_TEMPLATES } from "@nabungfi/shared/application";
import { Button, Logo } from "./ui";
import "./live.css";
const Workshop = lazy(() => import("./CarWorkshop"));
export default function ModelShowcase() {
  const [model, setModel] = useState<WorkshopModel>("car");
  const [funded, setFunded] = useState(100);
  const [reducedMotion, setReducedMotion] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  return (
    <main className="live-main">
      <Logo />
      <div className="page-heading" style={{ marginTop: 32 }}>
        <div>
          <h1>Workshop visual checks</h1>
          <p>
            Visual QA harness. Piece counts here are examples, with no savings
            account or transactions.
          </p>
        </div>
      </div>
      <div className="live-form">
        <div className="live-actions">
          {([...GOAL_TEMPLATES.map(template=>template.id), "custom"] as WorkshopModel[]).map(
            (choice) => (
              <Button
                key={choice}
                variant={model === choice ? "build" : "secondary"}
                onClick={() => setModel(choice)}
              >
                {choice}
              </Button>
            ),
          )}
        </div>
        <label className="live-field">
          Example funded pieces
          <select
            value={funded}
            onChange={(event) => setFunded(Number(event.target.value))}
          >
            {[0, 1, 25, 50, 75, 100].map((count) => (
              <option key={count} value={count}>
                {count} pieces
              </option>
            ))}
          </select>
        </label>
        <label className="live-check">
          <input
            type="checkbox"
            checked={reducedMotion}
            onChange={(event) => setReducedMotion(event.target.checked)}
          />
          Reduce motion
        </label>
      </div>
      <Suspense fallback={<p role="status">Loading workshop…</p>}>
        <Workshop
          key={`${model}:${funded}`}
          model={model}
          goalId={`visual-check:${model}:${funded}`}
          funded={funded}
          achieved={funded === 100}
          reducedMotion={reducedMotion}
        />
      </Suspense>
    </main>
  );
}
