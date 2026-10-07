import {test} from "node:test";
import assert from "node:assert/strict";
import {chainAllocation,formatExactUsdc,formatChainShare} from "../src/savings-progress";

test("allocation uses each goal's remaining and collected micro-USDC exactly",()=>{
  const rows=[{network:"solana" as const,assetsRaw:"10000000",claimedRaw:"15000000"},{network:"base" as const,assetsRaw:"62000000",claimedRaw:"0"},{network:"arbitrum" as const,assetsRaw:"8000000",claimedRaw:"0"},{network:"ethereum" as const,assetsRaw:"5000000",claimedRaw:"0"}];
  const allocation=chainAllocation(rows);
  assert.equal(allocation.totalRaw,"100000000");
  assert.deepEqual(allocation.shares.map(s=>s.basisPoints),[2500,6200,800,500]);
  const collected=chainAllocation(rows.map(r=>({...r,claimedRaw:(BigInt(r.assetsRaw)+BigInt(r.claimedRaw)).toString(),assetsRaw:"0"})));
  assert.equal(collected.totalRaw,allocation.totalRaw);
  assert.deepEqual(collected.shares.map(s=>s.basisPoints),allocation.shares.map(s=>s.basisPoints));
});

test("rounded shares total 100% even for thirds and preserve zero-funded chains",()=>{
  const result=chainAllocation([{network:"base",assetsRaw:"1",claimedRaw:"0"},{network:"solana",assetsRaw:"1",claimedRaw:"0"},{network:"ethereum",assetsRaw:"1",claimedRaw:"0"},{network:"arbitrum",assetsRaw:"0",claimedRaw:"0"}]);
  assert.deepEqual(result.shares.map(s=>s.basisPoints),[3334,3333,3333,0]);
  assert.equal(result.shares.reduce((n,s)=>n+s.basisPoints,0),10000);
});

test("allocation conserves raw amounts beyond JavaScript's safe integer range",()=>{
  const amount="9007199254740993";
  const result=chainAllocation([{network:"solana",assetsRaw:amount,claimedRaw:"1"},{network:"base",assetsRaw:amount,claimedRaw:"1"}]);
  assert.equal(result.totalRaw,"18014398509481988");
  assert.deepEqual(result.shares.map(s=>s.amountRaw),["9007199254740994","9007199254740994"]);
  assert.deepEqual(result.shares.map(s=>s.basisPoints),[5000,5000]);
});

test("empty allocations do not invent shares and negative quantities are rejected",()=>{
  assert.deepEqual(chainAllocation([]),{totalRaw:"0",shares:[]});
  assert.equal(chainAllocation([{network:"solana",assetsRaw:"0",claimedRaw:"0"}]).shares[0].basisPoints,0);
  assert.throws(()=>chainAllocation([{network:"base",assetsRaw:"1",claimedRaw:"-1"}]),/Invalid chain allocation/);
});

test("allocation details preserve all six USDC decimals and tiny positive shares",()=>{
  assert.equal(formatExactUsdc("10000001"),"10.000001");
  assert.equal(formatExactUsdc("1"),"0.000001");
  assert.equal(formatChainShare(6200,"62000000"),"62%");
  assert.equal(formatChainShare(0,"1"),"<0.01%");
  assert.equal(formatChainShare(0,"0"),"0%");
});
