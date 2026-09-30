import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyModel, transition, publicState, parseUSDC, formatUSDC, serialize, deserialize, UNIT, assertInvariants, type Action, type Model } from "../src/index.js";
let n = 0;
const run = (m: Model, a: Action) => transition(m, a, `request-${++n}`);
const deposit = (m: Model, chain: "solana" | "base", amount: string) => run(m, { type: "deposit", chain, amount });

test("USDC parsing is exact and refuses rounding, exponents, numbers, negatives and misleading separators", () => {
  assert.equal(parseUSDC("123.000001"), 123000001n);
  assert.equal(formatUSDC(-1n), "-0.000001");
  for (const input of [0.1, "1e3", "0.0000009", "-1", "1,000", "NaN", "Infinity", "01", " 1 "]) assert.throws(() => parseUSDC(input));
  assert.equal(parseUSDC("-2.000001", true), -2000001n);
});
test("contributions from both chains accumulate before whole-piece rounding", () => {
  let m = emptyModel("car", 100n * UNIT);
  m = deposit(m, "solana", "0.60"); m = deposit(m, "base", "0.40");
  assert.equal(publicState(m).goal.fundedPieces, 1);
  assert.equal(publicState(m).goal.balance, "1.000000");
});
test("principal and earnings cannot be claimed before committed achievement", () => {
  let m = deposit(emptyModel("car", 100n * UNIT), "solana", "90");
  m = run(m, { type: "demo-yield", chain: "solana", amount: "10" });
  assert.throws(() => run(m, { type: "claim", chain: "solana" }), /locked/);
  assert.equal(publicState(m).goal.fundedPieces, 99);
  assert.equal(publicState(m).goal.earnings, "10.000000");
});
test("one-way achievement survives a first claim that takes remaining balance below target", () => {
  let m = deposit(emptyModel("car", 100n * UNIT), "solana", "60"); m = deposit(m, "base", "40");
  m = run(m, { type: "prepare" }); m = run(m, { type: "finalize" });
  m = run(m, { type: "claim", chain: "solana" });
  assert.equal(publicState(m).goal.balance, "40.000000");
  assert.equal(publicState(m).goal.fundedPieces, 100);
  assert.equal(publicState(m).goal.progress, 100);
  assert.equal(m.goal.achieved, true);
  m = run(m, { type: "claim", chain: "base" });
  assert.equal(m.goal.status, "closed");
  assert.equal(publicState(m).goal.progress, 100);
  assert.throws(() => run(m, { type: "claim", chain: "base" }), /no remaining/);
});
test("illiquidity blocks completion until the second reserve really becomes available", () => {
  let m = deposit(emptyModel("car", 100n * UNIT), "solana", "50"); m = deposit(m, "base", "50");
  m = run(m, { type: "demo-liquidity", chain: "base", amount: "10" });
  m = run(m, { type: "prepare" });
  assert.equal(m.goal.status, "preparing");
  assert.equal(m.goal.positions.base.liquid, 10n * UNIT);
  assert.throws(() => run(m, { type: "finalize" }), /reserved/);
  m = run(m, { type: "demo-liquidity", chain: "base", amount: "40" });
  m = run(m, { type: "refresh" });
  assert.equal(m.goal.status, "ready");
  m = run(m, { type: "finalize" }); assert.equal(m.goal.achieved, true);
});
test("loss after one chain reserves can prevent achievement; top-up restores net threshold", () => {
  let m = deposit(emptyModel("car", 100n * UNIT), "solana", "50"); m = deposit(m, "base", "50");
  m = run(m, { type: "demo-liquidity", chain: "base", amount: "0" }); m = run(m, { type: "prepare" });
  assert.throws(() => run(m, { type: "demo-yield", chain: "solana", amount: "-1" }), /invested|reserved/);
  m = run(m, { type: "demo-yield", chain: "base", amount: "-5" });
  m = run(m, { type: "demo-liquidity", chain: "base", amount: "45" }); m = run(m, { type: "refresh" });
  assert.throws(() => run(m, { type: "finalize" }), /below the target/);
  assert.throws(() => deposit(m, "base", "5"), /already reserved/);
  m = run(m, { type: "abort" }); m = deposit(m, "base", "5");
  m = run(m, { type: "prepare" }); m = run(m, { type: "finalize" });
  assert.equal(publicState(m).goal.principal, "105.000000");
  assert.equal(publicState(m).goal.earnings, "-5.000000");
});
test("abort tombstones a round, keeps funds locked and requires a new preparation", () => {
  let m = deposit(emptyModel("car", 10n * UNIT), "solana", "10");
  m = run(m, { type: "prepare" }); m = run(m, { type: "abort" });
  assert.deepEqual(m.goal.abortedRounds, [1]); assert.equal(m.goal.achieved, false);
  assert.throws(() => run(m, { type: "claim", chain: "solana" }), /locked/);
  assert.throws(() => run(m, { type: "finalize" }), /reserved/);
  m = run(m, { type: "prepare" }); assert.equal(m.goal.round, 2);
  m = run(m, { type: "finalize" }); assert.equal(m.goal.achieved, true);
});
test("retries cannot duplicate contributions and conflicting request payloads fail", () => {
  const action = { type: "deposit", chain: "solana", amount: "1" } as const;
  const m = transition(emptyModel(), action, "stable-request-1");
  assert.equal(transition(m, action, "stable-request-1"), m);
  assert.throws(() => transition(m, { ...action, amount: "2" }, "stable-request-1"), /different action/);
});
test("funded target cannot be edited and error leaves the input unchanged", () => {
  const m = deposit(emptyModel(), "base", "1"); const before = serialize(m);
  assert.throws(() => run(m, { type: "create-goal", name: "escape", target: "1" }), /cannot be changed/);
  assert.equal(serialize(m), before);
});
test("a delayed pre-reset contribution retry cannot credit the replacement demo state", () => {
  const action = { type: "deposit", chain: "base", amount: "7" } as const;
  const before = transition(emptyModel(), action, "before-reset-deposit");
  const reset = transition(before, { type: "demo-reset" }, "reset-request-001");
  assert.notEqual(reset.goal.id, before.goal.id);
  assert.equal(transition(reset, action, "before-reset-deposit", new Date().toISOString(), before.goal.id), reset);
  assert.equal(publicState(reset).goal.balance, "3680.000000");
});
test("a stale tab cannot submit a new contribution into a replacement goal", () => {
  const before = emptyModel(); const after = run(before, { type: "demo-reset" });
  assert.throws(() => transition(after, { type: "deposit", chain: "solana", amount: "5" }, "stale-tab-deposit", new Date().toISOString(), before.goal.id), /changed in another session/);
  assert.equal(publicState(after).goal.balance, "3680.000000");
});
test("serialization restores exact amounts and persistent idempotency", () => {
  const action = { type: "deposit", chain: "base", amount: "0.000001" } as const;
  const m = transition(emptyModel(), action, "persisted-request"); const restored = deserialize(serialize(m));
  assert.deepEqual(restored, m); assert.equal(transition(restored, action, "persisted-request"), restored);
});
test("a syntactically valid but unsupported persisted phase is rejected", () => {
  const data = JSON.parse(serialize(emptyModel())); data.goal.status = "unlocked-by-database";
  assert.throws(() => deserialize(JSON.stringify(data)), /Unknown goal phase/);
});
test("many deposits, positive/negative earnings and both claim orders conserve current assets", () => {
  for (const first of ["solana", "base"] as const) {
    let m = emptyModel("car", 100n * UNIT); let principal = 0n;
    for (let i = 1; i <= 100; i++) { const value = formatUSDC(BigInt(i) * 20_001n); principal += parseUSDC(value); m = deposit(m, i % 2 ? "solana" : "base", value); assertInvariants(m); }
    m = run(m, { type: "demo-yield", chain: "solana", amount: "3.141592" });
    m = run(m, { type: "demo-yield", chain: "base", amount: "-0.001234" });
    const expected = principal + 3_140_358n;
    m = run(m, { type: "prepare" }); m = run(m, { type: "finalize" });
    m = run(m, { type: "claim", chain: first }); m = run(m, { type: "claim", chain: first === "solana" ? "base" : "solana" });
    assert.equal(m.goal.positions.solana.claimed + m.goal.positions.base.claimed, expected);
    assert.equal(publicState(m).goal.balance, "0.000000"); assert.equal(publicState(m).goal.earnings, "3.140358");
  }
});
