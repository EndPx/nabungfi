import test from'node:test';import assert from'node:assert/strict';import{chooseAction,intentKey}from'../src/scheduler.mjs';
const now=1800000000000,goal={goalId:'0x'+'1'.repeat(64),autoPrepare:true,maxAutoPrepareRounds:1};const policy={progressRefreshMs:30000,maxProgressAgeMs:180000,clockSkewMs:5000};
const peer=d=>({domain:d,registered:true,linked:true,commandSequence:'0',reportSequence:'0',inboundSequence:'0',progressSequence:'1',evmProgressSequence:'1',receivedAt:String(now/1000-5),totalAssets:'1000000',netAssets:'1000000',receiptBalance:'0',round:'0',ready:false,reserved:'0',evmPhase:0});
const state=()=>({slot:50,localCash:'1000000',sol:{phase:0,target:'4000000',round:'0',outboundSequence:'0'},peers:[2,3,4].map(peer)});const ledger=()=>({intents:{}});
test('same-owner portfolio totals cannot unlock an isolated8USDC goal',()=>{const s=state();s.sol.target='8000000';const a=chooseAction(goal,s,ledger(),policy,now);assert.notEqual(a?.kind,'prepare');});
test('fresh eligible prepare wins over overdue heartbeats',()=>assert.equal(chooseAction(goal,state(),ledger(),policy,now).kind,'prepare'));
test('changed actual NAV blocks prepare until absolute progress delivery',()=>{const s=state();s.peers[1].totalAssets='500000';assert.deepEqual(chooseAction(goal,s,ledger(),policy,now),{kind:'progress',domain:3,sequence:'2'});});
test('stale snapshot cannot be reserve; refresh required',()=>{const s=state();s.peers[2].receivedAt='1';assert.equal(chooseAction(goal,s,ledger(),policy,now).kind,'progress');});
test('zero-balance participant gets finite fresh report when local target is eligible',()=>{const s=state();s.localCash='4000000';for(const p of s.peers)Object.assign(p,{totalAssets:'0',netAssets:'0',evmProgressSequence:'0',progressSequence:'0'});assert.deepEqual(chooseAction(goal,s,ledger(),policy,now),{kind:'progress',domain:2,sequence:'1'});s.localCash='0';assert.equal(chooseAction(goal,s,ledger(),policy,now),null);});
test('one READY never unlocks three peers; zero READY is still required',()=>{const s=state();Object.assign(s.sol,{phase:1,round:'1',outboundSequence:'1',localReady:true,localReserved:'1000000',localReadySlot:'40'});for(const p of s.peers)Object.assign(p,{round:'1',commandSequence:'1',evmPhase:2,reserved:'1000000'});s.peers[0].ready=true;assert.equal(chooseAction(goal,s,ledger(),policy,now),null);for(const p of s.peers)p.ready=true;assert.equal(chooseAction(goal,s,ledger(),policy,now).kind,'achieve');s.slot=40;assert.equal(chooseAction(goal,s,ledger(),policy,now),null);});
test('ABORT path drains missing command predecessor and durable reports',()=>{const s=state();Object.assign(s.sol,{phase:2,round:'1',outboundSequence:'2'});assert.equal(chooseAction(goal,s,ledger(),policy,now).sequence,'1');for(const p of s.peers)p.commandSequence='2';s.peers[2].reportSequence='1';assert.deepEqual(chooseAction(goal,s,ledger(),policy,now),{kind:'report',domain:4,round:'1',sequence:'1'});});
test('ambiguous original action pauses only this goal',()=>{const l=ledger();l.intents.bad={status:'ambiguous'};assert.equal(chooseAction(goal,state(),l,policy,now),null);assert.equal(chooseAction({...goal,goalId:'different'},state(),ledger(),policy,now).kind,'prepare');});
test('terminal zero NAV stops heartbeat without relocking',()=>{const s=state();s.sol.phase=3;for(const p of s.peers)Object.assign(p,{totalAssets:'0',netAssets:'0'});assert.equal(chooseAction(goal,s,ledger(),policy,now),null);s.peers[1].netAssets='1000000';assert.equal(chooseAction(goal,s,ledger(),policy,now).kind,'progress');});
test('manual-owner target needs fresh zero-peer reports without automatic owner preparation',()=>{
 const s=state(),manual={...goal,autoPrepare:false};s.localCash='4000000';
 for(const p of s.peers)Object.assign(p,{totalAssets:'0',netAssets:'0',evmProgressSequence:'0',progressSequence:'0',receivedAt:'0'});
 assert.deepEqual(chooseAction(manual,s,ledger(),policy,now),{kind:'progress',domain:2,sequence:'1'});
});
test('unchanged below-target manual goals do not burn native fees on idle heartbeats',()=>{
 const s=state();s.sol.target='8000000';for(const p of s.peers)p.receivedAt='1';
 assert.equal(chooseAction({...goal,autoPrepare:false},s,ledger(),policy,now),null);
 s.peers[1].totalAssets='1000001';assert.equal(chooseAction({...goal,autoPrepare:false},s,ledger(),policy,now).domain,3);
});
test('oldest-first refresh cannot starve later peers even after a 750-second revisit',()=>{
 const s=state(),manual={...goal,autoPrepare:false},l=ledger();for(const p of s.peers)p.receivedAt=String(now/1000-900);
 const domains=[];let clock=now;
 for(let i=0;i<3;i++){
  const action=chooseAction(manual,s,l,policy,clock);domains.push(action.domain);
  const p=s.peers.find(p=>p.domain===action.domain);p.receivedAt=String(clock/1000);p.progressSequence=String(BigInt(p.progressSequence)+1n);p.evmProgressSequence=p.progressSequence;
  l.intents[String(i)]={action,status:'delivered',deliveredAt:clock};clock+=750000;
 }
 assert.deepEqual(domains,[2,3,4]);
});
test('bounded active-goal cadence obtains all fresh peers without using the portfolio sum',()=>{
 const goals=Array.from({length:6},(_,i)=>({g:{...goal,goalId:String(i),autoPrepare:false},s:state(),l:ledger()}));
 for(const {s}of goals)for(const p of s.peers)p.receivedAt=String(now/1000-900);
 for(let cycle=0;cycle<3;cycle++)for(const {g,s,l}of goals){const clock=now+cycle*30000,action=chooseAction(g,s,l,policy,clock),p=s.peers.find(p=>p.domain===action.domain);p.receivedAt=String(clock/1000);p.progressSequence=String(BigInt(p.progressSequence)+1n);p.evmProgressSequence=p.progressSequence;l.intents[String(cycle)]={action,status:'delivered',deliveredAt:clock};}
 for(const {s}of goals)assert(s.peers.every(p=>now+90000-Number(p.receivedAt)*1000<policy.maxProgressAgeMs));
});
import{delivered}from'../src/scheduler.mjs';
test('confirmed readiness does not strand abort recovery after later phase transitions',()=>{const s=state();Object.assign(s.sol,{phase:0,round:'1',outboundSequence:'2',localReady:false});Object.assign(s.peers[0],{round:'1',reportSequence:'2',evmPhase:0});assert(delivered({kind:'local-ready',round:'1',sequence:'1'},s));assert(delivered({kind:'ready',domain:2,round:'1',sequence:'1'},s));});
