import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {VersionedTransaction} from '@solana/web3.js';
import {SOLANA_DEPLOYMENT,type ChainPlan,type GoalBinding} from '@nabungfi/shared/chain';
import {resolveExpiredSolana} from '../src/chain/expired-solana.js';
import type {RpcTransport} from '../src/chain/rpc.js';
const fixtures=JSON.parse(readFileSync(new URL('../../web/tests/fixtures/unsigned-plans.json',import.meta.url),'utf8'));
const binding=fixtures.binding as GoalBinding;
const original=Object.values(fixtures.plans).find((p:any)=>p.network==='solana'&&p.action==='deposit') as ChainPlan;
const plan=original;
function rpc(overrides:Record<string,unknown>={}):RpcTransport{return{solana:{getGenesisHash:async()=>SOLANA_DEPLOYMENT.genesis,getBlockHeight:async()=>Number((plan.transaction as any).lastValidBlockHeight)+100,isBlockhashValid:async()=>({value:false}),getSignaturesForAddress:async()=>[{signature:'older',blockTime:Math.floor(Date.parse(plan.createdAt)/1000)-60}],...overrides}} as unknown as RpcTransport;}
test('an expired exact message with covered finalized history is closed without signing or claiming a transaction receipt',async()=>{
  const result=await resolveExpiredSolana(rpc(),binding,plan);assert.equal(result.kind,'expired-unsubmitted');if(result.kind==='expired-unsubmitted'){assert.equal(result.proof.historyCoveredBeforeCreation,true);assert.equal(result.proof.transactionReplacement,false);}
});
test('a located original message returns its original signature even when its receipt failed',async()=>{
  const message=VersionedTransaction.deserialize(Buffer.from((plan.transaction as any).base64,'base64')).message;
  const result=await resolveExpiredSolana(rpc({getSignaturesForAddress:async()=>[{signature:'original',blockTime:Math.floor(Date.parse(plan.createdAt)/1000)}],getTransaction:async()=>({transaction:{message},meta:{err:{InstructionError:[0,1]}}})}),binding,plan);
  assert.deepEqual(result,{kind:'located',transactionHash:'original'});
});
test('a live blockhash, wrong chain, missing timestamps, pruned transactions and an unbounded history fail closed',async()=>{
  for(const overrides of [
    {getGenesisHash:async()=> 'another-chain'},
    {isBlockhashValid:async()=>({value:true})},
    {getBlockHeight:async()=>Number((plan.transaction as any).lastValidBlockHeight)},
    {getSignaturesForAddress:async()=>[{signature:'unknown',blockTime:null}]},
    {getSignaturesForAddress:async()=>[{signature:'pruned',blockTime:Math.floor(Date.parse(plan.createdAt)/1000)}],getTransaction:async()=>null},
    {getSignaturesForAddress:async()=>[{signature:'recent',blockTime:Math.floor(Date.parse(plan.createdAt)/1000)}],getTransaction:async()=>({transaction:{message:{serialize:()=>new Uint8Array([1])}}})},
  ])await assert.rejects(resolveExpiredSolana(rpc(overrides),binding,plan));
});
