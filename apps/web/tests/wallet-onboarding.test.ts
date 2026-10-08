import { test } from "node:test";
import assert from "node:assert/strict";
import type { SessionDTO } from "@nabungfi/shared/application";
import { createWalletOnboarding, hasOwnerWallets, type WalletOnboardingOptions, type WalletProfile } from "../src/wallet-onboarding";

const wallets = [
  { chainType: "ethereum" as const, address: "0x1111111111111111111111111111111111111111" },
  { chainType: "solana" as const, address: "11111111111111111111111111111111" },
];
function fixture(initial: typeof wallets = []) {
  const profile: WalletProfile = { id: "did:privy:alice", linkedAccounts: initial.map(wallet => ({ type: "wallet", ...wallet })) };
  const calls: string[] = [];
  const session = (): SessionDTO => ({ user: { id: "db-alice", privySubject: profile.id,
    wallets: profile.linkedAccounts.map(account => ({ chainType: account.chainType as "ethereum" | "solana", address: account.address! })) },
    profile: "testnet", privyAppId: "app-test", chains: ["solana", "base"] });
  const options: WalletOnboardingOptions = {
    userId: profile.id, appId: "app-test", isCurrent: () => true, isOnline: () => true,
    refreshUser: async () => profile,
    createEthereumWallet: async () => { calls.push("ethereum"); profile.linkedAccounts = [...profile.linkedAccounts, { type: "wallet", ...wallets[0] }]; },
    createSolanaWallet: async () => { calls.push("solana"); profile.linkedAccounts = [...profile.linkedAccounts, { type: "wallet", ...wallets[1] }]; },
    readSession: async () => session(), wait: async () => {},
  };
  return { profile, calls, session, options };
}

test("first custom login creates both owner wallets and verifies the backend before completion", async () => {
  const f = fixture();
  const result = await createWalletOnboarding()(f.options);
  assert.deepEqual(f.calls, ["ethereum", "solana"]);
  assert.deepEqual(result.user.wallets, wallets);
  assert(hasOwnerWallets(result.user.wallets));
});
test("restored SDK owners still require fresh backend verification but avoid a redundant rate-limited SDK refresh",async()=>{
 const f=fixture(wallets);let reads=0;
 f.options.profile=f.profile;
 f.options.refreshUser=async()=>{throw Error("Too many requests");};
 f.options.readSession=async()=>{reads++;return f.session();};
 assert.deepEqual((await createWalletOnboarding()(f.options)).user.wallets,wallets);
 assert.equal(reads,1);assert.deepEqual(f.calls,[]);
 f.options.readSession=async()=>({...f.session(),user:{...f.session().user,privySubject:"did:privy:someone-else"}});
 await assert.rejects(createWalletOnboarding()(f.options),/does not match/);
 f.options.readSession=async()=>{throw Error("Backend unavailable");};
 await assert.rejects(createWalletOnboarding()(f.options),/Backend unavailable/);assert.deepEqual(f.calls,[]);
});
test("a mismatched restored owner cannot use the fast verification path",async()=>{
 const f=fixture(wallets);f.options.profile=structuredClone(f.profile);let refreshes=0;
 f.options.profile.linkedAccounts=[{type:"wallet",chainType:"ethereum",address:"0x"+"2".repeat(40)}, {type:"wallet",...wallets[1]}];
 f.options.refreshUser=async()=>{refreshes++;return f.profile;};
 await createWalletOnboarding()(f.options);assert.equal(refreshes,1);assert.deepEqual(f.calls,[]);
 f.options.profile={...f.profile,id:"did:privy:other"};
 await assert.rejects(createWalletOnboarding()(f.options),/different account/);
});

test("existing linked wallets are reused and a partial account creates only its missing family", async () => {
  for (const initial of [wallets, [wallets[0]], [wallets[1]]]) {
    const f = fixture(initial);
    await createWalletOnboarding()(f.options);
    assert.deepEqual(f.calls, initial.length === 2 ? [] : initial[0].chainType === "ethereum" ? ["solana"] : ["ethereum"]);
  }
});

test("repeated renders share one original creation flight", async () => {
  const f = fixture();
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const original = f.options.createEthereumWallet;
  f.options.createEthereumWallet = async () => { await waiting; return original(); };
  const ensure = createWalletOnboarding();
  const first = ensure(f.options), second = ensure(f.options);
  assert.equal(first, second);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(f.calls, ["ethereum", "solana"]);
});

test("a failed second creation retries only the missing wallet", async () => {
  const f = fixture(), ensure = createWalletOnboarding();
  const original = f.options.createSolanaWallet;
  f.options.createSolanaWallet = async () => { throw new Error("Creation unavailable"); };
  await assert.rejects(ensure(f.options), /Creation unavailable/);
  assert.deepEqual(f.calls, ["ethereum"]);
  f.options.createSolanaWallet = original;
  await ensure(f.options);
  assert.deepEqual(f.calls, ["ethereum", "solana"]);
});

test("an already-created SDK error is reconciled with refreshed ownership, not another creation", async () => {
  const f = fixture();
  const original = f.options.createEthereumWallet;
  f.options.createEthereumWallet = async () => { await original(); throw new Error("Wallet already exists"); };
  await createWalletOnboarding()(f.options);
  assert.deepEqual(f.calls, ["ethereum", "solana"]);
});

test("backend propagation waits for both families and fails with an actionable bounded retry", async () => {
  const f = fixture(wallets);
  let reads = 0;
  f.options.readSession = async () => ({ ...f.session(), user: { ...f.session().user, wallets: ++reads < 3 ? [] : wallets } });
  await createWalletOnboarding()(f.options);
  assert.equal(reads, 3);
  assert.deepEqual(f.calls, []);
  reads = 0;
  f.options.readSession = async () => { reads++; return { ...f.session(), user: { ...f.session().user, wallets: [] } }; };
  await assert.rejects(createWalletOnboarding()(f.options), /still syncing.*Retry/);
  assert.equal(reads, 8);
});

test("account changes stop the old flow before creating another wallet or accepting a session", async () => {
  const f = fixture();
  let current = true;
  const original = f.options.createEthereumWallet;
  f.options.isCurrent = () => current;
  f.options.createEthereumWallet = async () => { await original(); current = false; };
  await assert.rejects(createWalletOnboarding()(f.options), /Account changed/);
  assert.deepEqual(f.calls, ["ethereum"]);
});

test("wrong SDK user, wrong backend identity and offline state never grant readiness", async () => {
  const wrongProfile = fixture();
  wrongProfile.options.refreshUser = async () => ({ ...wrongProfile.profile, id: "did:privy:bob" });
  await assert.rejects(createWalletOnboarding()(wrongProfile.options), /different account/);
  assert.deepEqual(wrongProfile.calls, []);
  const wrongSession = fixture(wallets);
  wrongSession.options.readSession = async () => ({ ...wrongSession.session(), privyAppId: "another-app" });
  await assert.rejects(createWalletOnboarding()(wrongSession.options), /does not match/);
  const offline = fixture();
  offline.options.isOnline = () => false;
  await assert.rejects(createWalletOnboarding()(offline.options), /Reconnect/);
  assert.deepEqual(offline.calls, []);
});
