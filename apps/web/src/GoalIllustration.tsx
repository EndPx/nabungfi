// Posters are captured from the same procedural renderer as the live models.
// Savings detail renders the live interactive model separately.
import { useState } from "react";
import { MODEL_POSTER_REVISION } from "./brick-details";
import { isGoalModel } from "@nabungfi/shared/application";
export function GoalIllustration({
  model,
  compact = false,
  priority = false,
  funded,
}: {
  model: string;
  compact?: boolean;
  priority?: boolean;
  /** Undefined previews a template; null means progress cannot be verified. */
  funded?: number | null;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const key = isGoalModel(model)
    ? model
    : "custom";
  const pieces = funded == null ? funded : Math.max(0, Math.min(100, Math.floor(funded)));
  const source = typeof pieces === "number" && pieces < 100
    ? `/models/progress-v1/${key}/${pieces}.jpg`
    : `/models/${key}.jpg?revision=${MODEL_POSTER_REVISION}`;
  const unavailable = funded === null || failedSource === source;
  return (
    <div
      className={`goal-illustration goal-art--${key} ${compact ? "goal-illustration--compact" : ""}`}
      aria-hidden="true"
      data-funded={funded === null ? "unavailable" : pieces}
    >
      {unavailable ? <span className="goal-preview-unavailable">{funded === null ? "Preview unavailable" : "Preview couldn’t load"}</span> : <img
        key={source}
        src={source}
        width={typeof pieces === "number" && pieces < 100 ? 480 : 640}
        height={typeof pieces === "number" && pieces < 100 ? 390 : 520}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        alt=""
        onError={() => setFailedSource(source)}
      />}
    </div>
  );
}
