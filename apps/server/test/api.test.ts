import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { DemoStore } from "../src/store.js";
import { demoServer } from "../src/server.js";

test("API concurrency, persistent replay and actual lifecycle share one exact ledger", async () => {
  const dir = await mkdtemp(join(tmpdir(), "nabungfi-test-")); const file = join(dir, "state.json");
  const store = await DemoStore.open(file); const server = demoServer(store); server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string"); const base = `http://127.0.0.1:${address.port}`;
  const post = async (path: string, payload: Record<string, unknown>, origin?: string) => {
    const r = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify({ goalId: store.view().goal.id, ...payload }) });
    return { status: r.status, body: await r.json() as any };
  };
  try {
    const deposit = { chain: "solana", amount: "6320", requestId: "parallel-deposit-001" };
    const results = await Promise.all(Array.from({ length: 8 }, () => post("/api/deposit", deposit)));
    assert.ok(results.every(x => x.status === 200)); assert.equal(store.view().goal.balance, "10000.000000");
    assert.equal((await post("/api/claim", { chain: "solana", requestId: "too-early-claim" })).body.code, "GOAL_LOCKED");
    assert.equal((await post("/api/prepare", { requestId: "prepare-completion" })).body.goal.status, "ready");
    assert.equal((await post("/api/finalize", { requestId: "finalize-completion" })).body.goal.achieved, true);
    await post("/api/claim", { chain: "base", requestId: "base-claim-001" });
    await post("/api/claim", { chain: "solana", requestId: "solana-claim-001" });
    assert.equal(store.view().goal.status, "closed");
    const reopened = await DemoStore.open(file); assert.equal(reopened.view().goal.status, "closed");
    await reopened.apply({ type: "claim", chain: "base" }, "base-claim-001");
    assert.equal(reopened.view().goal.balance, "0.000000");
    assert.equal((await post("/api/demo/reset", { requestId: "remote-reset-test" }, "https://example.com")).status, 403);
    const oldGoalId = store.view().goal.id;
    assert.equal((await post("/api/demo/reset", { requestId: "local-reset-test" })).status, 200);
    assert.notEqual(store.view().goal.id, oldGoalId);
    const stale = await post("/api/deposit", { chain: "base", amount: "5", goalId: oldGoalId, requestId: "stale-tab-new-deposit" });
    assert.equal(stale.body.code, "GOAL_CHANGED"); assert.equal(store.view().goal.balance, "3680.000000");
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(dir, { recursive: true }); }
});
test("corrupt saved state fails closed rather than silently replacing a ledger", async () => {
  const dir = await mkdtemp(join(tmpdir(), "nabungfi-corrupt-")); const file = join(dir, "state.json");
  try { await writeFile(file, "{broken"); await assert.rejects(() => DemoStore.open(file), /invalid/); }
  finally { await rm(dir, { recursive: true }); }
});
