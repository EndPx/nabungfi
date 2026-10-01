import assert from 'node:assert/strict';

const permissionlessActions = new Set(['register', 'command', 'local-ready', 'achieve', 'ack', 'progress', 'ready', 'report']);

export function authorityMode(config) {
  const mode = config.authorityMode ?? 'owner';
  assert(['owner', 'permissionless'].includes(mode), 'Unknown keeper authority mode');
  return mode;
}

export function validateGoalAuthority(config, goal) {
  assert.equal(typeof goal.autoPrepare, 'boolean');
  if (authorityMode(config) === 'permissionless') {
    assert.equal(goal.autoPrepare, false, 'User must sign preparation; coordination operator cannot prepare');
  } else {
    for (const participant of goal.participants) {
      assert.equal(participant.owner.toLowerCase(), config.evm.signerAddress.toLowerCase());
    }
  }
}

export function validateSolanaSigner(config, goals, signer) {
  if (authorityMode(config) === 'owner') {
    for (const goal of goals) assert.equal(goal.owner, signer, 'Owner keeper must sign as the goal owner');
  } else {
    for (const goal of goals) validateGoalAuthority(config, goal);
  }
}

export function assertCoordinationAction(config, goal, action, signer) {
  validateGoalAuthority(config, goal);
  if (permissionlessActions.has(action.kind)) return;
  assert.equal(action.kind, 'prepare', 'Keeper cannot perform owner financial actions');
  assert.equal(authorityMode(config), 'owner', 'Permissionless operator cannot prepare a user goal');
  assert.equal(goal.autoPrepare, true, 'Automatic preparation is not authorized');
  assert.equal(goal.owner, signer, 'Preparation requires the actual owner signature');
}
