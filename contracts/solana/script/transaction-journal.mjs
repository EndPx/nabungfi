import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const require = createRequire(process.env.NABUNGFI_LZ_PACKAGE_JSON || new URL('../package.json', import.meta.url));
const web3 = require('@solana/web3.js');
const bs58Module = require('bs58'); const bs58 = bs58Module.default || bs58Module;
const sleep = ms => new Promise(done => setTimeout(done, ms));
export async function submitJournaled(connection, signer, instructions, journalPath, operation) {
  assert.equal(await connection.getGenesisHash(), 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG', 'Devnet genesis mismatch');
  let journal = existsSync(journalPath) ? JSON.parse(readFileSync(journalPath, 'utf8')) : { network: 'solana-devnet', signer: signer.publicKey.toBase58(), operations: {} };
  assert.equal(journal.signer, signer.publicKey.toBase58());
  const save = () => { mkdirSync(dirname(journalPath), { recursive: true }); writeFileSync(journalPath, JSON.stringify(journal, null, 2)); };
  const instructionHash = createHash('sha256').update(JSON.stringify(instructions.map(ix => ({ program: ix.programId.toBase58(), accounts: ix.keys.map(k => ({ address: k.pubkey.toBase58(), signer: k.isSigner, writable: k.isWritable })), data: ix.data.toString('hex') })))).digest('hex');
  const prior = journal.operations[operation];
  if (prior) {
    assert(prior.instructionHash, `${operation}: legacy receipt lacks instruction hash; reconcile manually, do not replace`);
    assert.equal(prior.instructionHash, instructionHash, `${operation}: operation key reused with different instructions`);
    const status = (await connection.getSignatureStatuses([prior.signature], { searchTransactionHistory: true })).value[0];
    assert(!status?.err, `${operation}: previously submitted transaction failed; inspect journal`);
    if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') { prior.status = status.confirmationStatus; prior.slot = status.slot; save(); return prior; }
    const height = await connection.getBlockHeight('confirmed');
    throw new Error(`${operation}: prior signature ${prior.signature} unresolved (${height > prior.lastValidBlockHeight ? 'expired; reconcile account state explicitly' : 'pending'}); no automatic replacement`);
  }
  const block = await connection.getLatestBlockhash('confirmed');
  const tx = new web3.VersionedTransaction(new web3.TransactionMessage({ payerKey: signer.publicKey, recentBlockhash: block.blockhash, instructions }).compileToV0Message());
  tx.sign([signer]);
  const simulation = await connection.simulateTransaction(tx, { sigVerify: true, commitment: 'confirmed' });
  if (simulation.value.err) throw new Error(JSON.stringify({ operation, error: simulation.value.err, logs: simulation.value.logs }));
  const signature = bs58.encode(tx.signatures[0]);
  journal.operations[operation] = { signature, instructionHash, status: 'submitted', blockhash: block.blockhash, lastValidBlockHeight: block.lastValidBlockHeight, simulationUnits: simulation.value.unitsConsumed, submittedAt: new Date().toISOString() }; save();
  await connection.sendRawTransaction(tx.serialize(), { preflightCommitment: 'confirmed', maxRetries: 4 });
  for (let attempts = 0; attempts < 60; attempts++) {
    await sleep(1000); const status = (await connection.getSignatureStatuses([signature])).value[0];
    if (status?.err) { journal.operations[operation].status = 'failed'; journal.operations[operation].error = status.err; save(); throw new Error(`${operation} failed: ${signature}`); }
    if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') {
      journal.operations[operation].status = status.confirmationStatus; journal.operations[operation].slot = status.slot; save(); return journal.operations[operation];
    }
  }
  throw new Error(`${operation} pending: ${signature}; reconcile journal before retry`);
}
