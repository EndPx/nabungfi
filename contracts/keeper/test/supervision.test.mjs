import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,unlinkSync,cpSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {atomicWrite,loadState,fingerprint,persistWire} from '../src/persistence.mjs';
import {linuxProcessIdentity} from '../src/linux-runtime.mjs';
import {auditRestartState,staleLockDecision} from '../src/supervision.mjs';
import {captureRelocation,applyRelocation,assertPathOnlyRelocation,stateInventory} from '../src/relocation.mjs';

const machineId='1'.repeat(32),bootId='11111111-1111-1111-1111-111111111111';
const lock={pid:123,id:'original-lock',runtime:{machineId,bootId,startTicks:'10'}};
test('lock recovery distinguishes exited/reused/reboot, never live/foreign/legacy',()=>{
  assert.equal(staleLockDecision(lock,{machineId,bootId,startTicks:null}),'exited');
  assert.equal(staleLockDecision(lock,{machineId,bootId,startTicks:'11'}),'pid-reused');
  assert.equal(staleLockDecision(lock,{machineId,bootId:'22222222-2222-2222-2222-222222222222',startTicks:'10'}),'reboot');
  assert.throws(()=>staleLockDecision(lock,lock.runtime),/still alive/);
  assert.throws(()=>staleLockDecision(lock,{...lock.runtime,machineId:'2'.repeat(32)}),/Foreign-host/);
  assert.throws(()=>staleLockDecision({...lock,runtime:undefined},lock.runtime),/Legacy/);
});
test('proc stat parsing survives spaces and parentheses in process command',()=>{
  const fields=['S',...Array(18).fill('0'),'456'];
  const read=path=>path==='/etc/machine-id'?machineId:path.includes('boot_id')?bootId:`123 (a (worker) name) ${fields.join(' ')}`;
  assert.equal(linuxProcessIdentity(123,read).startTicks,'456');
  assert.equal(linuxProcessIdentity(123,path=>{if(path.includes('/123/'))throw Object.assign(Error(),{code:'ENOENT'});return read(path);}).startTicks,null);
  assert.throws(()=>linuxProcessIdentity(123,path=>{if(path.includes('/123/'))throw Object.assign(Error(),{code:'EACCES'});return read(path);}));
});
function fixture(){
  const dir=mkdtempSync(join(tmpdir(),'keeper-relocation-')),state=join(dir,'old-state'),destination=join(dir,'new-state');
  const goal={goalId:'0x'+'1'.repeat(64),autoPrepare:false,owner:'user',targetRaw:'2000000',participants:[]};
  const old={version:1,authorityMode:'permissionless',stateDirectory:state,signerLockFile:join(dir,'old.lock'),registryFile:join(dir,'old-registry.json'),statusFile:join(dir,'old-status.json'),solana:{signerPath:'/old/solana.json',dailySpendCap:'10'},evm:{executable:'/old/cast',account:'deployer-wallet'},policy:{maxActionsPerDay:10},networks:[{domain:2}],goals:[]};
  const next={...structuredClone(old),stateDirectory:destination,signerLockFile:join(dir,'new.lock'),registryFile:join(dir,'new-registry.json'),statusFile:join(dir,'new-status.json')};next.solana.signerPath='/new/solana.json';next.evm.executable='/new/cast';
  const manifest={version:1,kind:'append-only-registry',allowlistHash:fingerprint({...old,goals:[]}),goals:[goal.goalId],goalHashes:{[goal.goalId]:fingerprint(goal)}};
  atomicWrite(join(state,'keeper-manifest.json'),manifest);const ref=persistWire(state,'original-signature','PRIVATE_TEST_WIRE');
  atomicWrite(join(state,'budgets.json'),{version:1,reservations:{intent:{network:'solana',hash:'original-signature',spend:'1',day:'2026-10-01'}}});
  const ledger={version:1,goalId:goal.goalId,allowlistHash:fingerprint(goal),lastObservedAt:Date.now(),lastSnapshot:{sol:{phase:3,target:'2000000',achievedTotal:'2000000',outboundSequence:'2'},localCash:'0',peers:[{evmPhase:3,commandSequence:'2',totalAssets:'0',netAssets:'0',receiptBalance:'0'}]},intents:{intent:{id:'intent',network:'solana',hash:'original-signature',spend:'1',status:'delivered',wireFile:ref}}};
  atomicWrite(join(state,goal.goalId.slice(2)+'.json'),ledger);atomicWrite(old.registryFile,{version:1,goals:[goal]});
  const attestation={sourceSignerDisabled:true,publisherStopped:true,readOnlyDrainCompleted:true};
  const snapshot=()=>captureRelocation(old,next,[goal],attestation,{[goal.goalId]:{observedAt:ledger.lastObservedAt,snapshot:ledger.lastSnapshot,receipts:{intent:{hash:'original-signature',state:'confirmed'}}}});
  const copy=()=>{cpSync(state,destination,{recursive:true});cpSync(old.registryFile,next.registryFile);};
  return{dir,old,next,goal,ledger,manifest,snapshot,copy,cleanup:()=>rmSync(dir,{recursive:true,force:true})};
}
test('restart audits every original wire/reservation and refuses missing state',()=>{
  const f=fixture();try{assert.deepEqual(auditRestartState(f.old,[f.goal]),{goals:1,intents:1,pending:0});unlinkSync(join(f.old.stateDirectory,'wires',f.ledger.intents.intent.wireFile.name));assert.throws(()=>auditRestartState(f.old,[f.goal]),/Missing original/);}finally{f.cleanup();}
});
test('pending original remains pending; orphan budget fails closed',()=>{
  const f=fixture();try{f.ledger.intents.intent.status='submitted';atomicWrite(join(f.old.stateDirectory,f.goal.goalId.slice(2)+'.json'),f.ledger);assert.equal(auditRestartState(f.old,[f.goal]).pending,1);const budget=loadState(join(f.old.stateDirectory,'budgets.json'));budget.reservations.orphan={hash:'untracked'};atomicWrite(join(f.old.stateDirectory,'budgets.json'),budget);assert.throws(()=>auditRestartState(f.old,[f.goal]),/Orphan/);}finally{f.cleanup();}
});
test('only approved six runtime paths can relocate, never signer/policy/chain/goal identities',()=>{
  const f=fixture();try{assertPathOnlyRelocation(f.old,f.next);for(const mutate of[c=>c.evm.account='other',c=>c.policy.maxActionsPerDay=100,c=>c.solana.dailySpendCap='100',c=>c.networks[0].domain=3,c=>c.goals=[f.goal]]){const c=structuredClone(f.next);mutate(c);assert.throws(()=>assertPathOnlyRelocation(f.old,c));}}finally{f.cleanup();}
});
test('capture requires stopped source, fresh drain and terminal all-goal delivery',()=>{
  const f=fixture();try{writeFileSync(f.old.signerLockFile,'active');assert.throws(f.snapshot,/still has a lock/);unlinkSync(f.old.signerLockFile);f.ledger.intents.intent.status='confirmed';atomicWrite(join(f.old.stateDirectory,f.goal.goalId.slice(2)+'.json'),f.ledger);assert.throws(f.snapshot,/must be delivered/);f.ledger.intents.intent.status='delivered';f.ledger.lastObservedAt=0;atomicWrite(join(f.old.stateDirectory,f.goal.goalId.slice(2)+'.json'),f.ledger);assert.throws(f.snapshot,/Fresh read-only/);}finally{f.cleanup();}
});
test('archived journal remains byte-identical while fresh chain observations gate the snapshot',()=>{
  const f=fixture();try{
    const path=join(f.old.stateDirectory,f.goal.goalId.slice(2)+'.json');f.ledger.lastObservedAt=0;atomicWrite(path,f.ledger);const before=readFileSync(path);
    const observations={[f.goal.goalId]:{observedAt:Date.now(),snapshot:f.ledger.lastSnapshot,receipts:{intent:{hash:'original-signature',state:'confirmed'}}}};
    const attestation={sourceSignerDisabled:true,publisherStopped:true,readOnlyDrainCompleted:true};
    assert.equal(captureRelocation(f.old,f.next,[f.goal],attestation,observations).audit.pending,0);assert.deepEqual(readFileSync(path),before);
    observations[f.goal.goalId].receipts.intent.state='pending';assert.throws(()=>captureRelocation(f.old,f.next,[f.goal],attestation,observations),/must be confirmed/);
  }finally{f.cleanup();}
});
test('relocation preserves byte-identical budgets/ledger/wire and is restart-idempotent',()=>{
  const f=fixture();try{const snapshot=f.snapshot();f.copy();const before=stateInventory(f.next.stateDirectory);assert.equal(applyRelocation(f.old,f.next,[f.goal],snapshot).status,'validated');assert.deepEqual(stateInventory(f.next.stateDirectory),before);const receipt=applyRelocation(f.old,f.next,[f.goal],snapshot,{apply:true});assert.equal(receipt.status,'completed');const after=stateInventory(f.next.stateDirectory,true);delete before['keeper-manifest.json'];delete after['keeper-manifest.json'];assert.deepEqual(after,before);assert.equal(loadState(join(f.next.stateDirectory,'keeper-manifest.json')).allowlistHash,snapshot.newHash);assert.equal(applyRelocation(f.old,f.next,[f.goal],snapshot,{apply:true}).snapshotHash,receipt.snapshotHash);assert.equal(auditRestartState(f.next,[f.goal]).intents,1);}finally{f.cleanup();}
});
test('transfer substitution/missing original/changed registry cannot rebind manifest',()=>{
  for(const mutate of[f=>writeFileSync(join(f.next.stateDirectory,'budgets.json'),'{}'),f=>unlinkSync(join(f.next.stateDirectory,f.goal.goalId.slice(2)+'.json')),f=>writeFileSync(f.next.registryFile,'{}')]){const f=fixture();try{const snapshot=f.snapshot();f.copy();mutate(f);assert.throws(()=>applyRelocation(f.old,f.next,[f.goal],snapshot,{apply:true}));assert.equal(loadState(join(f.next.stateDirectory,'keeper-manifest.json')).allowlistHash,snapshot.oldHash);}finally{f.cleanup();}}
});
test('staged migration blocks supervisor; explicit recovery completes approved hash only',()=>{
  const f=fixture();try{const snapshot=f.snapshot();f.copy();applyRelocation(f.old,f.next,[f.goal],snapshot,{apply:true});const path=join(f.next.stateDirectory,'relocation-receipt.json'),receipt=loadState(path);receipt.status='staged';atomicWrite(path,receipt);assert.throws(()=>auditRestartState(f.next,[f.goal]),/Incomplete/);assert.equal(applyRelocation(f.old,f.next,[f.goal],snapshot,{apply:true}).status,'completed');assert.equal(auditRestartState(f.next,[f.goal]).pending,0);}finally{f.cleanup();}
});
