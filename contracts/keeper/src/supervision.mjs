import assert from 'node:assert/strict';
import {existsSync,readFileSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {fingerprint,loadState,originalWire} from './persistence.mjs';
import {linuxProcessIdentity,assertKernelSupervisorLock} from './linux-runtime.mjs';

/** Existing-state only: a restart can never silently create a new accounting history. */
export function auditRestartState(config,goals,directory=config.stateDirectory) {
  const relocation=loadState(join(directory,'relocation-receipt.json'));
  assert(!relocation||relocation.status==='completed','Incomplete relocation requires explicit reconciliation');
  const manifest=loadState(join(directory,'keeper-manifest.json'));
  assert(manifest?.kind==='append-only-registry'&&manifest.version===1,'Prior registry manifest required');
  assert.equal(manifest.allowlistHash,fingerprint({...config,goals:[]}),'Operator configuration changed; explicit migration required');
  const budgets=loadState(join(directory,'budgets.json'));
  assert(budgets?.version===1&&budgets.reservations,'Prior budget journal required');
  const byId=new Map(goals.map(goal=>[goal.goalId,goal]));assert.equal(byId.size,goals.length,'Duplicate goal');
  const intents=new Map();let pending=0;
  for(const id of manifest.goals){
    const goal=byId.get(id);assert(goal,'Accepted goal removed');assert.equal(manifest.goalHashes[id],fingerprint(goal),'Accepted goal identity changed');
    const ledger=loadState(join(directory,id.slice(2)+'.json'));
    assert(ledger?.goalId===id&&ledger.allowlistHash===manifest.goalHashes[id]&&ledger.intents,'Accepted journal missing or corrupt');
    for(const [intent,entry]of Object.entries(ledger.intents)){
      assert.equal(entry.id,intent,'Intent identity changed');assert(!intents.has(intent),'Duplicate intent');
      const reservation=budgets.reservations[intent];assert(reservation,'Original budget reservation missing');
      for(const field of['hash','network','spend'])assert.equal(reservation[field],entry[field],'Original budget reservation changed');
      assert(entry.wireFile,'Original wire reference missing');originalWire(directory,entry);
      intents.set(intent,entry);if(entry.status!=='delivered')pending++;
    }
  }
  for(const intent of Object.keys(budgets.reservations))assert(intents.has(intent),'Orphan budget reservation requires manual reconciliation');
  return{goals:manifest.goals.length,intents:intents.size,pending};
}

export function staleLockDecision(lock,current) {
  assert(lock&&Number.isSafeInteger(lock.pid)&&lock.pid>0&&typeof lock.id==='string','Corrupt signer lock');
  assert(lock.runtime?.machineId&&lock.runtime?.bootId&&/^\d+$/.test(lock.runtime.startTicks),'Legacy signer lock requires manual reconciliation');
  assert.equal(lock.runtime.machineId,current.machineId,'Foreign-host signer lock requires cutover reconciliation');
  if(lock.runtime.bootId!==current.bootId)return'reboot';
  if(current.startTicks===null)return'exited';
  if(lock.runtime.startTicks!==current.startTicks)return'pid-reused';
  throw new Error('Signer lock owner is still alive');
}

export function recoverSameHostSignerLock(path) {
  assertKernelSupervisorLock(path+'.supervisor');
  if(!existsSync(path))return'absent';
  const bytes=readFileSync(path,'utf8'),lock=JSON.parse(bytes);
  assert(Number.isSafeInteger(lock.pid)&&lock.pid>0,'Corrupt signer lock PID');
  const current=linuxProcessIdentity(lock.pid);
  const reason=staleLockDecision(lock,current);
  assert.equal(readFileSync(path,'utf8'),bytes,'Signer lock changed during recovery');
  unlinkSync(path);return reason;
}
