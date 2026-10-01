import assert from 'node:assert/strict';
import {readConfig,validateConfig} from './config.mjs';
import {readRegistry} from './registry.mjs';
import {loadState,atomicWrite} from './persistence.mjs';
import {captureRelocation,applyRelocation} from './relocation.mjs';
import {ChainAdapter} from './adapter.mjs';
import {join} from 'node:path';

try{
  const args=process.argv.slice(2),value=key=>{const i=args.indexOf(key);assert(i>=0&&args[i+1]&&!args[i+1].startsWith('--'),`Missing ${key}`);assert.equal(args.lastIndexOf(key),i,'Duplicate argument');return args[i+1];};
  assert(['snapshot','apply'].includes(args[0]),'Use snapshot or apply');
  const valued=['--old-config','--new-config','--snapshot','--ack'];
  assert(args.slice(1).every((arg,i)=>valued.includes(arg)||(arg==='--apply'&&args[0]==='apply')||valued.includes(args[i])),'Unknown argument');
  assert.equal(value('--ack'),'SOURCE_SIGNER_AND_PUBLISHER_STOPPED_NO_OTHER_HOST_ACTIVE','Explicit cutover acknowledgement required');
  const oldConfig=readConfig(value('--old-config')),newConfig=readConfig(value('--new-config')),snapshotPath=value('--snapshot');
  const registry=readRegistry(args[0]==='snapshot'?oldConfig.registryFile:newConfig.registryFile);
  const goals=validateConfig({...oldConfig,goals:registry}).goals;
  if(args[0]==='snapshot'){
    const reader=new ChainAdapter(oldConfig,{readOnly:true});await reader.validate();const observations={};
    for(const goal of goals){
      const ledger=loadState(join(oldConfig.stateDirectory,goal.goalId.slice(2)+'.json')),receipts={};
      assert(ledger?.intents,'Original goal journal required');
      for(const [id,entry]of Object.entries(ledger.intents)){const result=await reader.reconcile(entry);receipts[id]={hash:entry.hash,...result};}
      observations[goal.goalId]={observedAt:Date.now(),snapshot:await reader.snapshot(goal),receipts};
    }
    const snapshot=captureRelocation(oldConfig,newConfig,goals,{sourceSignerDisabled:true,publisherStopped:true,readOnlyDrainCompleted:true},observations);
    atomicWrite(snapshotPath,snapshot);console.log(JSON.stringify({status:'captured',audit:snapshot.audit}));
  }else{
    const result=applyRelocation(oldConfig,newConfig,goals,loadState(snapshotPath),{apply:args.includes('--apply')});
    console.log(JSON.stringify({status:result.status,audit:result.audit}));
  }
}catch(error){console.error(JSON.stringify({event:'keeper-relocation-paused',code:'relocation-validation-failed',error:error.name}));process.exitCode=1;}
