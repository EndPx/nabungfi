import assert from 'node:assert/strict';
import {join} from 'node:path';
import {loadState} from './persistence.mjs';
export const ACTIVE_CAPACITY=6;
export function terminalZero(ledger) {
  const s=ledger?.lastSnapshot;
  return !!s && s.sol?.phase===3 && BigInt(s.sol.achievedTotal)>=BigInt(s.sol.target) && BigInt(s.localCash)===0n && Array.isArray(s.peers)&&s.peers.length>=1 &&
    s.peers.every(p=>p.evmPhase===3&&BigInt(p.commandSequence)>=BigInt(s.sol.outboundSequence)&&BigInt(p.totalAssets)===0n&&BigInt(p.netAssets)===0n&&BigInt(p.receiptBalance)===0n) &&
    Object.values(ledger.intents??{}).every(intent=>intent.status==='delivered');
}
export function classifyRegistryGoals(directory,goals) {
  const active=[],completed=[];
  for(const goal of goals) {
    const ledger=loadState(join(directory,goal.goalId.slice(2)+'.json'));
    (terminalZero(ledger)?completed:active).push(goal);
  }
  assert(active.length<=ACTIVE_CAPACITY,'Active operational admission exceeded');
  return {active,completedGoalIds:completed.map(g=>g.goalId)};
}
