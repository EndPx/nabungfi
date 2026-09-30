// Official SDK 3.0.168 UMI branch. This command only plans/simulates;
// wire-layerzero.mjs submits the reviewed reversible configuration through a journal.
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const require = createRequire(process.env.NABUNGFI_LZ_PACKAGE_JSON || new URL('../package.json', import.meta.url));
const sdk = require('@layerzerolabs/lz-solana-sdk-v2').UMI;
const { publicKey, createNoopSigner } = require('@metaplex-foundation/umi');
const { createWeb3JsRpc } = require('@metaplex-foundation/umi-rpc-web3js');
const web3 = require('@solana/web3.js');

export function loadEnvironment(path) {
  const entries = existsSync(path) ? Object.fromEntries(readFileSync(path, 'utf8').split(/\r?\n/).filter(line => line && !line.startsWith('#') && line.includes('=')).map(line => {
    const index = line.indexOf('='); return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')];
  })) : {};
  return { ...entries, ...process.env };
}
export function context(environment) {
  const required = name => { assert(environment[name], `Missing ${name}`); return environment[name]; };
  const address = name => publicKey(required(name).startsWith('0x') ? new web3.PublicKey(Buffer.from(required(name).slice(2), 'hex')).toBase58() : required(name));
  const rpcUrl = required('SOLANA_DEVNET_RPC_URL');
  const raw = createWeb3JsRpc({}, rpcUrl, 'confirmed'); let next = 0;
  const rpc = new Proxy(raw, { get(target, property) {
    const value = target[property];
    if (property === 'getEndpoint' || property === 'getCluster') return value.bind(target);
    return typeof value === 'function' ? async (...args) => {
      const delay = Math.max(0, next - Date.now()); next = Math.max(next, Date.now()) + 550;
      await new Promise(done => setTimeout(done, delay)); return value.apply(target, args);
    } : value;
  } });
  const endpoint = new sdk.EndpointProgram.Endpoint(address('SOLANA_DEVNET_ENDPOINT'));
  const uln = new sdk.UlnProgram.Uln(address('SOLANA_DEVNET_ULN'));
  const store = address('SOLANA_DEVNET_STORE'); const remote = Number(required('BASE_SEPOLIA_EID'));
  assert.equal(endpoint.programId, '76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6');
  assert.equal(uln.programId, '7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH');
  assert.equal(store, '5fMoiRiAghVMDtKYfJno7FFy8WF1hbwDV1iuKhHxtJ49');
  assert.equal(remote, 40245);
  assert.equal(required('BASE_SEPOLIA_ROUTER').toLowerCase(), '0x9b897086dbdf754ed88ce3610e2a40c3df1ab40b');
  assert.equal(required('SOLANA_DEVNET_SEND_CONFIRMATIONS'), '10');
  assert.equal(required('SOLANA_DEVNET_RECEIVE_CONFIRMATIONS'), '2');
  assert.equal(address('SOLANA_DEVNET_DVN'), '4VDjp6XQaxoZf5RGwiPU9NR1EXSZn2TP4ATMmiSzLfhb');
  assert.equal(address('SOLANA_DEVNET_EXECUTOR'), 'AwrbHeCyniXaQhiJZkLhgWdUCteeWSGaSN1sTfLiY7xK');
  const receiver = Buffer.concat([Buffer.alloc(12), Buffer.from(required('BASE_SEPOLIA_ROUTER').slice(2), 'hex')]);
  return { rpc, connection: raw.connection, endpoint, uln, store, remote, receiver, environment,
    dvn: address('SOLANA_DEVNET_DVN'), executor: address('SOLANA_DEVNET_EXECUTOR'),
    sendConfirmations: BigInt(required('SOLANA_DEVNET_SEND_CONFIRMATIONS')), receiveConfirmations: BigInt(required('SOLANA_DEVNET_RECEIVE_CONFIRMATIONS')) };
}
export async function inspect(c) {
  const { rpc, endpoint, uln, store, remote, receiver } = c;
  const results = {
    defaultSendLibrary: await endpoint.getDefaultSendLibrary(rpc, remote),
    defaultReceiveLibrary: await endpoint.getDefaultReceiveLibrary(rpc, remote),
    sendConfig: await uln.getSendConfigState(rpc, store, remote),
    receiveConfig: await uln.getReceiveConfigState(rpc, store, remote),
    defaultSendConfig: await uln.getDefaultSendConfigState(rpc, remote),
    defaultReceiveConfig: await uln.getDefaultReceiveConfigState(rpc, remote),
  };
  const peerEid = Buffer.alloc(4); peerEid.writeUInt32BE(remote);
  const [peer] = web3.PublicKey.findProgramAddressSync([Buffer.from('Peer'), new web3.PublicKey(store).toBuffer(), peerEid], new web3.PublicKey('Fez821Y7EAC8rLNqG1WeVmVAcSZPKtd3QuQxFuAiCc5A'));
  const keys = [store, endpoint.pda.oappRegistry(store)[0], endpoint.pda.nonce(store, remote, receiver)[0], endpoint.pda.sendLibraryConfig(store, remote)[0], endpoint.pda.receiveLibraryConfig(store, remote)[0], publicKey(peer.toBase58())];
  const accounts = await rpc.getAccounts(keys); results.accounts = accounts;
  assert(accounts[0].exists, 'OApp store missing'); assert(accounts[1].exists, 'OApp registration missing');
  assert.equal(accounts[0].owner, 'Fez821Y7EAC8rLNqG1WeVmVAcSZPKtd3QuQxFuAiCc5A');
  assert.equal(accounts[1].owner, endpoint.programId);
  assert.equal(new web3.PublicKey(accounts[0].data.subarray(40, 72)).toBase58(), endpoint.programId);
  assert.equal(Buffer.from(accounts[0].data).readUInt32LE(72), remote);
  assert(accounts[5].exists && accounts[5].owner === accounts[0].owner, 'Peer configuration missing or wrong owner');
  assert(Buffer.from(accounts[5].data).subarray(8, 40).equals(receiver), 'Live peer differs from requested Base router');
  results.routeSealed = accounts[0].data[76] === 1;
  const workerAccounts = await rpc.getAccounts([c.dvn, c.executor]);
  assert(workerAccounts.every(a => a.exists), 'Worker configuration missing');
  const dvn = sdk.DvnProgram.deserializeDvnConfig(workerAccounts[0]);
  const executor = sdk.ExecutorProgram.accounts.deserializeExecutorConfig(workerAccounts[1]);
  assert.equal(workerAccounts[0].owner, 'HtEYV4xB4wvsj5fgTkcfuChYpvGYzgzwvNhgDZQNh7wW');
  assert.equal(workerAccounts[1].owner, '6doghB248px58JSSwG4qejQ46kFMW4AMj7vzJnWZHNZn');
  assert(dvn.msglibs.includes(new sdk.MessageLibPDA(uln.programId).messageLib()[0]), 'DVN does not authorize this ULN');
  assert(!dvn.paused && !executor.paused, 'Worker paused');
  assert(dvn.dstConfigs.some(d => d.eid === remote), 'DVN destination unsupported');
  assert(executor.dstConfigs.some(d => d.eid === remote), 'Executor destination unsupported');
  results.workers = { dvnOwner: workerAccounts[0].owner, executorOwner: workerAccounts[1].owner, dvnDestination: dvn.dstConfigs.find(d => d.eid === remote), executorDestination: executor.dstConfigs.find(d => d.eid === remote) };
  return results;
}
export async function configurationPlan(c, payer) {
  const state = await inspect(c); assert(!state.routeSealed, 'Route already sealed; delegate changes prohibited');
  const registry = sdk.EndpointProgram.accounts.deserializeOAppRegistry(state.accounts[1]);
  assert.equal(registry.delegate, payer, 'Payer is not OApp delegate');
  const delegate = createNoopSigner(publicKey(payer)); const plan = [];
  assert(Boolean(state.sendConfig) === Boolean(state.receiveConfig), 'Partial ULN initialization: reconcile accounts before continuing');
  const push = (name, wrapped) => plan.push({ name, instruction: wrapped.instruction });
  if (!state.accounts[2].exists) push('initialize-nonce', c.endpoint.initOAppNonce(delegate, { localOApp: c.store, remote: c.remote, remoteOApp: c.receiver }));
  if (!state.accounts[3].exists) push('initialize-send-library', c.endpoint.initOAppSendLibrary(delegate, { sender: c.store, remote: c.remote }));
  if (!state.accounts[4].exists) push('initialize-receive-library', c.endpoint.initOAppReceiveLibrary(delegate, { receiver: c.store, remote: c.remote }));
  if (!state.sendConfig || !state.receiveConfig) push('initialize-uln-config', c.endpoint.initOAppConfig({ delegate, payer: publicKey(payer) }, { msgLibSDK: c.uln, oapp: c.store, remote: c.remote }));
  push('set-send-library', c.endpoint.setOAppSendLibrary(delegate, { sender: c.store, remote: c.remote, msgLibProgram: c.uln.programId }));
  push('set-receive-library', c.endpoint.setOAppReceiveLibrary(delegate, { receiver: c.store, remote: c.remote, msgLibProgram: c.uln.programId, gracePeriod: 0n }));
  for (const [name, configType, value] of [
    ['set-executor', sdk.SetConfigType.EXECUTOR, { maxMessageSize: 10000, executor: c.executor }],
    ['set-send-uln', sdk.SetConfigType.SEND_ULN, { confirmations: c.sendConfirmations, requiredDvnCount: 1, optionalDvnCount: 255, optionalDvnThreshold: 0, requiredDvns: [c.dvn], optionalDvns: [] }],
    ['set-receive-uln', sdk.SetConfigType.RECEIVE_ULN, { confirmations: c.receiveConfirmations, requiredDvnCount: 1, optionalDvnCount: 255, optionalDvnThreshold: 0, requiredDvns: [c.dvn], optionalDvns: [] }],
  ]) push(name, await c.endpoint.setOAppConfig(c.rpc, delegate, { oapp: c.store, eid: c.remote, config: { configType, value }, msgLibProgram: c.uln.programId, msgLibVersion: { major: 3n, minor: 0, endpointVersion: 2 } }));
  return { state, plan };
}
export const toWeb3Instruction = ix => new web3.TransactionInstruction({ programId: new web3.PublicKey(ix.programId), keys: ix.keys.map(m => ({ pubkey: new web3.PublicKey(m.pubkey), isSigner: m.isSigner, isWritable: m.isWritable })), data: Buffer.from(ix.data) });
export async function packetAccounts(c, payer) {
  const params = { path: { sender: c.store, dstEid: c.remote, receiver: c.receiver }, msgLibProgram: c.uln };
  return { quote: await c.endpoint.getQuoteIXAccountMetaForCPI(c.rpc, publicKey(payer), params), send: await c.endpoint.getSendIXAccountMetaForCPI(c.rpc, publicKey(payer), params) };
}
export async function verifyExplicit(c) {
  const sendLibrary = await c.endpoint.getSendLibrary(c.rpc, c.store, c.remote);
  const receiveLibrary = await c.endpoint.getReceiveLibrary(c.rpc, c.store, c.remote);
  assert(!sendLibrary.isDefault && !receiveLibrary.isDefault, 'Custom libraries required before sealing');
  assert.equal(sendLibrary.programId, c.uln.programId); assert.equal(receiveLibrary.programId, c.uln.programId);
  const send = await c.uln.getFinalSendConfigState(c.rpc, c.store, c.remote);
  const receive = await c.uln.getFinalReceiveConfigState(c.rpc, c.store, c.remote);
  assert.equal(send.confirmations, c.sendConfirmations); assert.equal(receive.confirmations, c.receiveConfirmations);
  assert.deepEqual(send.requiredDvns, [c.dvn]); assert.deepEqual(receive.requiredDvns, [c.dvn]);
  assert.equal(send.optionalDvnCount, 0); assert.equal(receive.optionalDvnCount, 0);
  const config = await c.uln.getSendConfigState(c.rpc, c.store, c.remote);
  const receiveConfig = await c.uln.getReceiveConfigState(c.rpc, c.store, c.remote);
  for (const custom of [config.uln, receiveConfig.uln]) {
    assert.equal(custom.requiredDvnCount, 1); assert.equal(custom.optionalDvnCount, 255);
    assert.equal(custom.optionalDvnThreshold, 0); assert.deepEqual(custom.optionalDvns, []);
    assert.deepEqual(custom.requiredDvns, [c.dvn]);
  }
  assert.equal(config.executor.executor, c.executor); assert.equal(config.executor.maxMessageSize, 10000);
  return { sendLibrary, receiveLibrary, send, receive, executor: config.executor };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const envIndex = process.argv.indexOf('--env');
  const envPath = envIndex >= 0 ? process.argv[envIndex + 1] : resolve('contracts/solana/.env');
  const c = context(loadEnvironment(envPath));
  const payerPath = c.environment.SOLANA_DEVNET_SIGNER_PATH; assert(payerPath, 'Missing SOLANA_DEVNET_SIGNER_PATH');
  const signer = web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(payerPath, 'utf8'))));
  const { plan, state } = await configurationPlan(c, signer.publicKey.toBase58());
  console.log(JSON.stringify({ routeSealed: state.routeSealed, planned: plan.map(p => ({ name: p.name, program: p.instruction.programId, accounts: p.instruction.keys.length, dataBytes: p.instruction.data.length })) }));
  // Initialization is simulated atomically. Later phases run after its confirmed receipt;
  // nine instructions exceed Solana's packet limit without an onchain lookup table.
  const block = await c.connection.getLatestBlockhash('confirmed');
  const phaseIndex = process.argv.indexOf('--phase');
  const phase = phaseIndex >= 0 ? process.argv[phaseIndex + 1] : 'initialize';
  const selected = plan.filter(p => phase === 'initialize' ? p.name.startsWith('initialize-') : phase === 'libraries' ? p.name.endsWith('-library') && !p.name.startsWith('initialize-') : p.name === phase);
  assert(selected.length, `No instructions for phase ${phase}`);
  const instructions = selected.map(p => toWeb3Instruction(p.instruction));
  const tx = new web3.VersionedTransaction(new web3.TransactionMessage({ payerKey: signer.publicKey, recentBlockhash: block.blockhash, instructions }).compileToV0Message());
  tx.sign([signer]);
  const result = await c.connection.simulateTransaction(tx, { sigVerify: true, commitment: 'confirmed' });
  console.log(JSON.stringify({ simulationError: result.value.err, unitsConsumed: result.value.unitsConsumed, logs: result.value.err ? result.value.logs : undefined }));
  assert(!result.value.err, 'Configuration simulation failed');
  if (process.argv.includes('--broadcast')) throw new Error('Broadcast configuration only through reviewed journal runner; this command never seals or broadcasts');
}
