import test from 'node:test';import assert from 'node:assert/strict';
import fixtures from './fixtures/unsigned-plans.json';
import {sponsoredGoalNetworks} from '../src/gas-sponsorship';
import type {GoalBinding} from '@nabungfi/shared/chain';
const binding=fixtures.binding as GoalBinding;
test('sponsorship display requires the linked embedded owner and server capability for selected chains only',()=>{
 const wallets=[{chainType:'ethereum' as const,address:binding.owner.evm,walletId:'fixture-evm',walletClientType:'privy' as const},{chainType:'solana' as const,address:binding.owner.solana,walletId:'fixture-sol',walletClientType:'privy' as const}];
 assert.deepEqual(sponsoredGoalNetworks(binding,wallets,false),[]);
 assert.deepEqual(sponsoredGoalNetworks(binding,wallets,true),['solana',...binding.participants.map(p=>p.network)]);
 assert.deepEqual(sponsoredGoalNetworks(binding,wallets.map(w=>({...w,walletClientType:undefined})),true),[]);
 assert.deepEqual(sponsoredGoalNetworks(binding,[{...wallets[0]!,address:'0x'+'f'.repeat(40)}],true),[]);
});
