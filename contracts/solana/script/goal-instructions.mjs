// Instruction encoding/account order mirrors the deployed Anchor source, not a mock transport.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { packetAccounts } from './layerzero-config.mjs';
const require = createRequire(process.env.NABUNGFI_LZ_PACKAGE_JSON || new URL('../package.json', import.meta.url));
const web3 = require('@solana/web3.js');
const sdk = require('@layerzerolabs/lz-solana-sdk-v2').UMI;
const manifest = JSON.parse(readFileSync(new URL('../../deployments/solana-devnet.json', import.meta.url), 'utf8'));
const key = a => new web3.PublicKey(a);
const bytes = a => key(a).toBuffer();
const evmBytes = a => { assert(/^0x[0-9a-fA-F]{40}$/.test(a)); return Buffer.concat([Buffer.alloc(12), Buffer.from(a.slice(2), 'hex')]); };
const discriminator = name => createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
const u32 = (n, endian = 'LE') => { const b = Buffer.alloc(4); b[`writeUInt32${endian}`](Number(n)); return b; };
const u64 = (n, endian = 'LE') => { assert(BigInt(n) >= 0n && BigInt(n) <= 0xffffffffffffffffn); const b = Buffer.alloc(8); b[`writeBigUInt64${endian}`](BigInt(n)); return b; };
const meta = (address, isWritable = false, isSigner = false) => ({ pubkey: key(address), isWritable, isSigner });
const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const SYSTEM = '11111111111111111111111111111111';
export function goalContext({ owner, goalId, remoteOwner, remoteVault, target }) {
  assert(/^0x[0-9a-fA-F]{64}$/.test(goalId)); const id = Buffer.from(goalId.slice(2), 'hex');
  const core = manifest.core.program, transport = manifest.transport.program;
  const [goal, bump] = web3.PublicKey.findProgramAddressSync([Buffer.from('goal'), bytes(owner), id], key(core));
  const pda = seed => web3.PublicKey.findProgramAddressSync([Buffer.from(seed), goal.toBuffer()], key(core))[0].toBase58();
  const store = manifest.oapp.store;
  const [peer] = web3.PublicKey.findProgramAddressSync([Buffer.from('Peer'), bytes(store), u32(manifest.oapp.baseEid, 'BE')], key(transport));
  const usdc = manifest.usdcMint, collateral = manifest.inertCollateralMint.address;
  const hash = createHash('sha256').update(Buffer.concat([Buffer.from('NABUNGFI_SOLANA_CONFIG_V1'), bytes(core), goal.toBuffer(), bytes(owner), id, u64(target), evmBytes(remoteOwner), evmBytes(remoteVault), u32(2), bytes(usdc), ...[1,2,3,4].map(() => bytes(collateral)), bytes(transport)])).digest();
  return { owner, id, goalId, remoteOwner, remoteVault, target: BigInt(target), core, transport, goal: goal.toBase58(), bump, cash: pda('usdc'), shares: pda('shares'), store, peer: peer.toBase58(), usdc, collateral, configHash: `0x${hash.toString('hex')}` };
}
const ix = (program, name, accounts, ...data) => new web3.TransactionInstruction({ programId: key(program), keys: accounts, data: Buffer.concat([discriminator(name), ...data]) });
export const initializeGoal = g => ix(g.core, 'initialize', [meta(g.owner, true, true), meta(g.goal, true), meta(g.usdc), meta(g.collateral), meta(g.cash, true), meta(g.shares, true), meta(TOKEN), meta(SYSTEM)], g.id, u64(g.target), evmBytes(g.remoteOwner), evmBytes(g.remoteVault));
export const deposit = (g, source, amount) => ix(g.core, 'deposit', [meta(g.owner, false, true), meta(g.goal, true), meta(g.usdc), meta(source, true), meta(g.cash, true), meta(TOKEN)], u64(amount));
export const beginPrepare = g => ix(g.core, 'begin_prepare', [meta(g.owner, false, true), meta(g.goal, true)]);
export const markLocalReady = g => ix(g.core, 'mark_local_ready', [meta(g.goal, true), meta(g.cash), meta(g.shares)]);
export const achieve = g => ix(g.core, 'achieve', [meta(g.goal, true), meta(g.cash), meta(g.shares)]);
export const claim = (g, destination, amount) => ix(g.core, 'claim', [meta(g.owner, false, true), meta(g.goal, true), meta(g.usdc), meta(g.cash, true), meta(destination, true), meta(TOKEN)], u64(amount));
export function sealRoute(g) {
  const endpoint = new sdk.EndpointProgram.Endpoint(manifest.oapp.endpoint);
  return ix(g.transport, 'seal_route', [meta(g.owner, false, true), meta(g.store, true), ...endpoint.getSetDelegateIxAccountMetaForCPI(g.store).map(m => meta(m.pubkey, m.isWritable, false))]);
}
export async function transportQuote(c, g, sequence, options) {
  const { quote } = await packetAccounts(c, g.owner);
  return ix(g.transport, 'quote', [meta(g.store), meta(g.peer), meta(g.goal), ...quote.map(m => meta(m.pubkey, m.isWritable, false))], u64(sequence), u32(options.length), Buffer.from(options));
}
export async function transportSend(c, g, payer, sequence, nativeFee, options) {
  const { send } = await packetAccounts(c, payer);
  return ix(g.transport, 'send', [meta(payer, false, true), meta(g.store), meta(g.peer), meta(g.goal), ...send.map(m => meta(m.pubkey, m.isWritable, m.isSigner && m.pubkey === payer))], u64(sequence), u64(nativeFee), u32(options.length), Buffer.from(options));
}
export function decodeGoal(data) {
  const b = Buffer.from(data); let offset = 8;
  assert(b.subarray(0, 8).equals(createHash('sha256').update('account:Goal').digest().subarray(0, 8)));
  const take = n => { const value = b.subarray(offset, offset + n); offset += n; return value; };
  const number = () => take(8).readBigUInt64LE();
  const g = { owner: new web3.PublicKey(take(32)).toBase58(), goalId: `0x${take(32).toString('hex')}`, configHash: `0x${take(32).toString('hex')}`, target: number(), remoteOwner: `0x${take(32).subarray(12).toString('hex')}`, remoteVault: `0x${take(32).subarray(12).toString('hex')}`, linked: take(1)[0] === 1 };
  for (const field of ['remoteNetAssets','remoteProgressSequence','remoteObservation','remoteObservedAt','remoteReceivedAt','principal','claimed','round','inboundSequence','outboundSequence','localReserved','localReadySlot','remoteReserved','achievedTotal']) g[field] = number();
  g.localReady = take(1)[0] === 1; g.remoteReady = take(1)[0] === 1; g.phase = take(1)[0]; g.bump = take(1)[0]; assert.equal(offset, b.length); return g;
}
export function registeredPacket(g, { observation, observedAt }) {
  assert(BigInt(observation) > 0n && BigInt(observedAt) > 0n, 'Source block and timestamp must be positive');
  const packet = Buffer.concat([Buffer.from('NBFG'), Buffer.from([1,8]), u32(2,'BE'), u32(1,'BE'), g.id, Buffer.from(g.configHash.slice(2),'hex'), evmBytes(g.remoteVault), bytes(g.goal), evmBytes(g.remoteOwner), ...[0n,0n,g.target,0n,BigInt(observation),BigInt(observedAt)].map(n=>u64(n,'BE'))]);
  assert.equal(packet.length, 222); return packet;
}
export function receiveParameters(g, message) {
  assert.equal(message.length, 222);
  return { srcEid: manifest.oapp.baseEid, sender: evmBytes(manifest.oapp.basePeer), nonce: 1n, guid: Buffer.alloc(32,1), message, extraData: Buffer.alloc(0) };
}
export async function receiveDiscovery(c, g, sourceObservation) {
  const params = receiveParameters(g, registeredPacket(g, sourceObservation));
  const info = await sdk.getLzReceiveTypesInfo(c.rpc, g.owner, g.store, g.transport, params);
  const plan = await sdk.buildLzReceiveExecutionPlan(c.rpc, '6doghB248px58JSSwG4qejQ46kFMW4AMj7vzJnWZHNZn', g.owner, g.store, g.transport, params, info);
  assert.equal(plan.contextVersion, 1); assert.equal(plan.instructions.length, 1);
  assert.equal(plan.instructions[0].keys[3].pubkey, g.goal);
  return { info, plan };
}
export async function simulateSealed(c, g, signer, instructions) {
  const block = await c.connection.getLatestBlockhash('confirmed');
  const transaction = new web3.VersionedTransaction(new web3.TransactionMessage({ payerKey: signer.publicKey, recentBlockhash: block.blockhash, instructions: [sealRoute(g), ...instructions] }).compileToV0Message());
  transaction.sign([signer]);
  const { value } = await c.connection.simulateTransaction(transaction, { sigVerify: true, commitment: 'confirmed' });
  if (value.err) throw new Error(JSON.stringify({ error: value.err, logs: value.logs }));
  return { unitsConsumed: value.unitsConsumed, returnData: value.returnData, transactionBytes: transaction.serialize().length };
}
export async function preflightReceiveDiscovery(c, g, signer, sourceObservation) {
  const params = receiveParameters(g, registeredPacket(g, sourceObservation));
  const info = await sdk.getLzReceiveTypesInfo(c.rpc, g.owner, g.store, g.transport, params);
  const data = sdk.getLzReceiveParamsSerializer().serialize(params);
  const instruction = ix(g.transport, 'lz_receive_types_v2', info.accounts.map(a => meta(a)), Buffer.from(data));
  const simulation = await simulateSealed(c, g, signer, [instruction]);
  assert.equal(simulation.returnData.programId, g.transport);
  const [plan] = sdk.getLzReceiveTypesV2ResultSerializer().deserialize(Buffer.from(simulation.returnData.data[0], 'base64'));
  assert.equal(plan.contextVersion, 1); assert.equal(plan.instructions.length, 1);
  const account = plan.instructions[0].accounts[3];
  assert.equal(account.pubkey.__kind, 'Address');
  assert.equal(account.pubkey.fields[0], g.goal);
  return { info, simulation, plan };
}
