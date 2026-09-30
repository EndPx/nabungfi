// Pure policy: this module has no wallet, RPC, filesystem, or financial transfer API.
const n=value=>BigInt(value);
const peer=(s,d)=>s.peers.find(p=>p.domain===d);
export function intentKey(goal,action){return`${goal.goalId}:${action.kind}:domain-${action.domain??1}:round-${action.round??0}:sequence-${action.sequence??0}`;}
export function delivered(a,s){
 const p=a.domain?peer(s,a.domain):undefined,g=s.sol;
 switch(a.kind){
  case'register':return p.registered;
  case'ack':return p.linked;
  case'progress':return n(p.progressSequence)>=n(a.sequence);
  case'prepare':return n(g.round)>=n(a.round)&&n(g.outboundSequence)>=n(a.sequence);
  case'local-ready':return n(g.round)>n(a.round)||n(g.outboundSequence)>n(a.sequence)||(n(g.round)===n(a.round)&&g.localReady);
  case'command':return n(p.commandSequence)>=n(a.sequence);
  case'ready':return n(p.reportSequence)>=n(a.sequence);
  case'report':return n(p.inboundSequence)>=n(a.sequence);
  case'achieve':return g.phase===3&&n(g.achievedTotal)>=n(g.target);
  default:throw new Error(`Unsupported keeper action ${a.kind}`);
 }
}
export function chooseAction(goal,s,ledger,policy,now){
 const g=s.sol,hasOutstanding=a=>{const e=ledger.intents[intentKey(goal,a)];return e&&e.status!=='delivered';};
 const pick=a=>hasOutstanding(a)?null:a;
 // A receipt/semantic delivery being reconciled must settle before another action.
 if(Object.values(ledger.intents).some(e=>['signed','submitted','confirmed','ambiguous','failed'].includes(e.status)))return null;
 for(const p of s.peers)if(!p.registered)return pick({kind:'register',domain:p.domain,sequence:'0'});
 for(const p of s.peers)if(!p.linked)return pick({kind:'ack',domain:p.domain,sequence:'0'});
 // Send predecessors in strict order. This also supports an explicitly owner-initiated abort.
 for(const p of s.peers){if(n(p.commandSequence)<n(g.outboundSequence))return pick({kind:'command',domain:p.domain,round:g.round,sequence:(n(p.commandSequence)+1n).toString()});}
 for(const p of s.peers){if(n(p.reportSequence)>n(p.inboundSequence))return pick({kind:'report',domain:p.domain,round:g.round,sequence:(n(p.inboundSequence)+1n).toString()});}
 if(g.phase===1){
  if(!g.localReady)return pick({kind:'local-ready',round:g.round,sequence:g.outboundSequence});
  for(const p of s.peers)if(p.evmPhase===1&&n(p.round)===n(g.round)&&n(p.receiptBalance)===0n)return pick({kind:'ready',domain:p.domain,round:g.round,sequence:(n(p.reportSequence)+1n).toString()});
  if(g.localReady&&s.peers.every(p=>p.ready)&&n(s.slot)>n(g.localReadySlot)&&n(s.localCash)>=n(g.localReserved)){
   const total=n(g.localReserved)+s.peers.reduce((sum,p)=>sum+n(p.reserved),0n);
   if(total>=n(g.target))return pick({kind:'achieve',round:g.round,sequence:(n(g.outboundSequence)+1n).toString()});
  }
 }
 // Changed balances precede optional heartbeats; eligible prepare cannot starve.
 if(g.phase===0||g.phase===3){
  const total=n(s.localCash)+s.peers.reduce((sum,p)=>sum+n(p.netAssets),0n);
  const actualTotal=n(s.localCash)+s.peers.reduce((sum,p)=>sum+n(p.totalAssets),0n);
  const eligible=g.phase===0&&goal.autoPrepare&&n(g.round)<n(goal.maxAutoPrepareRounds??1);
  for(const p of s.peers)if(n(p.totalAssets)!==n(p.netAssets))return pick({kind:'progress',domain:p.domain,sequence:(n(p.evmProgressSequence)+1n).toString()});
  const fresh=s.peers.every(p=>n(p.progressSequence)>0n&&now-Number(p.receivedAt)*1000<=policy.maxProgressAgeMs&&Number(p.receivedAt)*1000<=now+policy.clockSkewMs);
  if(eligible&&fresh&&s.peers.every(p=>n(p.receiptBalance)===0n)&&total>=n(g.target))return pick({kind:'prepare',round:(n(g.round)+1n).toString(),sequence:(n(g.outboundSequence)+1n).toString()});
  for(const p of s.peers){
   const latest=Object.values(ledger.intents).filter(e=>e.action.kind==='progress'&&e.action.domain===p.domain&&e.status==='delivered').at(-1);
   const coldZero=n(p.totalAssets)===0n&&n(p.netAssets)===0n&&n(p.evmProgressSequence)===0n;
   const terminalZero=g.phase===3&&n(p.totalAssets)===0n&&n(p.netAssets)===0n;
   const stale=n(p.progressSequence)===0n||now-Number(p.receivedAt)*1000>policy.maxProgressAgeMs;
   const due=!latest||now-latest.deliveredAt>=policy.progressRefreshMs;
   const neededZero=eligible&&actualTotal>=n(g.target)&&coldZero;
   if(!terminalZero&&(neededZero||(!coldZero&&(due||(eligible&&total>=n(g.target)&&stale)))))return pick({kind:'progress',domain:p.domain,sequence:(n(p.evmProgressSequence)+1n).toString()});
  }
 }

 return null;
}
