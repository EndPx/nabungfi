import type { AppNetwork, GoalDTO } from "@nabungfi/shared/application";

export type GoalSetupStage = { kind: "verify" | "link" | "ready" } |
  { kind: "wallet"; action: "create-vault" | "initialize"; network: AppNetwork };
export interface GoalSetupIntent { userId: string; goalId: string; name: string; paused: boolean }

/** Selection comes from the immutable backend binding, never a second client chain list. */
export function goalSetupStage(goal: GoalDTO): GoalSetupStage {
  const state = goal.chainState;
  if (!state || goal.chainStatus === "unavailable" || state.goalId !== goal.goalId || state.targetRaw !== goal.targetRaw)
    return { kind: "verify" };
  for (const participant of goal.binding.participants) {
    if (participant.vault && participant.configHash && participant.creationHash) continue;
    if (participant.vault || participant.configHash || participant.creationHash) return { kind: "verify" };
    return { kind: "wallet", action: "create-vault", network: participant.network };
  }
  if (!goal.binding.initialized) {
    if (state.positions.some(position => position.network === "solana" && position.initialized)) return { kind: "verify" };
    return { kind: "wallet", action: "initialize", network: "solana" };
  }
  const selected: AppNetwork[] = ["solana", ...goal.binding.participants.map(participant => participant.network)];
  return { kind: goal.chainStatus === "available" && state.linked && selected.every(network =>
    state.positions.some(position => position.network === network && position.initialized && position.registered && position.linked),
  ) ? "ready" : "link" };
}

const key = (userId: string) => `nabungfi:goal-setup:v1:${userId}`;
export function saveGoalSetup(storage: Pick<Storage, "setItem">, intent: GoalSetupIntent) {
  storage.setItem(key(intent.userId), JSON.stringify(intent));
}
export function restoreGoalSetup(storage: Pick<Storage, "getItem">, userId: string): GoalSetupIntent | null {
  const value = storage.getItem(key(userId));
  if (!value) return null;
  const intent = JSON.parse(value) as GoalSetupIntent;
  if (intent.userId !== userId || !/^[a-zA-Z0-9_-]{1,128}$/.test(intent.goalId) || typeof intent.name !== "string" || intent.name.length > 80)
    throw new Error("Saved goal setup does not match this account.");
  return { ...intent, paused: true };
}
export function clearGoalSetup(storage: Pick<Storage, "removeItem">, userId: string) { storage.removeItem(key(userId)); }
