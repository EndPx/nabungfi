import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {atomicWrite, loadState, fingerprint} from '../src/persistence.mjs';
import {initializeRegistryState, readRegistry} from '../src/registry.mjs';

const fixture=()=>{
 const dir=mkdtempSync(join(tmpdir(),'nabung-registry-'));
 return {dir,config:{authorityMode:'permissionless',registryFile:join(dir,'registry.json'),stateDirectory:join(dir,'state'),policy:{maxActionsPerDay:20},goals:[]},cleanup:()=>rmSync(dir,{recursive:true,force:true})};
};
const goal=n=>({goalId:'0x'+String(n).repeat(64),owner:'user-'+n,autoPrepare:false,targetRaw:'8000000',participants:[]});
test('registry append preserves original signed intents and shared budget reservations',()=>{
 const f=fixture();try{
  initializeRegistryState(f.config,[goal(1)]);
  const path=join(f.config.stateDirectory,goal(1).goalId.slice(2)+'.json'),ledger=loadState(path);
  ledger.intents.original={hash:'original-hash',status:'submitted'};atomicWrite(path,ledger);
  const budgets=loadState(join(f.config.stateDirectory,'budgets.json'));budgets.reservations.original={spend:'10'};atomicWrite(join(f.config.stateDirectory,'budgets.json'),budgets);
  initializeRegistryState(f.config,[goal(1),goal(2)]);
  assert.equal(loadState(path).intents.original.hash,'original-hash');assert.equal(loadState(join(f.config.stateDirectory,'budgets.json')).reservations.original.spend,'10');
 }finally{f.cleanup();}
});
test('accepted identity, removal, policy change and missing journal fail closed',()=>{
 const f=fixture();try{
  initializeRegistryState(f.config,[goal(1)]);
  assert.throws(()=>initializeRegistryState(f.config,[]),/removed/);
  assert.throws(()=>initializeRegistryState(f.config,[{...goal(1),targetRaw:'1'}]),/identity changed/);
  assert.throws(()=>initializeRegistryState({...f.config,policy:{maxActionsPerDay:200}},[goal(1)]),/configuration changed/);
  unlinkSync(join(f.config.stateDirectory,goal(1).goalId.slice(2)+'.json'));
  assert.throws(()=>initializeRegistryState(f.config,[goal(1)]),/missing or corrupt/);
 }finally{f.cleanup();}
});
test('unsigned orphan can be reconciled but signed orphan cannot be adopted silently',()=>{
 const f=fixture();try{
  initializeRegistryState(f.config,[]);const g=goal(1),path=join(f.config.stateDirectory,g.goalId.slice(2)+'.json');
  atomicWrite(path,{version:1,allowlistHash:fingerprint(g),intents:{bad:{hash:'already-signed'}}});
  assert.throws(()=>initializeRegistryState(f.config,[g]),/Orphan signed/);
  atomicWrite(path,{version:1,allowlistHash:fingerprint(g),intents:{}});
  assert.equal(initializeRegistryState(f.config,[g]).goals.length,1);
 }finally{f.cleanup();}
});
test('registry rejects duplicate goals and automatic owner preparation',()=>{
 const f=fixture();try{
  atomicWrite(f.config.registryFile,{version:1,goals:[goal(1),goal(1)]});assert.throws(()=>readRegistry(f.config.registryFile),/Duplicate/);
  assert.throws(()=>initializeRegistryState(f.config,[{...goal(1),autoPrepare:true}]),/User must prepare/);
 }finally{f.cleanup();}
});
