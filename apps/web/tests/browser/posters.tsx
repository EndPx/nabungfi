// Deterministic visual asset renderer; no account, balances, API or wallet.
import { createRoot } from "react-dom/client";
import Workshop from "../../src/CarWorkshop";
import type { WorkshopModel } from "../../src/goal-models";
import { isGoalModel } from "@nabungfi/shared/application";
import "../../src/styles.css";
const requested = new URLSearchParams(location.search).get("model");
const model: WorkshopModel =
  isGoalModel(requested)
    ? requested
    : "car";
createRoot(document.getElementById("root")!).render(
  <>
    <style>{`.workshop{width:640px;border:0;border-radius:0}.car-stage{height:520px}.workshop-top,.stage-side-note{display:none}`}</style>
    <Workshop
      goalId={`poster:${model}`}
      model={model}
      funded={100}
      achieved={false}
      reducedMotion
      preview
    />
  </>,
);
