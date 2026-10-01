import{mkdirSync,openSync,writeFileSync,readFileSync,existsSync,readdirSync,renameSync,closeSync,fsyncSync,unlinkSync}from'node:fs';import{dirname,resolve,join}from'node:path';import{hostname}from'node:os';import{randomUUID,createHash}from'node:crypto';import assert from'node:assert/strict';
import{linuxProcessIdentity}from'./linux-runtime.mjs';
export const canonical=value=>JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v);
export const fingerprint=value=>createHash('sha256').update(canonical(value)).digest('hex');
export function atomicWrite(path,value,{mode=0o600}={}){assert([0o600,0o640].includes(mode),'Only private or shared-bridge file modes are allowed');mkdirSync(dirname(path),{recursive:true});const temp=`${path}.${process.pid}.${randomUUID()}.tmp`,fd=openSync(temp,'wx',mode);try{writeFileSync(fd,canonical(value));fsyncSync(fd);}finally{closeSync(fd);}renameSync(temp,path);let directory;try{directory=openSync(dirname(path),'r');fsyncSync(directory);}catch(error){if(!['EPERM','EISDIR','EINVAL','EBADF','EACCES','ENOTSUP'].includes(error.code))throw error;}finally{if(directory!==undefined)closeSync(directory);}}
export function loadState(path,fallback){return existsSync(path)?JSON.parse(readFileSync(path,'utf8')):fallback;}
export function initializeKeeperState(config){
 const manifestPath=join(config.stateDirectory,'keeper-manifest.json'),allowlistHash=fingerprint(config),goals=config.goals.map(g=>g.goalId),budgetPath=join(config.stateDirectory,'budgets.json');
 if(existsSync(manifestPath)){
  const manifest=loadState(manifestPath);assert.equal(manifest.allowlistHash,allowlistHash,'Keeper configuration changed; reconcile explicitly');assert.deepEqual(manifest.goals,goals);
  const budget=loadState(budgetPath);assert(budget&&budget.version===1&&budget.reservations,'Prior budget journal missing or invalid');
  for(const goal of config.goals){const ledger=loadState(join(config.stateDirectory,goal.goalId.slice(2)+'.json'));assert(ledger&&ledger.intents,'Prior goal journal missing or invalid');assert.equal(ledger.allowlistHash,fingerprint(goal));}
  return manifest;
 }
 assert(!existsSync(config.stateDirectory)||readdirSync(config.stateDirectory).length===0,'Existing keeper state has no manifest; reconcile manually');
 atomicWrite(budgetPath,{version:1,reservations:{}});
 // Every allowlisted goal is accounted for before any signer can submit a first operation.
 for(const goal of config.goals)atomicWrite(join(config.stateDirectory,goal.goalId.slice(2)+'.json'),{version:1,goalId:goal.goalId,allowlistHash:fingerprint(goal),intents:{}});
 const manifest={version:1,allowlistHash,goals};atomicWrite(manifestPath,manifest);return manifest;
}
export function persistWire(directory,hash,wire){const name=createHash('sha256').update(hash).digest('hex')+'.json',path=resolve(directory,'wires',name),wireHash=fingerprint(wire);if(existsSync(path))assert.equal(loadState(path).wireHash,wireHash,'Original wire changed');else atomicWrite(path,{version:1,hash,wireHash,wire});return{name,wireHash};}
export function originalWire(directory,entry){assert(/^[a-f0-9]{64}\.json$/.test(entry.wireFile.name),'Invalid private wire reference');const stored=loadState(resolve(directory,'wires',entry.wireFile.name));assert(stored,'Missing original signed wire; reconcile manually');assert.equal(stored.hash,entry.hash);assert.equal(stored.wireHash,entry.wireFile.wireHash);assert.equal(fingerprint(stored.wire),stored.wireHash,'Corrupt original wire');return stored.wire;}
export function acquireSignerLock(path){
 const lockPath=resolve(path);mkdirSync(dirname(lockPath),{recursive:true});const identity={pid:process.pid,hostname:hostname(),id:randomUUID(),createdAt:new Date().toISOString(),runtime:linuxProcessIdentity()};let fd;
 try{fd=openSync(lockPath,'wx',0o600);}catch(error){if(error.code!=='EEXIST')throw error;throw new Error('Global signer lock exists; stop its owner or verify a stale PID and remove the lock manually');}
 writeFileSync(fd,canonical(identity));fsyncSync(fd);closeSync(fd);
 return()=>{if(existsSync(lockPath)){const current=JSON.parse(readFileSync(lockPath,'utf8'));if(current.id===identity.id)unlinkSync(lockPath);}};
}
