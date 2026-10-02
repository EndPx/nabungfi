import { test } from "node:test";
import assert from "node:assert/strict";
import {
  rawAmount,
  formatUsdc,
  fundedPieces,
  guardWalletStart,
  writeRecovery,
  writeApiRequest,
  readApiRequests,
  validateWalletPlan,
  verifyPlanFingerprint,
  validateSessionIdentity,
  apiUrl,
  validateRecoveryStep,
  validateReceiptIdentity,
  callWalletSdk,
  isWalletRejection,
  clearRejectedRecovery,
  ApiError,
  readRecovery,
  base58,
  type WalletRecovery,
} from "../src/live-api";
import {
  EVM_DEPLOYMENTS,
  type GoalBinding,
  type ChainPlan,
} from "@nabungfi/shared/chain";

class MemoryStorage {
  items = new Map<string, string>();
  get length() {
    return this.items.size;
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  clear() {
    this.items.clear();
  }
}
const record: WalletRecovery = {
  userId: "alice",
  goalId: "car",
  stepId: "step-1",
  network: "base",
  requestId: "request-1",
  action: "deposit",
  amountRaw: "1000000",
  state: "planned",
  createdAt: "2026-10-01T00:00:00Z",
};
test("receipt confirmation preserves the original financial intent and canonical hash", () => {
  const step = {
    id: record.stepId,
    metadataGoalId: record.goalId,
    action: record.action,
    network: record.network,
    amountRaw: record.amountRaw,
    transactionHash: "0xabcdef",
  } as import("@nabungfi/shared/application").GoalStepDTO;
  assert.doesNotThrow(() => validateReceiptIdentity(record, step, "0xABCDEF"));
  assert.throws(() =>
    validateReceiptIdentity(record, { ...step, amountRaw: "2" }, "0xabcdef"),
  );
  assert.throws(() =>
    validateReceiptIdentity(
      record,
      { ...step, transactionHash: "0x123456" },
      "0xabcdef",
    ),
  );
  const solana = { ...record, network: "solana" };
  assert.throws(() =>
    validateReceiptIdentity(
      solana,
      { ...step, network: "solana", transactionHash: "AbC" },
      "abc",
    ),
  );
});
test("USDC amounts never pass through floating point arithmetic", () => {
  assert.equal(rawAmount("9007199254740.123456"), "9007199254740123456");
  assert.equal(rawAmount("0.000001"), "1");
  for (const invalid of [
    "0",
    "-1",
    "1e3",
    "1.0000001",
    "NaN",
    "18446744073710",
  ])
    assert.throws(() => rawAmount(invalid));
});
test("one goal cannot borrow progress from another and sub-target progress stays below 100", () => {
  assert.equal(fundedPieces("9999999", "10000000"), 99);
  assert.equal(fundedPieces("10000000", "10000000"), 99);
  assert.equal(fundedPieces("10000000", "10000000", true), 100);
  assert.equal(fundedPieces("4000000", "12000000"), 33);
  assert.equal(formatUsdc("1"), "0.000001");
});
test("recovery is user scoped and refuses replacement hashes or goal identity", () => {
  const storage = new MemoryStorage();
  writeRecovery(storage, record);
  writeRecovery(storage, {
    ...record,
    state: "submitted",
    transactionHash: "hash-1",
  });
  assert.equal(readRecovery(storage, "bob").length, 0);
  assert.equal(readRecovery(storage, "alice")[0].transactionHash, "hash-1");
  assert.throws(() => writeRecovery(storage, { ...record, goalId: "house" }));
  assert.throws(() =>
    writeRecovery(storage, { ...record, transactionHash: "hash-2" }),
  );
  assert.throws(() =>
    writeRecovery(storage, { ...record, transactionHash: undefined }),
  );
});
test("recovery persistence failure prevents a caller from proceeding to signing", () => {
  assert.throws(() =>
    writeRecovery(
      {
        getItem: () => null,
        setItem: () => {
          throw new Error("quota");
        },
      },
      record,
    ),
  );
});
test("Solana signature bytes preserve leading zeros", () => {
  assert.equal(base58(Uint8Array.from([0, 0, 1])), "112");
  assert.equal(base58(Uint8Array.from([255])), "5Q");
});

test("an unknown wallet-start response never invokes the wallet SDK", async () => {
  let sends = 0;
  await assert.rejects(() =>
    guardWalletStart(
      async () => {
        throw new Error("connection lost");
      },
      "car",
      "step-1",
      "fingerprint",
      async () => {
        sends++;
        return "hash";
      },
    ),
  );
  assert.equal(sends, 0);
});
test("wallet start requires the original signed-step marker and fingerprint", async () => {
  let sends = 0;
  const sign = async () => {
    sends++;
    return "hash";
  };
  const request = async <T>() =>
    ({
      step: {
        id: "step-1",
        status: "signing",
        transactionHash: null,
        plan: { fingerprint: "fingerprint" },
      },
    }) as T;
  assert.equal(
    await guardWalletStart(request, "car", "step-1", "fingerprint", sign),
    "hash",
  );
  assert.equal(sends, 1);
  const changed = async <T>() =>
    ({
      step: {
        id: "step-1",
        status: "signing",
        transactionHash: null,
        plan: { fingerprint: "changed" },
      },
    }) as T;
  await assert.rejects(() =>
    guardWalletStart(changed, "car", "step-1", "fingerprint", sign),
  );
  assert.equal(sends, 1);
});

test("a saved API request cannot be replaced with a different goal or amount", () => {
  const storage = new MemoryStorage();
  const request = {
    userId: "alice",
    requestId: "original",
    path: "/api/goals/car/steps",
    body: { action: "deposit", amountRaw: "1000000" },
    createdAt: "2026-10-01T00:00:00Z",
  };
  writeApiRequest(storage, request);
  assert.throws(() =>
    writeApiRequest(storage, { ...request, path: "/api/goals/house/steps" }),
  );
  assert.throws(() =>
    writeApiRequest(storage, {
      ...request,
      body: { action: "deposit", amountRaw: "2000000" },
    }),
  );
  assert.equal(readApiRequests(storage, "alice").length, 1);
  assert.equal(readApiRequests(storage, "bob").length, 0);
});
test("corrupted current-user recovery records block replacement financial actions", () => {
  const storage = new MemoryStorage();
  storage.setItem(
    "nabungfi:wallet-step:v1:alice:missing",
    JSON.stringify({ userId: "alice", state: "planned" }),
  );
  assert.throws(() => readRecovery(storage, "alice"));
  assert.equal(readRecovery(storage, "bob").length, 0);
  storage.setItem(
    "nabungfi:api-request:v1:alice:missing",
    JSON.stringify({ userId: "alice" }),
  );
  assert.throws(() => readApiRequests(storage, "alice"));
});

const binding: GoalBinding = {
  version: 2,
  profile: "nabungfi-v2-devnet-four-chain",
  goalId: `0x${"12".repeat(32)}`,
  targetRaw: "1000000",
  owner: {
    solana: "AMoZFFdhUaNq8qyVRE4RrdW7rBc5Jssc6b7MyERMB7s8",
    evm: `0x${"12".repeat(20)}`,
  },
  solanaGoal: "goal-pda",
  solanaCash: "cash-pda",
  participants: [
    {
      network: "base",
      domain: 2,
      eid: EVM_DEPLOYMENTS.base.eid,
      asset: EVM_DEPLOYMENTS.base.asset,
      router: EVM_DEPLOYMENTS.base.router,
      factory: EVM_DEPLOYMENTS.base.factory,
    },
  ],
};
const creation: ChainPlan = {
  id: "plan-1",
  goalId: binding.goalId,
  action: "create-vault",
  network: "base",
  owner: binding.owner.evm,
  fingerprint: "fingerprint",
  createdAt: "2026-10-01T00:00:00Z",
  expiresAt: "2026-10-01T00:05:00Z",
  transaction: {
    kind: "evm",
    chainId: 84532,
    to: EVM_DEPLOYMENTS.base.router,
    data: "0x1234",
    value: "0",
  },
};
test("client vault creation uses router user entry and rejects factory bypass and mainnet", () => {
  const goal = { goalId: binding.goalId, binding };
  const step = {
    id: creation.id,
    status: "planned" as const,
    transactionHash: null,
    goalId: binding.goalId,
    plan: creation,
    action: "create-vault" as const,
    network: "base" as const,
  };
  assert.equal(validateWalletPlan(goal, step), creation);
  assert.throws(() =>
    validateWalletPlan(goal, {
      ...step,
      plan: {
        ...creation,
        transaction: {
          kind: "evm",
          chainId: 84532,
          to: EVM_DEPLOYMENTS.base.factory,
          data: "0x1234",
          value: "0",
        },
      },
    }),
  );
  assert.throws(() =>
    validateWalletPlan(goal, {
      ...step,
      plan: {
        ...creation,
        transaction: {
          kind: "evm",
          chainId: 8453,
          to: EVM_DEPLOYMENTS.base.router,
          data: "0x1234",
          value: "0",
        },
      },
    }),
  );
  assert.throws(() =>
    validateWalletPlan(goal, { ...step, goalId: `0x${"34".repeat(32)}` }),
  );
  assert.throws(() => validateWalletPlan(goal, { ...step, amountRaw: "1" }));
});
test("client Solana owner binding remains case-sensitive", () => {
  const plan: ChainPlan = {
    ...creation,
    action: "initialize",
    network: "solana",
    owner: binding.owner.solana,
    transaction: {
      kind: "solana",
      chainId: "solana-devnet",
      base64: "AA==",
      blockhash: "hash",
      lastValidBlockHeight: 1,
    },
  };
  const step = {
    id: plan.id,
    status: "planned" as const,
    transactionHash: null,
    goalId: binding.goalId,
    plan,
    action: "initialize" as const,
    network: "solana" as const,
  };
  assert.equal(
    validateWalletPlan({ goalId: binding.goalId, binding }, step),
    plan,
  );
  assert.throws(() =>
    validateWalletPlan(
      { goalId: binding.goalId, binding },
      { ...step, plan: { ...plan, owner: plan.owner.toLowerCase() } },
    ),
  );
});

test("browser fingerprint verification matches a golden server plan and rejects altered content", async () => {
  // Golden hash produced by the server planner; client hashing must match this protocol boundary.
  const plan = {
    ...creation,
    fingerprint:
      "0x48092d27c93a907805a0b6ea48d60773f63e4ddf67e361b69f991d9ace4766d0",
  };
  await verifyPlanFingerprint(plan);
  const changes: ChainPlan[] = [
    { ...plan, id: "another-step" },
    { ...plan, goalId: `0x${"34".repeat(32)}` },
    { ...plan, amountRaw: "1" },
    { ...plan, expiresAt: "2026-10-01T00:06:00Z" },
    { ...plan, fingerprint: `0x${"00".repeat(32)}` },
    {
      ...plan,
      transaction: {
        kind: "evm",
        chainId: 84532,
        to: EVM_DEPLOYMENTS.base.router,
        data: "0x9999",
        value: "0",
      },
    },
  ];
  for (const changed of changes)
    await assert.rejects(() => verifyPlanFingerprint(changed));
});

test("session boot binds Privy DID without confusing it with the database UUID", () => {
  const session = {
    user: {
      id: "4aa055b2-c998-499a-bd89-e8972af5fe12",
      privySubject: "did:privy:alice",
      wallets: [],
    },
    profile: "testnet" as const,
    privyAppId: "public-app",
    chains: ["solana" as const, "base" as const],
  };
  assert.doesNotThrow(() =>
    validateSessionIdentity(session, "did:privy:alice"),
  );
  assert.throws(() => validateSessionIdentity(session, "did:privy:bob"));
  assert.throws(() => validateSessionIdentity(session, session.user.id));
  assert.doesNotThrow(() =>
    validateSessionIdentity(session, "did:privy:alice", "public-app"),
  );
  assert.throws(() =>
    validateSessionIdentity(session, "did:privy:alice", "different-app"),
  );
});

test("a recovered step cannot redirect the original wallet action to a different goal, chain or amount", () => {
  const step = {
    id: record.stepId,
    metadataGoalId: record.goalId,
    action: "deposit" as const,
    network: "base" as const,
    amountRaw: record.amountRaw,
  };
  assert.doesNotThrow(() => validateRecoveryStep(record, step));
  for (const changed of [
    { ...step, metadataGoalId: "house" },
    { ...step, amountRaw: "2000000" },
    { ...step, network: "arbitrum" as const },
    { ...step, action: "approve" as const },
    { ...step, id: "another-step" },
  ])
    assert.throws(() => validateRecoveryStep(record, changed));
});

test("only a direct numeric wallet-SDK rejection qualifies for owner attestation", async () => {
  const result = await callWalletSdk(async () => "success");
  assert.equal(result, "success");
  const getFailure = async (call: () => Promise<unknown>) => {
    try {
      await call();
      return null;
    } catch (failure) {
      return failure;
    }
  };
  const rejected = await getFailure(() =>
    callWalletSdk(async () => {
      throw Object.assign(new Error("User rejected"), { code: 4001 });
    }),
  );
  assert.equal(isWalletRejection(rejected), true);
  assert.equal(
    isWalletRejection(new ApiError("HTTP error", "4001", 400)),
    false,
  );
  assert.equal(
    isWalletRejection(
      Object.assign(new Error("Marker response lost"), { code: 4001 }),
    ),
    false,
  );
  const ambiguous = await getFailure(() =>
    callWalletSdk(async () => {
      throw new Error("timeout");
    }),
  );
  assert.equal(isWalletRejection(ambiguous), false);
  const stringCode = await getFailure(() =>
    callWalletSdk(async () => {
      throw Object.assign(new Error("not standard"), { code: "4001" });
    }),
  );
  assert.equal(isWalletRejection(stringCode), false);
});
test("known owner-rejected recovery cleanup cannot remove another intent or any hashed request", () => {
  const storage = new MemoryStorage();
  writeRecovery(storage, { ...record, state: "awaiting-wallet" });
  assert.throws(() =>
    clearRejectedRecovery(storage, { ...record, goalId: "house" }),
  );
  clearRejectedRecovery(storage, record);
  assert.equal(readRecovery(storage, record.userId).length, 0);
  writeRecovery(storage, {
    ...record,
    state: "submitted",
    transactionHash: "original-hash",
  });
  assert.throws(() => clearRejectedRecovery(storage, record));
  assert.equal(
    readRecovery(storage, record.userId)[0].transactionHash,
    "original-hash",
  );
});

test("API routing accepts explicit HTTPS or same-origin and rejects credential-bearing URLs", () => {
  assert.equal(
    apiUrl("/api/goals", "", "https://nabungfi.example"),
    "/api/goals",
  );
  assert.equal(
    apiUrl(
      "/api/goals",
      "https://api.nabungfi.example",
      "https://nabungfi.example",
    ),
    "https://api.nabungfi.example/api/goals",
  );
  assert.equal(
    apiUrl("/api/goals", "http://127.0.0.1:3001", "http://127.0.0.1:5173"),
    "http://127.0.0.1:3001/api/goals",
  );
  for (const origin of [
    "http://api.nabungfi.example",
    "https://key:secret@api.nabungfi.example",
    "https://api.nabungfi.example/api",
    "https://api.nabungfi.example/?token=secret",
    "javascript:alert(1)",
  ])
    assert.throws(() =>
      apiUrl("/api/goals", origin, "https://nabungfi.example"),
    );
  assert.throws(() =>
    apiUrl("//attacker.example/api/goals", "", "https://nabungfi.example"),
  );
});
