import{readConfig}from'./config.mjs';import{ChainAdapter}from'./adapter.mjs';import{runGoal}from'./engine.mjs';import{acquireSignerLock,initializeKeeperState}from'./persistence.mjs';import assert from'node:assert/strict';
const args=process.argv.slice(2),configIndex=args.indexOf('--config');assert(configIndex>=0&&args[configIndex+1],'Usage: node src/cli.mjs --config <private.json> [--once] [--broadcast]');assert(args.every((a,i)=>['--config','--once','--broadcast'].includes(a)||i===configIndex+1),'Unknown argument');
let config;try{config=readConfig(args[configIndex+1]);}catch{throw new Error('Invalid keeper configuration (private details suppressed)');}const broadcast=args.includes('--broadcast'),once=args.includes('--once');
const release=acquireSignerLock(config.signerLockFile);let stopped=false;
process.on('SIGINT',()=>{stopped=true;});process.on('SIGTERM',()=>{stopped=true;});
const log=data=>console.log(JSON.stringify({time:new Date().toISOString(),...data}));
try{
 initializeKeeperState(config);const adapter=new ChainAdapter(config);await adapter.validate();log({event:'started',broadcast,goalCount:config.goals.length});
 do{
  adapter.cycleActions=0;let cycleErrors=0;
  for(const goal of config.goals){if(stopped)break;try{await runGoal(goal,config,adapter,broadcast,log);}catch(error){cycleErrors++;log({event:'goal-error',goal:goal.name,error:error.name,code:'operation-paused'});}}
  if(once&&cycleErrors)process.exitCode=1;if(once||stopped)break;
  await new Promise(resolve=>{const finish=()=>{clearTimeout(timeout);process.off('SIGINT',finish);process.off('SIGTERM',finish);resolve();};const timeout=setTimeout(finish,config.intervalMs);process.once('SIGINT',finish);process.once('SIGTERM',finish);});
 }while(!stopped);
 log({event:'stopped'});
}catch(error){log({event:'worker-paused',error:error.name,code:'startup-or-state-validation-failed'});process.exitCode=1;}finally{release();}
