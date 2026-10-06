import type { GoalDTO } from "@nabungfi/shared/application";

const sameIdentity = (a:GoalDTO,b:GoalDTO) => a.id === b.id && a.goalId === b.goalId && a.targetRaw === b.targetRaw && a.binding.owner.solana === b.binding.owner.solana && a.binding.owner.evm.toLowerCase() === b.binding.owner.evm.toLowerCase();

/** Preserve layout during a refresh. Financial actions stay blocked until the detail read finishes. */
export function retainGoalPresentation(metadata:GoalDTO[], prior:GoalDTO[]):GoalDTO[] {
  return metadata.map(goal => {
    const old = prior.find(candidate => sameIdentity(goal,candidate));
    return old ? {...goal,chainState:old.chainState,chainStatus:old.chainStatus} : goal;
  });
}

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
        if (!sameIdentity(detail,original)) throw new Error("Goal detail identity differs");
        result[index] = detail;
      } catch { /* Keep this goal's metadata; a failed or mismatched read cannot reuse a stale balance. */ }
    }
  };
  await Promise.all(Array.from({length: Math.min(2, metadata.length)}, worker));
  return result;
}
