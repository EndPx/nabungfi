import assert from 'node:assert/strict';
import {readConfig, validateConfig} from './config.mjs';
import {readRegistry, initializeRegistryState} from './registry.mjs';
import {ChainAdapter} from './adapter.mjs';
import {runGoal} from './engine.mjs';
import {acquireSignerLock,atomicWrite} from './persistence.mjs';
import {join} from 'node:path';
import {ACTIVE_CAPACITY,classifyRegistryGoals} from './active-goals.mjs';

const args=process.argv.slice(2), index=args.indexOf('--config');
assert(index>=0&&args[index+1], 'Usage: node registry-cli.mjs --config <private.json> [--once] [--broadcast]');
assert(args.every((arg,i)=>['--config','--once','--broadcast'].includes(arg)||i===index+1), 'Unknown argument');
const config=readConfig(args[index+1]);
assert.equal(config.authorityMode,'permissionless');assert(config.registryFile);
const broadcast=args.includes('--broadcast'), once=args.includes('--once');
const release=acquireSignerLock(config.signerLockFile);
let stopped=false;
process.on('SIGINT',()=>{stopped=true;});process.on('SIGTERM',()=>{stopped=true;});
const log=data=>console.log(JSON.stringify({time:new Date().toISOString(),...data}));
try {
  const adapter=new ChainAdapter(config);
  await adapter.validate();
  do {
    let errors=0,goalCount=0,completedGoalIds=[];
    try {
      const effective=validateConfig({...config,goals:readRegistry(config.registryFile)});
      goalCount=effective.goals.length;
      initializeRegistryState(config,effective.goals);
      adapter.cycleActions=0;
      const operational=classifyRegistryGoals(config.stateDirectory,effective.goals);
      completedGoalIds=operational.completedGoalIds;
      for(const goal of operational.active) {
        if(stopped)break;
        try { await runGoal(goal,config,adapter,broadcast,log); }
        catch(error) { errors++;log({event:'goal-paused',goalId:goal.goalId,code:'coordination-check-failed',error:error.name});if(once)process.exitCode=1; }
      }
    } catch(error) {
      errors++;log({event:'registry-paused',code:'registry-or-journal-validation-failed',error:error.name});if(once)process.exitCode=1;
    }
    atomicWrite(config.statusFile??join(config.stateDirectory,'operator-status.json'),{version:1,authorityMode:'permissionless',broadcast,lastCycleAt:new Date().toISOString(),goalCount,errors,capacity:ACTIVE_CAPACITY,completedGoalIds},{mode:0o640});
    if(once||stopped)break;
    await new Promise(resolve=>{const finish=()=>{clearTimeout(timer);process.off('SIGINT',finish);process.off('SIGTERM',finish);resolve();};const timer=setTimeout(finish,config.intervalMs);process.once('SIGINT',finish);process.once('SIGTERM',finish);});
  } while(!stopped);
} catch(error) { log({event:'worker-paused',code:'startup-validation-failed',error:error.name});process.exitCode=1; }
finally { release(); }
