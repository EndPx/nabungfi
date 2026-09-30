// Real SBF execution with locally precommitted packets. No DVN quorum or network delivery is simulated.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(process.env.NABUNGFI_TEST_PACKAGE_JSON ?? import.meta.url);
const { LiteSVM, FailedTransactionMetadata, Clock } = require("litesvm");
const kit = require("@solana/kit");
const { keccak_256 } = require("@noble/hashes/sha3.js");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const devnet = process.env.NABUNGFI_TEST_PROFILE === "devnet";
const artifacts = process.env.NABUNGFI_SBF_DIR ?? resolve(root, devnet ? "contracts/solana/target/deploy-devnet" : "contracts/solana/target/deploy");
const endpointElf = process.env.NABUNGFI_ENDPOINT_ELF ?? resolve(root, ".local/svm-fixtures/layerzero-endpoint.so");
const expectedEndpointHash = "caa868d80b000c488e60e99828e366e773dde877ccc92b67f81df03b608639d4";
const endpointBytes = readFileSync(endpointElf);
assert.equal(createHash("sha256").update(endpointBytes).digest("hex"), expectedEndpointHash,
  "Endpoint fixture changed: review bytecode provenance before accepting another snapshot");

const CORE = kit.address(devnet ? "3tPb29y74ycYSHa6Pz1tsUTsnaD6Xh9HPEzFKtWnwXM4" : "Fg6PaFpoGXkYsidMpWxqSWY6W2BeZ7FEfcYkgMQHGKqF");
const TRANSPORT = kit.address(devnet ? "Fez821Y7EAC8rLNqG1WeVmVAcSZPKtd3QuQxFuAiCc5A" : "6Ckm2BrnXxsSjyG5b17kQQRjoECVrts92RKXVGT8XeqS");
const ENDPOINT = kit.address("76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6");
const TOKEN = kit.address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const SYSTEM = kit.address("11111111111111111111111111111111");
const USDC = kit.address(devnet ? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" : "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const CTOKEN = kit.address(devnet ? "2qBnsAsYjJ1cBaWQ28kChUo4dtMkYynetMY8FUTe4p3E" : "B8V6WVjPxW1UGwVDfxH2d2r8SyT4cqn7dQRK6XneVa7D");
const TEST_LIBRARY = kit.address("4HvzfJA1PjENpgoofQxNyogKQeBqsEX54w8r8quvbgwG");
const BASE_EID = devnet ? 40245 : 30184;
const TARGET = 10_000_000_000n;
const BASE_OWNER = Buffer.concat([Buffer.alloc(12), Buffer.alloc(20, 0xbb)]);
const BASE_VAULT = Buffer.concat([Buffer.alloc(12), Buffer.alloc(20, 0xaa)]);
const BASE_OAPP = Buffer.concat([Buffer.alloc(12), Buffer.alloc(20, 9)]);
const GOAL_ID = Buffer.alloc(32, 11);
const addressBytes = (value) => Buffer.from(kit.getAddressEncoder().encode(value));
const discriminator = (type, name) => createHash("sha256").update(`${type}:${name}`).digest().subarray(0, 8);
const u8 = (value) => Buffer.from([Number(value)]);
const u32 = (value, endian = "LE") => { const b = Buffer.alloc(4); b[`writeUInt32${endian}`](Number(value)); return b; };
const u64 = (value, endian = "LE") => { const b = Buffer.alloc(8); b[`writeBigUInt64${endian}`](BigInt(value)); return b; };
const pda = (programAddress, ...seeds) => kit.getProgramDerivedAddress({ programAddress, seeds });
const meta = (address, writable = false, signer = false) => ({ address, role: (writable ? 1 : 0) | (signer ? 2 : 0) });
const instruction = (programAddress, name, accounts, ...data) => ({ programAddress, accounts,
  data: Buffer.concat([discriminator("global", name), ...data]) });

function storeAccount(svm, address, programAddress, data) {
  svm.setAccount({ address, programAddress, data, executable: false,
    lamports: kit.lamports(svm.minimumBalanceForRentExemption(BigInt(data.length))) });
}

function mintData(supply = 1_000_000_000_000n) {
  return Buffer.concat([Buffer.alloc(36), u64(supply), u8(6), u8(1), Buffer.alloc(36)]);
}

function tokenData(mint, owner, amount) {
  return Buffer.concat([addressBytes(mint), addressBytes(owner), u64(amount), Buffer.alloc(36), u8(1), Buffer.alloc(12), u64(0), Buffer.alloc(36)]);
}

function decodeGoal(data) {
  const b = Buffer.from(data);
  assert.deepEqual(b.subarray(0, 8), discriminator("account", "Goal"));
  let offset = 8;
  const bytes = (n) => { const value = b.subarray(offset, offset + n); offset += n; return value; };
  const number = () => bytes(8).readBigUInt64LE();
  const value = { owner: bytes(32), goalId: bytes(32), configHash: bytes(32), target: number(),
    baseOwner: bytes(32), baseVault: bytes(32), linked: bytes(1)[0] === 1 };
  for (const key of ["remoteNetAssets", "remoteProgressSequence", "remoteObservation", "remoteObservedAt", "remoteReceivedAt",
    "principal", "claimed", "round", "inboundSequence", "outboundSequence", "localReserved", "localReadySlot", "remoteReserved", "achievedTotal"]) value[key] = number();
  value.localReady = bytes(1)[0] === 1;
  value.remoteReady = bytes(1)[0] === 1;
  value.phase = bytes(1)[0];
  value.bump = bytes(1)[0];
  assert.equal(offset, b.length);
  return value;
}

async function send(env, ix, succeeds = true) {
  env.svm.expireBlockhash();
  const tx = await kit.pipe(
    kit.createTransactionMessage({ version: 0 }),
    (tx) => kit.setTransactionMessageFeePayerSigner(env.payer, tx),
    (tx) => env.svm.setTransactionMessageLifetimeUsingLatestBlockhash(tx),
    (tx) => kit.appendTransactionMessageInstruction(ix, tx),
    (tx) => kit.signTransactionMessageWithSigners(tx),
  );
  const result = env.svm.sendTransaction(tx);
  if (succeeds && result instanceof FailedTransactionMetadata) {
    throw new Error(`${result.err()}\n${result.meta().logs().join("\n")}`);
  }
  if (!succeeds) assert(result instanceof FailedTransactionMetadata, "transaction unexpectedly succeeded");
  return result;
}

async function environment({ bootstrap = false } = {}) {
  const svm = new LiteSVM();
  svm.addProgramFromFile(CORE, resolve(artifacts, "nabungfi.so"));
  svm.addProgramFromFile(TRANSPORT, resolve(artifacts, "nabungfi_lz.so"));
  svm.addProgram(ENDPOINT, endpointBytes);
  svm.setClock(new Clock(100n, 0n, 0n, 0n, 1_700_000_001n));
  const payer = await kit.generateKeyPairSigner();
  svm.airdrop(payer.address, kit.lamports(10_000_000_000n));
  const [store, storeBump] = await pda(TRANSPORT, Buffer.from("Store"));
  const [peer, peerBump] = await pda(TRANSPORT, Buffer.from("Peer"), addressBytes(store), u32(BASE_EID, "BE"));
  const [types, typesBump] = await pda(TRANSPORT, Buffer.from("LzReceiveTypes"), addressBytes(store));
  if (!bootstrap) {
    // Receive-only cases use a preconfigured route; bootstrap has its own transaction test below.
    storeAccount(svm, store, TRANSPORT, Buffer.concat([discriminator("account", "Store"), addressBytes(payer.address), addressBytes(ENDPOINT), u32(BASE_EID), u8(1), u8(storeBump)]));
    storeAccount(svm, peer, TRANSPORT, Buffer.concat([discriminator("account", "PeerConfig"), BASE_OAPP, u8(peerBump)]));
    storeAccount(svm, types, TRANSPORT, Buffer.concat([discriminator("account", "LzReceiveTypesAccounts"), addressBytes(store), u8(typesBump)]));
  }
  storeAccount(svm, USDC, TOKEN, mintData());
  storeAccount(svm, CTOKEN, TOKEN, mintData(devnet ? 0n : 1_000_000_000_000n));
  const [goal] = await pda(CORE, Buffer.from("goal"), addressBytes(payer.address), GOAL_ID);
  const [cash] = await pda(CORE, Buffer.from("usdc"), addressBytes(goal));
  const [shares] = await pda(CORE, Buffer.from("shares"), addressBytes(goal));
  const [receiver] = await pda(TRANSPORT, Buffer.from("nabung-receiver"), addressBytes(goal));
  const source = (await kit.generateKeyPairSigner()).address;
  storeAccount(svm, source, TOKEN, tokenData(USDC, payer.address, 6_100_000_000n));
  const env = { svm, payer, store, peer, types, goal, cash, shares, receiver, source };
  await send(env, instruction(CORE, "initialize", [meta(payer.address, true, true), meta(goal, true),
    meta(USDC), meta(CTOKEN), meta(cash, true), meta(shares, true), meta(TOKEN), meta(SYSTEM)], GOAL_ID, u64(TARGET), BASE_OWNER, BASE_VAULT));
  return env;
}

const goalState = (env) => decodeGoal(env.svm.getAccount(env.goal).data);
const tokenBalance = (env, account) => Buffer.from(env.svm.getAccount(account).data).readBigUInt64LE(64);

if (devnet) test("Devnet SBF disables both strategy calls without token or goal mutation", async () => {
  const env = await environment();
  const before = Buffer.from(env.svm.getAccount(env.goal).data);
  for (const name of ["supply_kamino", "redeem_kamino"]) {
    const result = await send(env, instruction(CORE, name,
      [meta(env.payer.address, false, true), meta(env.goal)], u64(0), u64(0)), false);
    assert(result.meta().logs().some((line) => line.includes("StrategyDisabled")));
    assert.deepEqual(Buffer.from(env.svm.getAccount(env.goal).data), before);
    assert.equal(tokenBalance(env, env.cash), 0n);
    assert.equal(tokenBalance(env, env.shares), 0n);
  }
});

function encodePacket(env, { kind = 8, round = 0n, sequence = 0n, amount = TARGET, aggregate = 0n, wrongGoal = false } = {}) {
  const goal = goalState(env);
  return Buffer.concat([Buffer.from("NBFG"), u8(1), u8(kind), u32(2, "BE"), u32(1, "BE"),
    wrongGoal ? Buffer.alloc(32, 88) : GOAL_ID, goal.configHash, BASE_VAULT, addressBytes(env.goal), BASE_OWNER,
    ...[round, sequence, amount, aggregate, 1234n, 1_700_000_000n].map((n) => u64(n, "BE"))]);
}

async function inbound(env, options = {}) {
  const nonce = options.nonce ?? 1n;
  const packet = encodePacket(env, options);
  const sender = options.wrongPeer ? Buffer.concat([Buffer.alloc(12), Buffer.alloc(20, 8)]) : BASE_OAPP;
  const guid = createHash("sha256").update(u64(nonce)).digest();
  const [registry, registryBump] = await pda(ENDPOINT, Buffer.from("OApp"), addressBytes(env.store));
  const [nonceAccount, nonceBump] = await pda(ENDPOINT, Buffer.from("Nonce"), addressBytes(env.store), u32(BASE_EID, "BE"), sender);
  const [payload, payloadBump] = await pda(ENDPOINT, Buffer.from("PayloadHash"), addressBytes(env.store), u32(BASE_EID, "BE"), sender, u64(nonce, "BE"));
  const [settings, settingsBump] = await pda(ENDPOINT, Buffer.from("Endpoint"));
  const [eventAuthority] = await pda(ENDPOINT, Buffer.from("__event_authority"));
  storeAccount(env.svm, registry, ENDPOINT, Buffer.concat([discriminator("account", "OAppRegistry"), addressBytes(env.store), u8(registryBump)]));
  const previousNonce = env.svm.getAccount(nonceAccount);
  const watermark = previousNonce.exists ? Buffer.from(previousNonce.data).readBigUInt64LE(17) : 0n;
  storeAccount(env.svm, nonceAccount, ENDPOINT, Buffer.concat([discriminator("account", "Nonce"), u8(nonceBump), u64(0), u64(nonce > watermark ? nonce : watermark)]));
  storeAccount(env.svm, settings, ENDPOINT, Buffer.concat([discriminator("account", "EndpointSettings"), u32(30168), u8(settingsBump), addressBytes(env.payer.address), u8(0)]));
  // Inject only the prior verification result; real Endpoint clear still checks the committed hash.
  storeAccount(env.svm, payload, ENDPOINT, Buffer.concat([discriminator("account", "PayloadHash"),
    options.wrongHash ? Buffer.alloc(32) : Buffer.from(keccak_256(Buffer.concat([guid, packet]))), u8(payloadBump)]));
  const params = Buffer.concat([u32(BASE_EID), sender, u64(nonce), guid, u32(packet.length), packet, u32(0)]);
  const accounts = [meta(env.payer.address, true, true), meta(env.store), meta(env.peer), meta(env.goal, true), meta(env.receiver), meta(CORE), meta(TRANSPORT),
    meta(ENDPOINT), meta(env.store), meta(registry), meta(nonceAccount), meta(payload, true), meta(settings, true), meta(eventAuthority), meta(ENDPOINT)];
  return { ix: instruction(TRANSPORT, "lz_receive", accounts, params), payload, params };
}

const balances = (env) => [meta(env.goal, true), meta(env.cash), meta(env.shares)];
const ownerGoal = (env) => [meta(env.payer.address, false, true), meta(env.goal, true)];

async function outbound(env) {
  env.svm.addProgramFromFile(TEST_LIBRARY, resolve(artifacts, "nabungfi_test_messagelib.so"));
  const [library, libraryBump] = await pda(TEST_LIBRARY, Buffer.from("MessageLib"));
  const [info, infoBump] = await pda(ENDPOINT, Buffer.from("MessageLib"), addressBytes(library));
  const [custom, customBump] = await pda(ENDPOINT, Buffer.from("SendLibraryConfig"), addressBytes(env.store), u32(BASE_EID, "BE"));
  const [defaults, defaultBump] = await pda(ENDPOINT, Buffer.from("SendLibraryConfig"), u32(BASE_EID, "BE"));
  const [nonce, nonceBump] = await pda(ENDPOINT, Buffer.from("Nonce"), addressBytes(env.store), u32(BASE_EID, "BE"), BASE_OAPP);
  const [settings, settingsBump] = await pda(ENDPOINT, Buffer.from("Endpoint"));
  const [eventAuthority] = await pda(ENDPOINT, Buffer.from("__event_authority"));
  const [record] = await pda(TEST_LIBRARY, Buffer.from("test-record"));
  storeAccount(env.svm, info, ENDPOINT, Buffer.concat([discriminator("account", "MessageLibInfo"), u8(0), u8(infoBump), u8(libraryBump)]));
  storeAccount(env.svm, custom, ENDPOINT, Buffer.concat([discriminator("account", "SendLibraryConfig"), addressBytes(library), u8(customBump)]));
  storeAccount(env.svm, defaults, ENDPOINT, Buffer.concat([discriminator("account", "SendLibraryConfig"), addressBytes(library), u8(defaultBump)]));
  if (!env.svm.getAccount(nonce).exists) storeAccount(env.svm, nonce, ENDPOINT, Buffer.concat([discriminator("account", "Nonce"), u8(nonceBump), u64(0), u64(0)]));
  storeAccount(env.svm, settings, ENDPOINT, Buffer.concat([discriminator("account", "EndpointSettings"), u32(30168), u8(settingsBump), addressBytes(env.payer.address), u8(0)]));
  storeAccount(env.svm, record, TEST_LIBRARY, Buffer.concat([discriminator("account", "Record"), Buffer.alloc(302)]));
  const quote = (sequence) => instruction(TRANSPORT, "quote", [meta(env.store), meta(env.peer), meta(env.goal),
    meta(ENDPOINT), meta(TEST_LIBRARY), meta(custom), meta(defaults), meta(info), meta(settings), meta(nonce)], u64(sequence), u32(2), Buffer.from([0, 3]));
  const sendIx = (sequence, fee = 10_000n) => instruction(TRANSPORT, "send", [
    meta(env.payer.address, false, true), meta(env.store), meta(env.peer), meta(env.goal),
    meta(ENDPOINT), meta(env.store), meta(TEST_LIBRARY), meta(custom), meta(defaults), meta(info), meta(settings), meta(nonce, true),
    meta(eventAuthority), meta(ENDPOINT), meta(env.payer.address, true, true), meta(record, true), meta(SYSTEM),
  ], u64(sequence), u64(fee), u32(2), Buffer.from([0, 3]));
  const lastPacket = () => {
    const data = Buffer.from(env.svm.getAccount(record).data);
    assert.deepEqual(data.subarray(8, 40), addressBytes(env.store));
    assert.deepEqual(data.subarray(40, 72), BASE_OAPP);
    assert.equal(data.readUInt32LE(72), BASE_EID);
    const size = data.readUInt32LE(84);
    return data.subarray(88, 88 + size);
  };
  return { quote, sendIx, lastPacket, nonce, record };
}

test("SBF receiver requires real Endpoint hash validation and rejects replay/other goals", async () => {
  const env = await environment();
  for (const options of [{ wrongPeer: true }, { wrongGoal: true }, { wrongHash: true }]) {
    const incoming = await inbound(env, options);
    await send(env, incoming.ix, false);
    assert.equal(goalState(env).linked, false);
    assert(env.svm.getAccount(incoming.payload).exists);
  }
  const incoming = await inbound(env);
  const delivered = await send(env, incoming.ix);
  assert.equal(goalState(env).linked, true);
  assert(!env.svm.getAccount(incoming.payload).exists);
  assert(delivered.logs().some((line) => line.includes("Instruction: Clear")));
  assert(delivered.logs().some((line) => line.includes("Instruction: ReceiveRegistered")));
  await send(env, incoming.ix, false); // The packet account was consumed by the real endpoint.
});

test("SBF bootstrap requires upgrade authority and seals the real Endpoint delegate to the Store PDA", async () => {
  const env = await environment({ bootstrap: true });
  const program = Buffer.from(env.svm.getAccount(TRANSPORT).data);
  assert.equal(program.readUInt32LE(0), 2, "transport must use upgradeable loader metadata");
  const programDataAddress = kit.getAddressDecoder().decode(program.subarray(4, 36));
  const programData = env.svm.getAccount(programDataAddress);
  const data = Buffer.from(programData.data);
  assert.equal(data.readUInt32LE(0), 3);
  // Fixture grants the ephemeral payer upgrade authority before exercising the actual initializer.
  data[12] = 1; addressBytes(env.payer.address).copy(data, 13);
  env.svm.setAccount({ ...programData, data });
  const [registry] = await pda(ENDPOINT, Buffer.from("OApp"), addressBytes(env.store));
  const [eventAuthority] = await pda(ENDPOINT, Buffer.from("__event_authority"));
  const init = (administrator) => instruction(TRANSPORT, "initialize", [
    meta(administrator, true, true), meta(TRANSPORT), meta(programDataAddress),
    meta(env.store, true), meta(env.peer, true), meta(env.types, true), meta(SYSTEM),
    meta(ENDPOINT), meta(administrator, true, true), meta(env.store), meta(registry, true),
    meta(SYSTEM), meta(eventAuthority), meta(ENDPOINT),
  ], u32(BASE_EID), BASE_OAPP);
  const stranger = await kit.generateKeyPairSigner();
  env.svm.airdrop(stranger.address, kit.lamports(2_000_000_000n));
  await send({ ...env, payer: stranger }, init(stranger.address), false);
  assert(!env.svm.getAccount(env.store).exists);
  await send(env, init(env.payer.address));
  assert.deepEqual(Buffer.from(env.svm.getAccount(registry).data).subarray(8, 40), addressBytes(env.payer.address));
  assert.equal(env.svm.getAccount(env.store).data[76], 0);
  await send(env, instruction(TRANSPORT, "seal_route", [meta(env.payer.address, false, true), meta(env.store, true),
    meta(ENDPOINT), meta(env.store), meta(registry, true), meta(eventAuthority), meta(ENDPOINT)]));
  assert.equal(env.svm.getAccount(env.store).data[76], 1);
  assert.deepEqual(Buffer.from(env.svm.getAccount(registry).data).subarray(8, 40), addressBytes(env.store));
  await send(env, init(env.payer.address), false);
});

test("SBF registration, real SPL deposit, READY, achievement and claim preserve the surplus", async () => {
  const env = await environment();
  const publishing = await outbound(env);
  await send(env, publishing.sendIx(0));
  const registration = publishing.lastPacket();
  assert.equal(registration[5], 7);
  assert.deepEqual(registration.subarray(78, 110), addressBytes(env.goal));
  assert.deepEqual(registration.subarray(110, 142), BASE_VAULT);
  assert.equal(registration.readBigUInt64BE(190), TARGET);
  const deposit = instruction(CORE, "deposit", [meta(env.payer.address, false, true), meta(env.goal, true), meta(USDC), meta(env.source, true), meta(env.cash, true), meta(TOKEN)], u64(6_100_000_000n));
  await send(env, deposit, false);
  await send(env, (await inbound(env)).ix);
  await send(env, deposit);
  assert.equal(tokenBalance(env, env.cash), 6_100_000_000n);
  assert.equal(tokenBalance(env, env.source), 0n);
  await send(env, instruction(CORE, "begin_prepare", ownerGoal(env)));
  await send(env, publishing.sendIx(1));
  assert.equal(publishing.lastPacket()[5], 1);
  await send(env, (await inbound(env, { kind: 4, nonce: 2n, round: 1n, sequence: 1n, amount: 4_100_000_000n })).ix);
  await send(env, instruction(CORE, "mark_local_ready", balances(env)));
  await send(env, instruction(CORE, "achieve", balances(env)), false);
  env.svm.warpToSlot(101n);
  await send(env, instruction(CORE, "achieve", balances(env)));
  assert.equal(goalState(env).phase, 3);
  assert.equal(goalState(env).achievedTotal, 10_200_000_000n);
  await send(env, publishing.sendIx(2));
  const commit = publishing.lastPacket();
  assert.equal(commit[5], 2);
  assert.equal(commit.readBigUInt64BE(190), 4_100_000_000n);
  assert.equal(commit.readBigUInt64BE(198), 10_200_000_000n);
  await send(env, instruction(CORE, "claim", [meta(env.payer.address, false, true), meta(env.goal, true), meta(USDC), meta(env.cash, true), meta(env.source, true), meta(TOKEN)], u64(6_100_000_000n)));
  assert.equal(tokenBalance(env, env.cash), 0n);
  assert.equal(tokenBalance(env, env.source), 6_100_000_000n);
  assert.equal(goalState(env).claimed, 6_100_000_000n);
  assert.equal(goalState(env).achievedTotal, 10_200_000_000n);
});

test("SBF quote/send uses caller fees and rolls back the Endpoint nonce on underpayment", async () => {
  const env = await environment();
  const publishing = await outbound(env);
  const quoted = await send(env, publishing.quote(0));
  const fee = Buffer.from(quoted.returnData().data()).readBigUInt64LE(0);
  assert.equal(fee, 10_000n);
  const storeLamports = env.svm.getBalance(env.store);
  const recordLamports = env.svm.getBalance(publishing.record);
  const before = Buffer.from(env.svm.getAccount(publishing.nonce).data);
  await send(env, publishing.sendIx(0, fee - 1n), false);
  assert.deepEqual(Buffer.from(env.svm.getAccount(publishing.nonce).data), before);
  assert.equal(env.svm.getBalance(publishing.record), recordLamports);
  await send(env, publishing.sendIx(0, fee));
  assert.equal(Buffer.from(env.svm.getAccount(publishing.nonce).data).readBigUInt64LE(9), 1n);
  assert.equal(env.svm.getBalance(publishing.record), recordLamports + fee);
  assert.equal(env.svm.getBalance(env.store), storeLamports);
  assert.equal(publishing.lastPacket()[5], 7);
  // A caller cannot publish a nonexistent coordinator command, even with enough fee.
  await send(env, publishing.sendIx(99, fee), false);
  assert.equal(Buffer.from(env.svm.getAccount(publishing.nonce).data).readBigUInt64LE(9), 1n);
});

test("SBF progress replaces snapshots and never grants claim permission", async () => {
  const env = await environment(); await send(env, (await inbound(env)).ix);
  await send(env, (await inbound(env, { kind: 6, nonce: 2n, sequence: 1n, amount: 20_000_000_000n })).ix);
  assert.equal(goalState(env).phase, 0); assert.equal(goalState(env).achievedTotal, 0n);
  await send(env, (await inbound(env, { kind: 6, nonce: 3n, sequence: 3n, amount: 8_000_000_000n })).ix);
  await send(env, (await inbound(env, { kind: 6, nonce: 4n, sequence: 2n, amount: 9_000_000_000n })).ix);
  assert.equal(goalState(env).remoteNetAssets, 8_000_000_000n);
  assert.equal(goalState(env).remoteProgressSequence, 3n);
  assert.equal(goalState(env).remoteReserved, 0n);
});

test("SBF failed lifecycle CPI rolls back clear; late READY then ABORT_ACK can retry", async () => {
  const env = await environment(); await send(env, (await inbound(env)).ix);
  await send(env, instruction(CORE, "begin_prepare", ownerGoal(env)));
  await send(env, instruction(CORE, "begin_abort", ownerGoal(env)));
  const ack = await inbound(env, { kind: 5, nonce: 3n, round: 1n, sequence: 2n, amount: 0n });
  await send(env, ack.ix, false);
  assert(env.svm.getAccount(ack.payload).exists, "failed core CPI must roll back Endpoint clear");
  await send(env, (await inbound(env, { kind: 4, nonce: 2n, round: 1n, sequence: 1n, amount: 4_100_000_000n })).ix);
  assert.equal(goalState(env).remoteReserved, 0n);
  await send(env, ack.ix);
  assert.equal(goalState(env).phase, 0); assert.equal(goalState(env).inboundSequence, 2n);
  assert(!env.svm.getAccount(ack.payload).exists);
  await send(env, instruction(CORE, "begin_prepare", ownerGoal(env)));
  assert.equal(goalState(env).round, 2n);
});
