import {join} from 'node:path';
import {fingerprint,atomicWrite,loadState,persistWire,originalWire} from './persistence.mjs';
import {chooseAction,intentKey,delivered} from './scheduler.mjs';

export async function runGoal(goal,config,adapter,broadcast,log){
 const path=join(config.stateDirectory,`${goal.goalId.slice(2)}.json`),hash=fingerprint(goal);
 const ledger=loadState(path,{version:1,goalId:goal.goalId,allowlistHash:hash,intents:{}});
 if(ledger.allowlistHash!==hash)throw new Error('Goal allowlist changed; reconcile immutable journal explicitly');
 const save=()=>atomicWrite(path,ledger),snapshot=await adapter.snapshot(goal),now=Date.now();
 for(const entry of Object.values(ledger.intents)){
  if(entry.status==='delivered')continue;
  const status=await adapter.reconcile(entry);
  if(status.state==='failed'||status.state==='ambiguous'){entry.status=status.state;entry.errorCode=status.code;save();continue;}
  if(status.state==='confirmed'){entry.status='confirmed';entry.receipt=status.receipt;if(delivered(entry.action,snapshot)){entry.status='delivered';entry.deliveredAt=now;}}
  if(broadcast&&status.state==='pending'&&entry.wireFile&&now-(entry.lastBroadcastAt??entry.signedAt)>=config.policy.sameWireRetryMs&&(entry.sameWireRetries??0)<config.policy.maxSameWireRetries){
   adapter.reserveBudget(entry,entry.id);
   const wire=originalWire(config.stateDirectory,entry);
   entry.sameWireRetries=(entry.sameWireRetries??0)+1;entry.lastBroadcastAt=now;save();
   await adapter.broadcast({...entry,wire});
  }
  save();
 }
 ledger.lastSnapshot=snapshot;ledger.lastObservedAt=now;save();
 const action=chooseAction(goal,snapshot,ledger,config.policy,now);
 if(!action){log({goal:goal.name,event:'waiting',phase:snapshot.sol.phase});return;}
 const id=intentKey(goal,action);log({goal:goal.name,event:broadcast?'action':'plan',action});
 const built=await adapter.prepare(goal,action,snapshot);
 if(!broadcast){log({goal:goal.name,event:'simulation',action,units:built.units});return;}
 const prepared=await adapter.sign(built);
 const entry={id,action,intentHash:fingerprint({goalId:goal.goalId,action}),instructionHash:prepared.instructionHash,network:prepared.network,signer:prepared.signer,hash:prepared.hash,lifetime:prepared.lifetime,nonce:prepared.nonce,fee:prepared.fee,spend:prepared.spend,status:'signed',signedAt:Date.now()};
 // Budget and original signed wire are durable before any send or retryable intent.
 adapter.reserveBudget(prepared,id);
 entry.wireFile=persistWire(config.stateDirectory,entry.hash,prepared.wire);
 ledger.intents[id]=entry;save();
 entry.status='submitted';entry.lastBroadcastAt=Date.now();save();
 await adapter.broadcast(prepared);entry.broadcastAt=Date.now();save();
 const status=await adapter.reconcile(entry);
 if(status.state==='confirmed'){entry.status='confirmed';entry.receipt=status.receipt;}else if(status.state==='failed'||status.state==='ambiguous'){entry.status=status.state;entry.errorCode=status.code;}
 save();log({goal:goal.name,event:'submitted',action,network:entry.network,hash:entry.hash,status:entry.status});
}
