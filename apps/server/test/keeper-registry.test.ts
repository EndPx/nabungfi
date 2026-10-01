import test from 'node:test';
import assert from 'node:assert/strict';
import {operatorGoal,mergeRegistry} from '../src/keeper-registry.js';
import type {GoalBinding} from '@nabungfi/shared/chain';
import {deriveGoalBinding} from '../src/chain/index.js';
const binding=()=>{const b=deriveGoalBinding({goalId:'0x'+'1'.repeat(64),targetRaw:'8000000',owner:{solana:'AMoZFFdhUaNq8qyVRE4RrdW7rBc5Jssc6b7MyERMB7s8',evm:'0x'+'2'.repeat(40)},networks:['solana','base']});return b;};
test('only actual initialized receipt-bound identities can enter coordination',()=>{
 const b=binding();assert.throws(()=>operatorGoal(b),/Unverified/);
 const full:GoalBinding={...b,initialized:true,participants:b.participants.map(p=>({...p,vault:'0x'+'3'.repeat(40),configHash:'0x'+'4'.repeat(64),creationHash:'0x'+'5'.repeat(64)}))};
 const goal=operatorGoal(full);assert.equal(goal.autoPrepare,false);assert.equal(goal.owner,full.owner.solana);
 assert.equal(goal.participants[0]?.owner,full.owner.evm);assert.equal(goal.name,full.goalId);
});
test('registry retains accepted identities when API data disappears and refuses rebinding',()=>{
 const b=binding();b.initialized=true;b.participants=b.participants.map(p=>({...p,vault:'0x'+'3'.repeat(40),configHash:'0x'+'4'.repeat(64),creationHash:'0x'+'5'.repeat(64)}));const g=operatorGoal(b);
 assert.deepEqual(mergeRegistry([g],[]),[g]);assert.deepEqual(mergeRegistry([g],[g]),[g]);
 assert.throws(()=>mergeRegistry([g],[{...g,target:'1'}]),/identity changed/);
 assert.throws(()=>mergeRegistry([],[{...g,autoPrepare:true} as unknown as typeof g]),/Invalid/);
});
