import assert from'node:assert/strict';import{atomicWrite,loadState}from'./persistence.mjs';
export function reserveNativeBudget(path,config,prepared,intent,cycle){
 const day=new Date().toISOString().slice(0,10),b=loadState(path,{version:1,reservations:{}});
 if(b.reservations[intent]){assert.equal(b.reservations[intent].hash,prepared.hash,'Reserved original signature differs');assert.equal(b.reservations[intent].spend,prepared.spend,'Reserved native spend differs');return;}
 const todays=Object.values(b.reservations).filter(r=>r.day===day);assert(todays.length<config.policy.maxActionsPerDay,'Daily action budget');assert(cycle.actions<config.policy.maxActionsPerCycle,'Cycle action budget');
 const spent=todays.filter(r=>r.network===prepared.network).reduce((sum,r)=>sum+BigInt(r.spend),0n),cap=prepared.network==='solana'?config.solana.dailySpendCap:config.networks.find(n=>`evm-${n.domain}`===prepared.network).dailySpendCap;
 assert(spent+BigInt(prepared.spend)<=BigInt(cap),'Daily native spend budget reached');b.reservations[intent]={day,network:prepared.network,hash:prepared.hash,spend:prepared.spend};atomicWrite(path,b);cycle.actions++;
}
