import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { submitJournaled } from '../script/transaction-journal.mjs';

const require = createRequire(process.env.NABUNGFI_LZ_PACKAGE_JSON || new URL('../package.json', import.meta.url));
const { Keypair, SystemProgram } = require('@solana/web3.js');
const GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';

// This is a local retry-safety regression, not a public transaction or delivery test.
test('journal reconciles the original signature and rejects a different financial intent', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'nabungfi-journal-'));
  const path = join(directory, 'receipt.json');
  const signer = Keypair.generate();
  const recipient = Keypair.generate().publicKey;
  let sends = 0;
  let pending = false;
  let genesis = GENESIS;
  const connection = {
    getGenesisHash: async () => genesis,
    getLatestBlockhash: async () => ({ blockhash: Keypair.generate().publicKey.toBase58(), lastValidBlockHeight: 100 }),
    simulateTransaction: async () => ({ value: { err: null, unitsConsumed: 150 } }),
    sendRawTransaction: async () => {
      // The original signature is durable before a network-side effect.
      assert.equal(JSON.parse(readFileSync(path, 'utf8')).operations['goal-1:claim:4'].status, 'submitted');
      sends += 1;
    },
    getSignatureStatuses: async () => ({ value: [pending ? null : { err: null, confirmationStatus: 'finalized', slot: 25 }] }),
    getBlockHeight: async () => 101,
  };
  const instruction = amount => SystemProgram.transfer({ fromPubkey: signer.publicKey, toPubkey: recipient, lamports: amount });
  try {
    const original = await submitJournaled(connection, signer, [instruction(4)], path, 'goal-1:claim:4');
    assert.equal(original.status, 'finalized');
    assert.equal(sends, 1);

    const reconciled = await submitJournaled(connection, signer, [instruction(4)], path, 'goal-1:claim:4');
    assert.equal(reconciled.signature, original.signature);
    assert.equal(sends, 1);

    await assert.rejects(submitJournaled(connection, signer, [instruction(6)], path, 'goal-1:claim:4'), /different instructions/);
    assert.equal(sends, 1);

    pending = true;
    await assert.rejects(submitJournaled(connection, signer, [instruction(4)], path, 'goal-1:claim:4'), /expired; reconcile account state explicitly/);
    assert.equal(sends, 1);

    genesis = 'wrong-network';
    await assert.rejects(submitJournaled(connection, signer, [instruction(4)], path, 'goal-2:claim:4'), /Devnet genesis mismatch/);
    assert.equal(sends, 1);
  } finally {
    unlinkSync(path);
    rmdirSync(directory);
  }
});
