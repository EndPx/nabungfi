import test from 'node:test';import assert from 'node:assert/strict';
import {terminalZero} from '../src/active-goals.mjs';
const ledger=()=>({lastSnapshot:{sol:{phase:3,target:'4000000',achievedTotal:'4000000',outboundSequence:'2'},localCash:'0',peers:[{evmPhase:3,commandSequence:'2',totalAssets:'0',netAssets:'0',receiptBalance:'0'}]},intents:{original:{status:'delivered'}}});
test('only actual zero custody/NAV/receipts and reconciled intents retire active work',()=>{
 assert(terminalZero(ledger()));
 const l=ledger();l.intents.original.status='submitted';assert(!terminalZero(l));
 for(const field of ['totalAssets','netAssets','receiptBalance']){const x=ledger();x.lastSnapshot.peers[0][field]='1';assert(!terminalZero(x));}
 const saving=ledger();saving.lastSnapshot.sol.phase=0;assert(!terminalZero(saving));
 assert(!terminalZero({intents:{}}));
});
test('zero-reserve peers still require actual COMMIT before operational retirement',()=>{
 const l=ledger();l.lastSnapshot.peers[0].evmPhase=2;l.lastSnapshot.peers[0].commandSequence='1';assert(!terminalZero(l));
 l.lastSnapshot.peers[0].evmPhase=3;assert(!terminalZero(l));
 const under=ledger();under.lastSnapshot.sol.achievedTotal='1';assert(!terminalZero(under));
});
