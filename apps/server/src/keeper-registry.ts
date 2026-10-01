import {readFile, writeFile, mkdir, rename} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {assertGoalBinding,type GoalBinding} from '@nabungfi/shared/chain';
import type {ApplicationRepository} from './repository.js';

export interface OperatorGoal {
 name:string;owner:string;goalId:string;target:string;autoPrepare:false;maxAutoPrepareRounds:1;
 participants:{domain:number;eid:number;asset:string;router:string;vault:string;owner:string}[];
}
interface Registry {version:1;updatedAt:string;goals:OperatorGoal[]}
const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)])):value;
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
export function operatorGoal(binding:GoalBinding):OperatorGoal {
 assertGoalBinding(binding);
 if(!binding.initialized||binding.participants.some(p=>!p.vault||!p.configHash||!p.creationHash))throw new Error('Unverified provisioning cannot enter the operator registry');
 return{name:binding.goalId,owner:binding.owner.solana,goalId:binding.goalId,target:binding.targetRaw,autoPrepare:false,maxAutoPrepareRounds:1,
  participants:binding.participants.map(p=>({domain:p.domain,eid:p.eid,asset:p.asset,router:p.router,vault:p.vault!,owner:binding.owner.evm}))};
}
export function mergeRegistry(prior:OperatorGoal[],incoming:OperatorGoal[]):OperatorGoal[] {
 const goals=new Map<string,OperatorGoal>();
 for(const entry of [...prior,...incoming]){
  if(!/^0x[0-9a-f]{64}$/.test(entry.goalId)||entry.autoPrepare!==false)throw new Error('Invalid operator goal');
  const previous=goals.get(entry.goalId);if(previous&&hash(previous)!==hash(entry))throw new Error('Accepted operator identity changed');goals.set(entry.goalId,entry);
 }
 if(goals.size>500)throw new Error('Operator capacity exceeded');return[...goals.values()];
}
export async function publishKeeperRegistry(repo:Pick<ApplicationRepository,'listKeeperBindings'>,file:string):Promise<{goals:number;capacity:number}> {
 const path=resolve(file);if(!path.split(/[\\/]/).includes('.local'))throw new Error('Operator registry must be in private local state');
 let prior:Registry={version:1,updatedAt:new Date().toISOString(),goals:[]};
 try{prior=JSON.parse(await readFile(path,'utf8'));if(prior.version!==1||!Array.isArray(prior.goals))throw new Error('Invalid previous registry');}
 catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 const records=await repo.listKeeperBindings(),goals=mergeRegistry(prior.goals,records.map(r=>operatorGoal(r.binding)));
 await mkdir(dirname(path),{recursive:true});const temporary=path+'.'+randomUUID()+'.tmp';
 await writeFile(temporary,JSON.stringify({version:1,updatedAt:new Date().toISOString(),goals}),{encoding:'utf8',mode:0o600});await rename(temporary,path);
 return{goals:goals.length,capacity:500};
}
export function startRegistryPublisher(repo:Pick<ApplicationRepository,'listKeeperBindings'>,file:string) {
 let stopped=false,inflight:Promise<unknown>|undefined;
 const tick=()=>{if(stopped||inflight)return;inflight=publishKeeperRegistry(repo,file).catch(()=>console.error('Operator registry publication paused; prior identities preserved.')).finally(()=>{inflight=undefined;});};
 tick();const timer=setInterval(tick,30000);timer.unref();
 return async()=>{stopped=true;clearInterval(timer);await inflight;};
}

export interface CoordinationStatus {configured:boolean;available:boolean;capacity:number;registered:number;reasonCode?:string}
export function coordinationRuntime(registryFile:string|undefined,statusFile:string|undefined,reserve:(goalId:string,acceptedIds:string[],capacity:number,completedIds:string[])=>Promise<void>) {
 const read=async():Promise<{status:CoordinationStatus;ids:string[];completedIds:string[]}>=>{
  if(!registryFile||!statusFile)return{status:{configured:false,available:false,capacity:6,registered:0,reasonCode:'OPERATOR_NOT_CONFIGURED'},ids:[],completedIds:[]};
  try{
   const registry=JSON.parse(await readFile(registryFile,'utf8')) as Registry;
   const heartbeat=JSON.parse(await readFile(statusFile,'utf8')) as {version:number;authorityMode:string;broadcast:boolean;lastCycleAt:string;errors:number;capacity:number;completedGoalIds:string[]};
   if(registry.version!==1||!Array.isArray(registry.goals)||heartbeat.version!==1||heartbeat.authorityMode!=='permissionless')throw new Error('Invalid operator state');
   if(heartbeat.capacity!==6||!Array.isArray(heartbeat.completedGoalIds))throw new Error('Unsupported operational admission policy');
   const ids=registry.goals.map(g=>g.goalId),completedIds=heartbeat.completedGoalIds.filter(id=>/^0x[0-9a-f]{64}$/.test(id)&&ids.includes(id));
   const age=Date.now()-Date.parse(heartbeat.lastCycleAt),available=Number.isFinite(age)&&age>=-5000&&age<=180000&&heartbeat.broadcast===true&&heartbeat.errors===0;
   return{status:{configured:true,available,capacity:6,registered:ids.length-completedIds.length,...(!available?{reasonCode:'OPERATOR_UNAVAILABLE'}:{})},ids,completedIds};
  }catch{return{status:{configured:true,available:false,capacity:6,registered:0,reasonCode:'OPERATOR_UNAVAILABLE'},ids:[],completedIds:[]};}
 };
 return{coordinationStatus:async()=>(await read()).status,async assertCoordinationAdmission(binding:GoalBinding){
  const current=await read();if(!current.status.available)throw new Error('OPERATOR_UNAVAILABLE');
  await reserve(binding.goalId,current.ids,current.status.capacity,current.completedIds);
 }};
}
