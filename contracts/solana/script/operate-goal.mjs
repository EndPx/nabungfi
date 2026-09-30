// Targeted Solana Devnet/Base Sepolia operator. Default execution only simulates.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { context, loadEnvironment, verifyExplicit } from './layerzero-config.mjs';
import { goalContext, initializeGoal, decodeGoal, deposit, beginPrepare, markLocalReady, achieve, claim, transportQuote, transportSend } from './goal-instructions.mjs';
import { submitJournaled } from './transaction-journal.mjs';
const require = createRequire(process.env.NABUNGFI_LZ_PACKAGE_JSON || new URL('../package.json', import.meta.url));
const web3 = require('@solana/web3.js');
const argument = name => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const c = context(loadEnvironment(argument('--env') || resolve('contracts/solana/.env')));
const signer = web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(c.environment.SOLANA_DEVNET_SIGNER_PATH, 'utf8'))));
const required = name => { assert(c.environment[name], `Missing ${name}`); return c.environment[name]; };
const g = goalContext({ owner: signer.publicKey.toBase58(), goalId: required('NABUNGFI_GOAL_ID'), remoteOwner: required('NABUNGFI_BASE_OWNER'), remoteVault: required('NABUNGFI_BASE_VAULT'), target: required('NABUNGFI_TARGET_RAW') });
assert.equal(await c.connection.getGenesisHash(), 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG');
await verifyExplicit(c);
const action = process.argv[2]; const amount = argument('--amount') ? BigInt(argument('--amount')) : undefined;
const account = await c.connection.getAccountInfo(new web3.PublicKey(g.goal), 'confirmed');
if (account) assert.equal(account.owner.toBase58(), g.core, 'Goal has wrong owning program');
const state = account ? decodeGoal(account.data) : undefined;
if (state) {
  assert.equal(state.owner, g.owner); assert.equal(state.configHash, g.configHash); assert.equal(state.target, g.target);
  assert.equal(state.goalId, g.goalId); assert.equal(state.remoteVault, g.remoteVault.toLowerCase());
}
const print = value => console.log(JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item));
if (action === 'state') { print({ goal: g.goal, state }); process.exit(0); }
const getAccount = () => required('NABUNGFI_USDC_ACCOUNT');
const positiveAmount = () => { assert(amount !== undefined && amount > 0n, 'Specify positive --amount in raw USDC units'); return amount; };
let instructions;
if (action === 'initialize') {
  assert(!state, 'Goal already exists; inspect state and prior receipt');
  // Require the actual Base vault to expose the same configuration hash before binding funds.
  const { keccak_256 } = require('@noble/hashes/sha3.js');
  const selector = signature => `0x${Buffer.from(keccak_256(Buffer.from(signature))).subarray(0, 4).toString('hex')}`;
  const call = async (method, params) => (await (await fetch(required('BASE_SEPOLIA_RPC_URL'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })).json());
  assert.equal((await call('eth_chainId', [])).result, '0x14a34', 'Base Sepolia chain mismatch');
  const provenance = await call('eth_call', [{ to: c.environment.BASE_SEPOLIA_ROUTER, data: `${selector('isVault(address)')}${g.remoteVault.slice(2).toLowerCase().padStart(64, '0')}` }, 'latest']);
  assert(!provenance.error && BigInt(provenance.result) === 1n, 'Vault is not registered with the configured router');
  const response = await call('eth_call', [{ to: g.remoteVault, data: selector('configHash()') }, 'latest']);
  assert(!response.error); assert.equal(response.result?.toLowerCase(), g.configHash);
  instructions = [initializeGoal(g)];
} else {
  assert(state, 'Initialize the goal first');
  if (action === 'deposit') { assert(state.linked && state.phase === 0); instructions = [deposit(g, getAccount(), positiveAmount())]; }
  else if (action === 'prepare') { assert(state.linked && state.phase === 0); instructions = [beginPrepare(g)]; }
  else if (action === 'local-ready') { assert.equal(state.phase, 1); instructions = [markLocalReady(g)]; }
  else if (action === 'achieve') { assert(state.phase === 1 && state.localReady && state.remoteReady); instructions = [achieve(g)]; }
  else if (action === 'claim') { assert.equal(state.phase, 3); instructions = [claim(g, getAccount(), positiveAmount())]; }
  else if (action === 'register' || action === 'send-command') {
    if (action === 'register') assert(!state.linked, 'Already linked; registration retry requires delivery reconciliation');
    const sequence = action === 'register' ? 0n : state.outboundSequence;
    assert(action === 'register' || sequence > 0n);
    // Type-3 Executor LzReceive option: worker=1, size=17, type=1, 500k gas, no value.
    const gas = Buffer.alloc(16); gas.writeBigUInt64BE(500000n, 8);
    const options = Buffer.concat([Buffer.from('000301001101', 'hex'), gas]);
    const quote = await transportQuote(c, g, sequence, options);
    const block = await c.connection.getLatestBlockhash('confirmed');
    const tx = new web3.VersionedTransaction(new web3.TransactionMessage({ payerKey: signer.publicKey, recentBlockhash: block.blockhash, instructions: [quote] }).compileToV0Message()); tx.sign([signer]);
    const result = await c.connection.simulateTransaction(tx, { sigVerify: true, commitment: 'confirmed' });
    assert(!result.value.err, JSON.stringify(result.value.logs)); assert.equal(result.value.returnData.programId, g.transport);
    const data = Buffer.from(result.value.returnData.data[0], 'base64'); assert.equal(data.length, 16);
    const fee = data.readBigUInt64LE();
    assert.equal(data.readBigUInt64LE(8), 0n); assert(fee > 0n && fee <= BigInt(required('NABUNGFI_MAX_MESSAGE_FEE_LAMPORTS')), 'Native fee exceeds configured cap or is zero');
    print({ sequence, quotedNativeFee: fee });
    instructions = [web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 500000 }), await transportSend(c, g, g.owner, sequence, fee, options)];
  } else throw new Error('Actions: state, initialize, register, deposit, prepare, local-ready, achieve, send-command, claim');
}
if (process.argv.includes('--broadcast')) {
  const operationId = argument('--operation-id'); assert(operationId, '--broadcast requires unique --operation-id per financial intent; reuse only to reconcile the same intent');
  print(await submitJournaled(c.connection, signer, instructions, required('NABUNGFI_TRANSACTION_JOURNAL'), `${g.goalId}:${action}:${operationId}`));
} else {
  const block = await c.connection.getLatestBlockhash('confirmed');
  const tx = new web3.VersionedTransaction(new web3.TransactionMessage({ payerKey: signer.publicKey, recentBlockhash: block.blockhash, instructions }).compileToV0Message()); tx.sign([signer]);
  assert(tx.serialize().length <= 1232, 'Transaction exceeds packet limit');
  const { value } = await c.connection.simulateTransaction(tx, { sigVerify: true, commitment: 'confirmed' });
  print({ broadcast: false, action, goal: g.goal, error: value.err, unitsConsumed: value.unitsConsumed, logs: value.err ? value.logs : undefined });
  assert(!value.err, 'Simulation failed; no transaction broadcast');
}
