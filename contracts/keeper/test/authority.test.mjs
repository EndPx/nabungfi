import test from 'node:test';
import assert from 'node:assert/strict';
import {authorityMode, validateGoalAuthority, validateSolanaSigner, assertCoordinationAction} from '../src/authority.mjs';
const owner = 'user-solana-owner', payer = 'operator-solana-fee-payer', evm = '0x'+'1'.repeat(40);
const goal = {owner, autoPrepare:false, participants:[{owner:'0x'+'2'.repeat(40)}]};
const config = {authorityMode:'permissionless', evm:{signerAddress:evm}};
test('permissionless operator coordinates a user goal without acquiring owner authority',()=>{
  validateGoalAuthority(config,goal);validateSolanaSigner(config,[goal],payer);
  for(const kind of ['register','command','local-ready','achieve','ack','progress','ready','report'])assertCoordinationAction(config,goal,{kind},payer);
});
test('permissionless operator cannot prepare even if its fee payer happens to be the owner',()=>{
  assert.throws(()=>assertCoordinationAction(config,goal,{kind:'prepare'},owner),/cannot prepare/);
  assert.throws(()=>validateGoalAuthority(config,{...goal,autoPrepare:true}),/User must sign/);
});
test('every owner financial action and unknown instruction is denied at the signing boundary',()=>{
  for(const kind of ['deposit','claim','initialize','begin_abort','invest','redeem','unknown'])assert.throws(()=>assertCoordinationAction(config,goal,{kind},payer),/cannot perform/);
});
test('legacy owner policy remains explicit and rejects substituted signers',()=>{
  const legacy={evm:{signerAddress:evm}},g={...goal,autoPrepare:true,participants:[{owner:evm}]};
  assert.equal(authorityMode(legacy),'owner');assertCoordinationAction(legacy,g,{kind:'prepare'},owner);
  assert.throws(()=>validateSolanaSigner(legacy,[g],payer),/goal owner/);
  assert.throws(()=>assertCoordinationAction(legacy,g,{kind:'prepare'},payer),/actual owner/);
  assert.throws(()=>validateGoalAuthority(legacy,goal));
  assert.throws(()=>assertCoordinationAction(legacy,{...g,autoPrepare:false},{kind:'prepare'},owner),/not authorized/);
});
