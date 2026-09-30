import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { context, loadEnvironment, configurationPlan, verifyExplicit, toWeb3Instruction } from './layerzero-config.mjs';
import { submitJournaled } from './transaction-journal.mjs';
const require = createRequire(process.env.NABUNGFI_LZ_PACKAGE_JSON || new URL('../package.json', import.meta.url));
const web3 = require('@solana/web3.js');
assert(process.argv.includes('--broadcast'), 'Run layerzero-config.mjs for read-only planning; wiring requires --broadcast');
const envIndex = process.argv.indexOf('--env');
const c = context(loadEnvironment(envIndex >= 0 ? process.argv[envIndex + 1] : resolve('contracts/solana/.env')));
const signer = web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(c.environment.SOLANA_DEVNET_SIGNER_PATH, 'utf8'))));
const journal = c.environment.SOLANA_DEVNET_CONFIG_JOURNAL || resolve('.local/solana-layerzero-config-journal.json');
const { plan } = await configurationPlan(c, signer.publicKey.toBase58());
const phases = [plan.filter(p => p.name.startsWith('initialize-')), plan.filter(p => p.name.startsWith('set-') && p.name.endsWith('-library')), ...plan.filter(p => p.name.startsWith('set-') && !p.name.endsWith('-library')).map(p => [p])].filter(p => p.length);
for (const phase of phases) {
  const operation = phase.map(p => p.name).join('+');
  const receipt = await submitJournaled(c.connection, signer, phase.map(p => toWeb3Instruction(p.instruction)), journal, operation);
  console.log(JSON.stringify({ operation, ...receipt }));
}
console.log(JSON.stringify({ explicitConfiguration: await verifyExplicit(c), sealed: false }, (_, value) => typeof value === 'bigint' ? value.toString() : value));
