export type BuildFinishKind = "progress" | "goal";

export function buildFinishKind(built: number, fullCompletionAllowed: boolean): BuildFinishKind {
  if (!Number.isInteger(built) || built < 0 || built > 100) throw new Error("Invalid build count");
  return built === 100 && fullCompletionAllowed ? "goal" : "progress";
}

export const BUILD_FINISH_FILES = {progress:"build-progress.wav",goal:"goal-complete.wav"} as const;
