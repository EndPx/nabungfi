import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getTransactionDecoder,
  getTransactionEncoder,
  getCompiledTransactionMessageDecoder,
  getCompiledTransactionMessageEncoder,
  address,
} from "@solana/kit";
import {
  SOLANA_DEPLOYMENT as SOL,
  type ChainPlan,
  type GoalBinding,
} from "@nabungfi/shared/chain";
import { validateTransactionSemantics } from "../src/plan-semantics";
import { verifyPlanFingerprint } from "../src/live-api";
import { planFingerprint } from "../../server/src/chain/planner";
const fixtures = JSON.parse(
  readFileSync(
    new URL("./fixtures/unsigned-plans.json", import.meta.url),
    "utf8",
  ),
) as {
  binding: GoalBinding;
  unprovisioned: GoalBinding;
  plans: Record<string, ChainPlan>;
};
const resignFingerprint = (plan: ChainPlan) => {
  const { fingerprint: _, ...unsigned } = plan;
  return { ...unsigned, fingerprint: planFingerprint(unsigned) };
};
const bindingFor = (plan: ChainPlan) =>
  plan.action === "create-vault" ? fixtures.unprovisioned : fixtures.binding;

test("browser semantics accepts independent server-encoded golden plans for every wallet action", async () => {
  for (const [key, plan] of Object.entries(fixtures.plans)) {
    await verifyPlanFingerprint(plan);
    await assert.doesNotReject(
      () => validateTransactionSemantics(bindingFor(plan), plan),
      key,
    );
  }
});
test("recomputed fingerprints cannot authorize attacker-spender or unlimited approvals", async () => {
  const source = fixtures.plans["approve-base"];
  assert.equal(source.transaction.kind, "evm");
  if (source.transaction.kind !== "evm") return;
  const attacks = [
    {
      ...source,
      transaction: {
        ...source.transaction,
        data: source.transaction.data.slice(0, -64) + "f".repeat(64),
      },
    },
    {
      ...source,
      transaction: {
        ...source.transaction,
        data:
          "0x095ea7b3" +
          "00".repeat(12) +
          "99".repeat(20) +
          source.transaction.data.slice(-64),
      },
    },
    {
      ...source,
      transaction: {
        ...source.transaction,
        data: source.transaction.data + "00",
      },
    },
  ];
  for (const attack of attacks) {
    const plan = resignFingerprint(attack);
    await verifyPlanFingerprint(plan);
    await assert.rejects(() =>
      validateTransactionSemantics(fixtures.binding, plan),
    );
  }
});
test("recomputed fingerprints cannot change goal creation tuple or deposit/claim amount", async () => {
  for (const key of ["create-vault-base", "deposit-base", "claim-base"]) {
    const source = fixtures.plans[key];
    if (source.transaction.kind !== "evm") throw new Error("Bad fixture");
    const data =
      source.transaction.data.slice(0, -1) +
      (source.transaction.data.endsWith("0") ? "1" : "0");
    const plan = resignFingerprint({
      ...source,
      transaction: { ...source.transaction, data },
    });
    await verifyPlanFingerprint(plan);
    await assert.rejects(
      () => validateTransactionSemantics(bindingFor(source), plan),
      key,
    );
  }
});
function mutateMessage(
  plan: ChainPlan,
  mutate: (
    message: ReturnType<
      ReturnType<typeof getCompiledTransactionMessageDecoder>["decode"]
    >,
  ) => void,
): ChainPlan {
  if (plan.transaction.kind !== "solana")
    throw new Error("Expected Solana fixture");
  const transaction = getTransactionDecoder().decode(
    Uint8Array.from(atob(plan.transaction.base64), (character) =>
      character.charCodeAt(0),
    ),
  );
  const message = getCompiledTransactionMessageDecoder().decode(
    transaction.messageBytes,
  );
  mutate(message);
  const messageBytes = new Uint8Array(
    getCompiledTransactionMessageEncoder().encode(message),
  );
  const bytes = getTransactionEncoder().encode({
    ...transaction,
    messageBytes: messageBytes as typeof transaction.messageBytes,
  });
  return resignFingerprint({
    ...plan,
    transaction: {
      ...plan.transaction,
      base64: Buffer.from(bytes).toString("base64"),
    },
  });
}
test("Solana instructions reject substituted mint, cash destination, program, amount and extra actions", async () => {
  const source = fixtures.plans["deposit-solana"];
  const variants = [
    mutateMessage(source, (message) => {
      const index = message.staticAccounts.indexOf(address(SOL.mint));
      message.staticAccounts[index] = address(SOL.transport);
    }),
    mutateMessage(source, (message) => {
      const index = message.staticAccounts.indexOf(
        address(fixtures.binding.solanaCash),
      );
      message.staticAccounts[index] = address(SOL.transport);
    }),
    mutateMessage(source, (message) => {
      message.instructions[0] = {
        ...message.instructions[0],
        programAddressIndex: message.staticAccounts.indexOf(address(SOL.mint)),
      };
    }),
    mutateMessage(source, (message) => {
      const data = new Uint8Array(message.instructions[0].data!);
      data[data.length - 1] ^= 1;
      message.instructions[0] = { ...message.instructions[0], data };
    }),
    mutateMessage(source, (message) => {
      message.instructions.push(message.instructions[0]);
    }),
    mutateMessage(source, (message) => {
      message.staticAccounts[0] = address(SOL.transport);
    }),
  ];
  for (const plan of variants) {
    await verifyPlanFingerprint(plan);
    await assert.rejects(() =>
      validateTransactionSemantics(fixtures.binding, plan),
    );
  }
});
test("Solana lifetime and vault identity cannot be replaced even with a new digest", async () => {
  const source = fixtures.plans["claim-solana"];
  if (source.transaction.kind !== "solana") throw new Error("Bad fixture");
  const lifetime = resignFingerprint({
    ...source,
    transaction: { ...source.transaction, blockhash: SOL.core },
  });
  await verifyPlanFingerprint(lifetime);
  await assert.rejects(() =>
    validateTransactionSemantics(fixtures.binding, lifetime),
  );
  const wrongCash = { ...fixtures.binding, solanaCash: SOL.transport };
  await assert.rejects(() => validateTransactionSemantics(wrongCash, source));
  const wrongConfig = {
    ...fixtures.binding,
    participants: fixtures.binding.participants.map((participant) => ({
      ...participant,
      configHash: `0x${"99".repeat(32)}`,
    })),
  };
  await assert.rejects(() => validateTransactionSemantics(wrongConfig, source));
});
