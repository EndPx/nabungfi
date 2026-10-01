import test from 'node:test';
import assert from 'node:assert/strict';
import { rawAmount, assertGoalBinding, goalProgressBasisPoints, reconcileObservation, type GoalChainState } from '../src/chain.js';
test('exact raw amounts reject floats, scientific notation, leading zeros and uint64 overflow', () => {
    assert.equal(rawAmount('18446744073709551615'), 18446744073709551615n);
    for (const value of [1, 1.5, '1.0', '1e6', '01', '-1', '18446744073709551616', '0'])
        assert.throws(() => rawAmount(value));
});
test('timeout or expired unobserved transaction never proves failure', () => { assert.equal(reconcileObservation('missing', false), 'pending'); assert.equal(reconcileObservation('missing', true), 'attention'); assert.equal(reconcileObservation('success', true), 'confirmed'); assert.equal(reconcileObservation('failed', false), 'failed'); });
test('claimed goal retains full visual progress after its asset balance becomes zero', () => { const state = { phase: 'claimed', targetRaw: '10000000', totalAssetsRaw: '0', achievedTotalRaw: '10000000' } as GoalChainState; assert.equal(goalProgressBasisPoints(state), 10000); state.phase = 'saving'; assert.equal(goalProgressBasisPoints(state), 0); state.totalAssetsRaw = '9000000'; assert.equal(goalProgressBasisPoints(state), 9000); });
