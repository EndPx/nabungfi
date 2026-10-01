import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,lstatSync,existsSync,openSync,writeFileSync,fsyncSync,closeSync,renameSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {atomicWrite,fingerprint,loadState} from './persistence.mjs';
import {auditRestartState} from './supervision.mjs';
import {terminalZero} from './active-goals.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const AUDIT_FILES=new Set(['relocation-receipt.json','relocation-original-manifest.json']);
export function pathIndependentConfig(config){
  const copy=structuredClone(config);
  for(const key of['stateDirectory','signerLockFile','registryFile','statusFile'])delete copy[key];
  delete copy.solana.signerPath;delete copy.evm.executable;return copy;
}
export function assertPathOnlyRelocation(oldConfig,newConfig){
  assert.deepEqual(pathIndependentConfig(newConfig),pathIndependentConfig(oldConfig),'Only the six approved runtime paths may change');
  assert.equal(oldConfig.authorityMode,'permissionless');assert.equal(newConfig.authorityMode,'permissionless');
  assert.deepEqual(oldConfig.goals,[]);assert.deepEqual(newConfig.goals,[]);
}
export function stateInventory(directory,excludeAudit=false){
  const result={};
  const walk=(relative='')=>{for(const name of readdirSync(join(directory,relative)).sort()){
    const key=relative?relative+'/'+name:name;
    if(excludeAudit&&AUDIT_FILES.has(key))continue;
    const path=join(directory,key),stat=lstatSync(path);assert(!stat.isSymbolicLink(),'State cannot contain symlinks');
    if(stat.isDirectory())walk(key);else{assert(stat.isFile(),'Unexpected state file');result[key]={bytes:stat.size,sha256:sha(readFileSync(path))};}
  }};walk();return result;
}
export function captureRelocation(oldConfig,newConfig,goals,attestation,observations,now=Date.now()){
  assertPathOnlyRelocation(oldConfig,newConfig);
  assert(attestation?.sourceSignerDisabled===true&&attestation?.publisherStopped===true&&attestation?.readOnlyDrainCompleted===true,'Source cutover attestation required');
  assert(!existsSync(oldConfig.signerLockFile),'Original signer still has a lock');
  assert(!existsSync(join(oldConfig.stateDirectory,'relocation-receipt.json')),'Already relocated state requires a separate reviewed migration');
  const audit=auditRestartState(oldConfig,goals);assert.equal(audit.pending,0,'Every original intent must be delivered');
  assert(observations&&Object.keys(observations).length===goals.length,'Fresh per-goal chain observations required');
  for(const goal of goals){
    const ledger=loadState(join(oldConfig.stateDirectory,goal.goalId.slice(2)+'.json')),fresh=observations[goal.goalId];
    assert(fresh&&now-fresh.observedAt>=0&&now-fresh.observedAt<=300000,'Fresh read-only source drain required');
    assert(terminalZero({...ledger,lastSnapshot:fresh.snapshot}),'Cutover requires fully claimed permanent achievement');
    assert.deepEqual(Object.keys(fresh.receipts).sort(),Object.keys(ledger.intents).sort(),'Original receipt observation missing');
    for(const [id,entry]of Object.entries(ledger.intents)){assert.equal(fresh.receipts[id].hash,entry.hash);assert.equal(fresh.receipts[id].state,'confirmed','Original source receipt must be confirmed');}
  }
  return{version:1,kind:'keeper-path-relocation',capturedAt:new Date(now).toISOString(),attestation,observations,oldHash:fingerprint({...oldConfig,goals:[]}),newHash:fingerprint({...newConfig,goals:[]}),semanticHash:fingerprint(pathIndependentConfig(oldConfig)),registrySha256:sha(readFileSync(oldConfig.registryFile)),inventory:stateInventory(oldConfig.stateDirectory),audit};
}
function backupBytes(path,bytes){
  if(existsSync(path)){assert.equal(sha(readFileSync(path)),sha(bytes),'Original manifest backup changed');return;}
  const temp=path+'.tmp',fd=openSync(temp,'wx',0o600);try{writeFileSync(fd,bytes);fsyncSync(fd);}finally{closeSync(fd);}renameSync(temp,path);
  let directory;try{directory=openSync(dirname(path),'r');fsyncSync(directory);}catch(error){if(process.platform!=='win32'||!['EPERM','EISDIR','EINVAL','EBADF','EACCES','ENOTSUP'].includes(error.code))throw error;}finally{if(directory!==undefined)closeSync(directory);}
}
/** Only manifest hash changes; every budget, goal ledger and signed wire stays byte-identical. */
export function applyRelocation(oldConfig,newConfig,goals,snapshot,{apply=false}={}){
  assertPathOnlyRelocation(oldConfig,newConfig);
  assert(snapshot?.version===1&&snapshot.kind==='keeper-path-relocation','Invalid source relocation snapshot');
  assert(snapshot.attestation?.sourceSignerDisabled&&snapshot.attestation?.publisherStopped&&snapshot.attestation?.readOnlyDrainCompleted,'Missing cutover attestation');
  assert.equal(snapshot.oldHash,fingerprint({...oldConfig,goals:[]}));assert.equal(snapshot.newHash,fingerprint({...newConfig,goals:[]}));assert.equal(snapshot.semanticHash,fingerprint(pathIndependentConfig(newConfig)));
  assert(!existsSync(newConfig.signerLockFile),'Destination signer lock exists');
  assert.equal(sha(readFileSync(newConfig.registryFile)),snapshot.registrySha256,'Registry copy changed');
  const manifestPath=join(newConfig.stateDirectory,'keeper-manifest.json'),receiptPath=join(newConfig.stateDirectory,'relocation-receipt.json'),backupPath=join(newConfig.stateDirectory,'relocation-original-manifest.json');
  const receipt=loadState(receiptPath),inventory=stateInventory(newConfig.stateDirectory,!!receipt),current=loadState(manifestPath);
  if(receipt){
    assert.equal(receipt.snapshotHash,fingerprint(snapshot),'Different migration receipt');
    assert.equal(sha(readFileSync(backupPath)),snapshot.inventory['keeper-manifest.json'].sha256,'Original backup changed');
    inventory['keeper-manifest.json']=snapshot.inventory['keeper-manifest.json'];
    assert([snapshot.oldHash,snapshot.newHash].includes(current.allowlistHash),'Manifest is neither original nor approved destination');
  }else assert.equal(current.allowlistHash,snapshot.oldHash,'Original configuration hash differs');
  assert.deepEqual(inventory,snapshot.inventory,'Transferred state differs from source snapshot');
  const originalManifest=receipt?JSON.parse(readFileSync(backupPath,'utf8')):current;
  assert.deepEqual(current,{...originalManifest,allowlistHash:current.allowlistHash},'Manifest identity changed');
  // Verify the original hash against copied files without modifying their contents.
  if(!receipt)auditRestartState(oldConfig,goals,newConfig.stateDirectory);
  for(const goal of goals)assert(terminalZero(loadState(join(newConfig.stateDirectory,goal.goalId.slice(2)+'.json'))),'Transferred goal is not terminal-zero');
  if(!apply)return{status:'validated',oldHash:snapshot.oldHash,newHash:snapshot.newHash,audit:snapshot.audit};
  if(receipt?.status==='completed'){auditRestartState(newConfig,goals);return receipt;}
  backupBytes(backupPath,receipt?readFileSync(backupPath):readFileSync(manifestPath));
  const staged={version:1,status:'staged',snapshotHash:fingerprint(snapshot),oldHash:snapshot.oldHash,newHash:snapshot.newHash,createdAt:receipt?.createdAt??new Date().toISOString(),audit:snapshot.audit};
  atomicWrite(receiptPath,staged);
  atomicWrite(manifestPath,{...originalManifest,allowlistHash:snapshot.newHash});
  const completed={...staged,status:'completed',completedAt:new Date().toISOString()};atomicWrite(receiptPath,completed);
  auditRestartState(newConfig,goals);return completed;
}
