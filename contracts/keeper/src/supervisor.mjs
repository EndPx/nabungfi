import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readConfig,validateConfig} from './config.mjs';
import {readRegistry} from './registry.mjs';
import {auditRestartState,recoverSameHostSignerLock} from './supervision.mjs';

const args=process.argv.slice(2),index=args.indexOf('--config');
assert(index>=0&&args[index+1],'Usage: flock -n --no-fork <signer.lock>.supervisor node supervisor.mjs --config <private.json> [--once] [--broadcast]');
assert(args.every((arg,i)=>['--config','--once','--broadcast'].includes(arg)||i===index+1),'Unknown argument');
try{
  const config=readConfig(args[index+1]);assert.equal(config.authorityMode,'permissionless');assert(config.registryFile);
  const effective=validateConfig({...config,goals:readRegistry(config.registryFile)});
  const audit=auditRestartState(config,effective.goals);
  const recovery=recoverSameHostSignerLock(config.signerLockFile);
  console.log(JSON.stringify({event:'keeper-restart-validated',...audit,lock:recovery,broadcast:args.includes('--broadcast')}));
  const child=spawn(process.execPath,[fileURLToPath(new URL('./registry-cli.mjs',import.meta.url)),...args],{stdio:'inherit'});
  const forward=signal=>{if(child.exitCode===null)child.kill(signal);};
  process.on('SIGINT',()=>forward('SIGINT'));process.on('SIGTERM',()=>forward('SIGTERM'));
  await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>{process.exitCode=code??(signal?1:0);resolve();});});
}catch(error){console.error(JSON.stringify({event:'keeper-supervisor-paused',code:'restart-validation-failed',error:error.name}));process.exitCode=1;}
