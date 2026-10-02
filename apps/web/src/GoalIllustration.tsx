// Posters are captured from the unchanged original 3D models.
// Savings detail renders the live interactive model separately.
export function GoalIllustration({
  model,
  compact = false,
}: {
  model: string;
  compact?: boolean;
}) {
  const key = ["car", "laptop", "house", "custom"].includes(model)
    ? model
    : "custom";
  return (
    <div
      className={`goal-illustration goal-art--${key} ${compact ? "goal-illustration--compact" : ""}`}
      aria-hidden="true"
    >
      <img src={`/models/${key}.jpg`} width={640} height={520} alt="" />
    </div>
  );
}
