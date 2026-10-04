// Posters are captured from the same procedural renderer as the live models.
// Savings detail renders the live interactive model separately.
import { MODEL_POSTER_REVISION } from "./brick-details";
export function GoalIllustration({
  model,
  compact = false,
  priority = false,
}: {
  model: string;
  compact?: boolean;
  priority?: boolean;
}) {
  const key = ["car", "laptop", "house", "custom"].includes(model)
    ? model
    : "custom";
  return (
    <div
      className={`goal-illustration goal-art--${key} ${compact ? "goal-illustration--compact" : ""}`}
      aria-hidden="true"
    >
      <img
        src={`/models/${key}.jpg?revision=${MODEL_POSTER_REVISION}`}
        width={640}
        height={520}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        alt=""
      />
    </div>
  );
}
