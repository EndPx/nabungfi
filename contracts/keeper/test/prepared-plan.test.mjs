import test from 'node:test';
import assert from 'node:assert/strict';
import {preparedPlanIdentity} from '../src/prepared-plan.mjs';
test('exact EVM calldata, value, nonce, fees, spend and action are bound before signing',()=>{
 const plan={network:'evm-2',chain:{chainId:84532},tx:{to:'router',data:'allowed-calldata',value:'0x1'},nonce:'3',gasLimit:'100000',gasPrice:'100',value:'1',spend:'10000001',action:{kind:'progress',domain:2}};
 const original=preparedPlanIdentity(plan);
 for(const field of ['nonce','gasLimit','gasPrice','value','spend'])assert.notEqual(preparedPlanIdentity({...plan,[field]:'999'}),original);
 assert.notEqual(preparedPlanIdentity({...plan,tx:{...plan.tx,data:'claim-calldata'}}),original);
 assert.notEqual(preparedPlanIdentity({...plan,action:{kind:'claim',domain:2}}),original);
});
test('Solana compiled message bytes bind all accounts, program instructions and blockhash',()=>{
 const plan={network:'solana',tx:{message:{serialize:()=>Uint8Array.of(1,2,3)}},spend:'10',action:{kind:'register',domain:2}};
 assert.notEqual(preparedPlanIdentity({...plan,tx:{message:{serialize:()=>Uint8Array.of(1,2,4)}}}),preparedPlanIdentity(plan));
});
