import type { GoalDTO } from "@nabungfi/shared/application";

/** List metadata carries no financial authority; hydrate each goal from its detail read. */
export async function readGoalSnapshots(metadata: GoalDTO[], read: (id: string) => Promise<GoalDTO>, selectedId?: string | null): Promise<GoalDTO[]> {
  const result = metadata.map(goal => ({ ...goal, chainState: null, chainStatus: "unavailable" as const })) as GoalDTO[];
  const order = metadata.map((_, index) => index).sort((a, b) => Number(metadata[b]?.id === selectedId) - Number(metadata[a]?.id === selectedId));
  let cursor = 0;
  const worker = async () => {
    while (cursor < order.length) {
      const index = order[cursor++]!;
      const original = metadata[index]!;
      try {
        const detail = await read(original.id);
        if (detail.id !== original.id || detail.goalId !== original.goalId || detail.targetRaw !== original.targetRaw || detail.binding.owner.solana !== original.binding.owner.solana || detail.binding.owner.evm.toLowerCase() !== original.binding.owner.evm.toLowerCase()) throw new Error("Goal detail identity differs");
        result[index] = detail;
      } catch { /* Keep this goal's metadata; a failed or mismatched read cannot reuse a stale balance. */ }
    }
  };
  await Promise.all(Array.from({length: Math.min(2, metadata.length)}, worker));
  return result;
}
