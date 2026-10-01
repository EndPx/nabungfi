import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import {
  clearPendingAction,
  persistPendingAction,
  readPendingAction,
  progressLabel,
  remainingLabel,
  requestState,
  RequestError,
  type Goal,
  type PendingAction,
} from "../src/api.ts";

const originalStorage = Object.getOwnPropertyDescriptor(
  globalThis,
  "localStorage",
);
const originalFetch = globalThis.fetch;
beforeEach(() => {
  const storage: Record<string, unknown> = {};
  Object.defineProperties(storage, {
    getItem: { value: (key: string) => storage[key] ?? null },
    setItem: {
      value: (key: string, value: string) => {
        storage[key] = value;
      },
    },
    removeItem: {
      value: (key: string) => {
        delete storage[key];
      },
    },
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalStorage)
    Object.defineProperty(globalThis, "localStorage", originalStorage);
  else Reflect.deleteProperty(globalThis, "localStorage");
});

function operation(requestId: string): PendingAction {
  return {
    requestId,
    action: "deposit",
    fields: { chain: "base", amount: "100" },
    goalId: "original-goal",
    signature: `deposit-${requestId}`,
  };
}

test("an independent tab cannot replace or clear an unresolved deposit", () => {
  const interrupted = operation("a-interrupted");
  const secondTab = operation("b-confirmed");
  persistPendingAction(interrupted);
  persistPendingAction(secondTab);
  clearPendingAction(secondTab.requestId);
  assert.deepEqual(readPendingAction(), interrupted);
  assert.equal(readPendingAction()?.goalId, "original-goal");
  assert.equal(readPendingAction()?.requestId, "a-interrupted");
  clearPendingAction(interrupted.requestId);
  assert.equal(readPendingAction(), null);
});

test("a lost HTTP response remains uncertain and can be replayed with its original identity", async () => {
  const pending = operation("request-lost-after-commit");
  persistPendingAction(pending);
  globalThis.fetch = async () => {
    throw new Error("Connection closed after remote commit");
  };
  await assert.rejects(
    requestState("/api/deposit", pending),
    (error: unknown) => error instanceof RequestError && !error.rejected,
  );
  assert.deepEqual(readPendingAction(), pending);
});

test("a malformed storage entry does not hide another recoverable request", () => {
  localStorage.setItem("nabungfi:unresolved-action:v1", "null");
  persistPendingAction(operation("valid-record"));
  assert.equal(readPendingAction()?.requestId, "valid-record");
  clearPendingAction("unrelated-record");
  assert.equal(readPendingAction()?.requestId, "valid-record");
});

test("definite API validation rejection differs from an unknown execution outcome", async () => {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ error: "Goal changed", code: "GOAL_CHANGED" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  await assert.rejects(
    requestState("/api/deposit", {}),
    (error: unknown) =>
      error instanceof RequestError &&
      error.rejected &&
      error.message === "Goal changed",
  );
});

test("an unmet target never rounds to 100 percent or zero remaining", () => {
  const goal = {
    target: "100.000000",
    balance: "99.999900",
    progress: 99.9999,
    achieved: false,
  } as Goal;
  assert.equal(progressLabel(goal), "99.9");
  assert.equal(remainingLabel(goal), "0.000100");
  assert.equal(progressLabel({ ...goal, achieved: true }), "100");
});
