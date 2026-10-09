// Deterministic visual asset renderer; no account, balances, API or wallet.
import { createRoot } from "react-dom/client";
import { useState } from "react";
import Workshop from "../../src/CarWorkshop";
import type { WorkshopModel } from "../../src/goal-models";
import { isGoalModel } from "@nabungfi/shared/application";
import "../../src/styles.css";
const requested = new URLSearchParams(location.search).get("model");
const model: WorkshopModel =
  isGoalModel(requested)
    ? requested
    : "car";
function PosterCapture() {
  const params = new URLSearchParams(location.search);
  const progress = params.has("progress");
  const [funded, setFunded] = useState(progress ? 0 : 100);
  return (
  <>
    <style>{`.workshop{width:${progress ? 480 : 640}px;border:0;border-radius:0}.car-stage{height:${progress ? 390 : 520}px}.workshop-top,.stage-side-note{display:none}`}</style>
    <Workshop
      goalId={`poster:${model}`}
      model={model}
      funded={funded}
      achieved={false}
      reducedMotion
      preview
      poster={progress}
    />
    {progress && <input aria-label="Funded parts" type="number" value={funded} min={0} max={100} onChange={event => setFunded(Number(event.target.value))} />}
  </>
  );
}
createRoot(document.getElementById("root")!).render(<PosterCapture />);
