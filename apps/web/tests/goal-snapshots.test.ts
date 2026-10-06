import {test} from "node:test";
import assert from "node:assert/strict";
import type {GoalDTO} from "@nabungfi/shared/application";
import {readGoalSnapshots,retainGoalPresentation} from "../src/goal-snapshots.ts";
const metadata = (id:string) => ({id,goalId:`chain-${id}`,targetRaw:"200000",chainState:null,chainStatus:"unavailable",binding:{owner:{solana:"SolanaOwner",evm:"0xabcdef"}}}) as GoalDTO;
test("a refreshing presentation retains only the same goal's last read while fresh detail remains authoritative", async()=>{
  const prior=[{...metadata("car"),chainStatus:"available",chainState:{phase:"saving",totalAssetsRaw:"10"}}] as GoalDTO[];
  const next=retainGoalPresentation([metadata("car"),metadata("house")],prior);
  assert.equal(next[0]?.chainState?.totalAssetsRaw,"10");assert.equal(next[1]?.chainState,null);
  const substituted=retainGoalPresentation([{...metadata("car"),targetRaw:"99"}],prior);
  assert.equal(substituted[0]?.chainState,null);
  const failed=await readGoalSnapshots(next,async()=>{throw Error("RPC unavailable");});
  assert(failed.every(goal=>goal.chainState===null&&goal.chainStatus==="unavailable"));
});
test("metadata-only lists acquire fresh independent detail snapshots without losing their order",async()=>{
  const input=[metadata("car"),metadata("laptop"),metadata("house")],seen:string[]=[];
  const details=await readGoalSnapshots(input,async id=>{seen.push(id);return {...metadata(id),chainStatus:"unprovisioned"};},"house");
  assert.equal(seen[0],"house");assert.deepEqual(details.map(g=>g.id),["car","laptop","house"]);assert(details.every(g=>g.chainStatus==="unprovisioned"));
  assert(input.every(g=>g.chainState===null&&g.chainStatus==="unavailable"));
});
test("a failed or mismatched detail cannot borrow another goal's balance or reuse a cached achievement",async()=>{
  const input=[{...metadata("car"),chainState:{phase:"achieved",totalAssetsRaw:"999999"}},metadata("laptop"),metadata("house")] as GoalDTO[];
  const output=await readGoalSnapshots(input,async id=>{if(id==="car")throw Error("RPC down");if(id==="laptop")return {...metadata(id),targetRaw:"1",chainStatus:"available"};return {...metadata(id),chainStatus:"available"};});
  assert.equal(output[0]?.chainState,null);assert.equal(output[0]?.chainStatus,"unavailable");assert.equal(output[1]?.targetRaw,"200000");assert.equal(output[1]?.chainStatus,"unavailable");assert.equal(output[2]?.chainStatus,"available");
});
test("financial detail reads have bounded concurrency and empty portfolios make no calls",async()=>{
  let active=0,max=0,calls=0;
  const read=async(id:string)=>{calls++;active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,3));active--;return metadata(id);};
  await readGoalSnapshots(Array.from({length:7},(_,i)=>metadata(String(i))),read);
  assert.equal(calls,7);assert(max<=2);assert.deepEqual(await readGoalSnapshots([],read),[]);assert.equal(calls,7);
});
