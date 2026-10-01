import assert from 'node:assert/strict';
import {existsSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {atomicWrite, fingerprint, loadState} from './persistence.mjs';
import {authorityMode} from './authority.mjs';

export function readRegistry(path) {
  const registry = loadState(path);
  assert(registry?.version === 1 && Array.isArray(registry.goals), 'Missing or invalid app registry');
  assert(registry.goals.length <= 500, 'Operator registry capacity exceeded');
  assert.equal(new Set(registry.goals.map(g => g.goalId)).size, registry.goals.length, 'Duplicate registry goal');
  return registry.goals;
}

/** Policy/signers are immutable. The accepted goal list can only append validated identities. */
export function initializeRegistryState(config, goals) {
  assert.equal(authorityMode(config), 'permissionless');
  assert(config.registryFile, 'A private registry path is required');
  const manifestPath = join(config.stateDirectory, 'keeper-manifest.json');
  const budgetPath = join(config.stateDirectory, 'budgets.json');
  const allowlistHash = fingerprint({...config, goals:[]});
  let manifest;
  if (existsSync(manifestPath)) {
    manifest = loadState(manifestPath);
    assert.equal(manifest.kind, 'append-only-registry', 'Cannot reuse owner-mode journals');
    assert.equal(manifest.allowlistHash, allowlistHash, 'Operator policy or signer configuration changed');
    const budget = loadState(budgetPath);
    assert(budget?.version === 1 && budget.reservations, 'Prior budget journal missing');
  } else {
    assert(!existsSync(config.stateDirectory) || readdirSync(config.stateDirectory).length === 0, 'Existing state has no registry manifest');
    atomicWrite(budgetPath, {version:1, reservations:{}});
    manifest = {version:1, kind:'append-only-registry', allowlistHash, goals:[], goalHashes:{}};
    atomicWrite(manifestPath, manifest);
  }
  assert.equal(new Set(goals.map(g => g.goalId)).size, goals.length, 'Duplicate goal');
  const incoming = new Set(goals.map(g => g.goalId));
  for (const id of manifest.goals) assert(incoming.has(id), 'Accepted goal was removed; reconcile registry explicitly');
  for (const goal of goals) {
    assert(/^0x[0-9a-f]{64}$/.test(goal.goalId) && BigInt(goal.goalId)>0n, 'Registry goal ID must be canonical hex');
    assert.equal(goal.autoPrepare, false, 'User must prepare their own goal');
    const hash = fingerprint(goal), path = join(config.stateDirectory, goal.goalId.slice(2)+'.json');
    if (manifest.goalHashes[goal.goalId]) {
      assert.equal(manifest.goalHashes[goal.goalId], hash, 'Accepted goal identity changed');
      const ledger = loadState(path);
      assert(ledger?.intents && ledger.allowlistHash === hash, 'Accepted goal journal missing or corrupt');
    } else {
      if (existsSync(path)) {
        // A crash before manifest publication can leave an unsigned new-goal journal.
        const ledger = loadState(path);
        assert(ledger?.allowlistHash === hash && Object.keys(ledger.intents??{}).length === 0, 'Orphan signed goal requires manual reconciliation');
      } else atomicWrite(path, {version:1, goalId:goal.goalId, allowlistHash:hash, intents:{}});
      manifest.goals.push(goal.goalId);
      manifest.goalHashes[goal.goalId] = hash;
    }
  }
  atomicWrite(manifestPath, manifest);
  return manifest;
}
