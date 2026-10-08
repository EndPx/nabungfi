import { test } from "node:test";
import assert from "node:assert/strict";
import type { GoalDTO } from "@nabungfi/shared/application";
import { clearGoalSetup, goalSetupStage, restoreGoalSetup, saveGoalSetup } from "../src/goal-setup";

function example(): GoalDTO {
  return { id: "example-goal", goalId: "0x11", name: "Example laptop", targetRaw: "300000", chainStatus: "unprovisioned",
    binding: { initialized: false, participants: [{ network: "base" }, { network: "ethereum" }] },
    chainState: { goalId: "0x11", targetRaw: "300000", linked: false,
      positions: ["solana", "base", "ethereum"].map(network => ({ network, initialized: false, registered: false, linked: false })) },
  } as unknown as GoalDTO;
}
function confirm(goal: GoalDTO, index: number) {
  Object.assign(goal.binding.participants[index]!, { vault: `vault-${index}`, configHash: `config-${index}`, creationHash: `receipt-${index}` });
  goal.chainState!.positions.find(position => position.network === goal.binding.participants[index]!.network)!.initialized = true;
}

test("setup follows only selected EVM participants, then Solana, then real registration", () => {
  const goal = example();
  assert.deepEqual(goalSetupStage(goal), { kind: "wallet", action: "create-vault", network: "base" });
  confirm(goal, 0);
  assert.deepEqual(goalSetupStage(goal), { kind: "wallet", action: "create-vault", network: "ethereum" });
  confirm(goal, 1);
  assert.deepEqual(goalSetupStage(goal), { kind: "wallet", action: "initialize", network: "solana" });
  goal.binding.initialized = true; goal.chainStatus = "available";
  assert.deepEqual(goalSetupStage(goal), { kind: "link" });
  goal.chainState!.linked = true;
  assert.deepEqual(goalSetupStage(goal), { kind: "link" });
  goal.chainState!.positions.forEach(position => Object.assign(position, { initialized: true, registered: true, linked: true }));
  assert.deepEqual(goalSetupStage(goal), { kind: "ready" });
});

test("partial receipt evidence and unknown initialization are verified rather than recreated", () => {
  const goal = example();
  goal.binding.participants[0]!.vault = "original-vault";
  assert.deepEqual(goalSetupStage(goal), { kind: "verify" });
  confirm(goal, 0); confirm(goal, 1);
  goal.chainState!.positions[0]!.initialized = true;
  assert.deepEqual(goalSetupStage(goal), { kind: "verify" });
});

test("unavailable, wrong-goal and wrong-target reads cannot advance setup", () => {
  for (const kind of ["unavailable", "wrong-goal", "wrong-target"]) {
    const goal = example();
    if (kind === "unavailable") goal.chainStatus = "unavailable";
    if (kind === "wrong-goal") goal.chainState!.goalId = "other-goal";
    if (kind === "wrong-target") goal.chainState!.targetRaw = "999999";
    assert.deepEqual(goalSetupStage(goal), { kind: "verify" });
  }
});

test("setup markers are owner-scoped and reload restores a pause, never automatic signing", () => {
  const records = new Map<string, string>();
  const storage = { getItem: (key: string) => records.get(key) ?? null, setItem: (key: string, value: string) => { records.set(key, value); }, removeItem: (key: string) => { records.delete(key); } };
  const intent = { userId: "alice", goalId: "original-goal", name: "Laptop", paused: false };
  saveGoalSetup(storage, intent);
  assert.equal(restoreGoalSetup(storage, "bob"), null);
  assert.deepEqual(restoreGoalSetup(storage, "alice"), { ...intent, paused: true });
  storage.setItem("nabungfi:goal-setup:v1:bob", JSON.stringify(intent));
  assert.throws(() => restoreGoalSetup(storage, "bob"), /does not match/);
  clearGoalSetup(storage, "alice");
  assert.equal(restoreGoalSetup(storage, "alice"), null);
});
