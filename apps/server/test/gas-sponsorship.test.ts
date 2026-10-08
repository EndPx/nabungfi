import test from 'node:test';
import assert from 'node:assert/strict';
import {Keypair,PublicKey,TransactionMessage,VersionedTransaction} from '@solana/web3.js';
import {encodeAbiParameters,encodeEventTopics,encodeFunctionData,parseAbiParameters,type Hex} from 'viem';
import {ENTRY_POINT,ENTRY_ABI,ACCOUNT_ABI,sponsoredEvmReceipt,assertSponsoredSolanaMessage} from '../src/chain/sponsored-receipt.js';
import {deriveGoalBinding,configurationHash,financialInstruction,ABI,word,addressWord,solanaAddressWord} from '../src/chain/codec.js';
import {assertUsablePlan,assertPlan,planFingerprint,sponsoredFeeSimulationError} from '../src/chain/planner.js';
import {resolveExpiredSolana} from '../src/chain/expired-solana.js';
import {assertTokenEvent,type EvmReceipt,type EvmTransaction} from '../src/chain/receipt.js';
import {testnetGasPayment,assertGasEligibility} from '../src/gas-policy.js';
import {authoritativeWallets} from '../src/auth.js';
import type {RpcTransport} from '../src/chain/rpc.js';
import {SOLANA_DEPLOYMENT,type ChainPlan} from '@nabungfi/shared/chain';
import {applicationServer,type ChainServices} from '../src/application-server.js';
import type {ApplicationRepository} from '../src/repository.js';
import {once} from 'node:events';

// Synthetic receipts exercise the verifier boundary; they are not network-execution evidence.
const owner={evm:'0x'+'1'.repeat(40),solana:Keypair.generate().publicKey.toBase58()};
const b=deriveGoalBinding({owner,goalId:'0x'+'2'.repeat(64),targetRaw:'1000000',networks:['solana','base']});
b.participants[0]!.vault='0x'+'3'.repeat(40);b.participants[0]!.configHash=configurationHash(b,b.participants[0]!,b.participants[0]!.vault!);
function sealed<T extends Omit<ChainPlan,'fingerprint'>>(raw:T):ChainPlan{return {...raw,fingerprint:planFingerprint(raw)};}
const p=sealed({id:'offline-step',goalId:b.goalId,owner:owner.evm,action:'deposit',network:'base',amountRaw:'1000000',gasPayment:'privy-testnet',createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60000).toISOString(),transaction:{kind:'evm',chainId:84532,to:b.participants[0]!.vault!,data:'0x'+ABI.deposit+word('1000000'),value:'0'}});
const hash=('0x'+'5'.repeat(64)) as Hex, zero32=('0x'+'0'.repeat(64)) as Hex, paymaster=('0x'+'6'.repeat(40)) as Hex;
const callData=encodeFunctionData({abi:ACCOUNT_ABI,functionName:'execute',args:[b.participants[0]!.vault! as Hex,0n,('0x'+ABI.deposit+word('1000000')) as Hex]});
const op={sender:owner.evm as Hex,nonce:1n,initCode:'0x' as Hex,callData,accountGasLimits:zero32,preVerificationGas:1n,gasFees:zero32,paymasterAndData:(paymaster+'0'.repeat(64)) as Hex,signature:('0x'+'1'.repeat(130)) as Hex};
const before={address:ENTRY_POINT,topics:[...encodeEventTopics({abi:ENTRY_ABI,eventName:'BeforeExecution'})],data:'0x'};
const event=(h:Hex,sender:Hex=op.sender,success=true,nonce=1n)=>({address:ENTRY_POINT,topics:[...encodeEventTopics({abi:ENTRY_ABI,eventName:'UserOperationEvent',args:{userOpHash:h,sender,paymaster}})],data:encodeAbiParameters(parseAbiParameters('uint256,bool,uint256,uint256'),[nonce,success,100n,200n])});
const transfer={address:b.participants[0]!.asset,topics:['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef','0x'+addressWord(owner.evm),'0x'+addressWord(b.participants[0]!.vault!)],data:'0x'+word('1000000')};
const tx: EvmTransaction={hash,from:'0x'+'7'.repeat(40),to:ENTRY_POINT,input:encodeFunctionData({abi:ENTRY_ABI,functionName:'handleOps',args:[[op],paymaster]}),value:'0x0',chainId:'0x14a34',blockNumber:'0x10'};
const receipt: EvmReceipt={transactionHash:hash,status:'0x1',blockNumber:'0x10',blockHash:zero32,logs:[before,transfer,event(hash)]};
const rpc={call:async (_network:string,method:string)=>method==='eth_getCode'?'0xef010077021100bd87b7008e5e1989d0eb38555d0d0000':hash} as unknown as RpcTransport;

test('only server-enabled authoritative embedded owners receive sponsorship; external wallets and mainnet stay excluded',()=>{
 const wallets=authoritativeWallets({id:'did:privy:fixture',linked_accounts:[{type:'wallet',chain_type:'ethereum',address:owner.evm,id:'fixture-wallet',wallet_client_type:'privy'}]});
 const identity={subject:'fixture',wallets};assert.equal(testnetGasPayment(true,identity,b,'base'),'privy-testnet');
 assert.equal(testnetGasPayment(false,identity,b,'base'),undefined);assert.equal(testnetGasPayment(true,identity,b,'solana'),undefined);
 assert.equal(testnetGasPayment(true,{...identity,wallets:[{chainType:'ethereum',address:owner.evm}]},b,'base'),undefined);
 assert.equal(testnetGasPayment(true,identity,b,'mainnet' as any),undefined);
 assert.throws(()=>assertGasEligibility(false,identity,b,p));assertGasEligibility(true,identity,b,p);
 assert.throws(()=>assertPlan(b,{...p,gasPayment:undefined}));
});
test('canonical sponsored owner call and paymaster event prove only their own execution segment',async()=>{
 const result=await sponsoredEvmReceipt(rpc,p,tx,receipt);assert.equal(result.userOperationHash,hash);assert.equal(result.success,true);assert.deepEqual(result.receipt.logs,[transfer]);assertTokenEvent(b,p,result.receipt);
 const other={...op,sender:('0x'+'8'.repeat(40)) as Hex,nonce:2n},otherHash=('0x'+'9'.repeat(64)) as Hex;
 const bundled={...tx,input:encodeFunctionData({abi:ENTRY_ABI,functionName:'handleOps',args:[[other,op],paymaster]})};
 const logs=[before,{...transfer,data:'0x'+word('999')},event(otherHash,other.sender,true,2n),transfer,event(hash)];
 assert.deepEqual((await sponsoredEvmReceipt(rpc,p,bundled,{...receipt,logs})).receipt.logs,[transfer]);
});
test('sponsored envelopes reject substituted network, sender, destination, amount, extra calls, payer and event',async()=>{
 for(const bad of [{...tx,to:owner.evm},{...tx,chainId:'0x1'},{...tx,value:'0x1'},
   {...tx,input:encodeFunctionData({abi:ENTRY_ABI,functionName:'handleOps',args:[[{...op,sender:paymaster}],paymaster]})},
   {...tx,input:encodeFunctionData({abi:ENTRY_ABI,functionName:'handleOps',args:[[{...op,callData:encodeFunctionData({abi:ACCOUNT_ABI,functionName:'execute',args:[paymaster,0n,callData]})}],paymaster]})},
   {...tx,input:encodeFunctionData({abi:ENTRY_ABI,functionName:'handleOps',args:[[{...op,callData:encodeFunctionData({abi:ACCOUNT_ABI,functionName:'executeBatch',args:[[{target:b.participants[0]!.vault! as Hex,value:0n,data:callData},{target:paymaster,value:0n,data:'0x'}]]})}],paymaster]})},
   {...tx,input:encodeFunctionData({abi:ENTRY_ABI,functionName:'handleOps',args:[[{...op,paymasterAndData:'0x'}],paymaster]})}]) await assert.rejects(sponsoredEvmReceipt(rpc,p,bad,receipt));
 await assert.rejects(sponsoredEvmReceipt(rpc,p,tx,{...receipt,logs:[before,transfer,event(hash,op.sender,true,2n)]}));
 await assert.rejects(sponsoredEvmReceipt({...rpc,call:async()=> '0x'} as RpcTransport,p,tx,receipt));
 await assert.rejects(sponsoredEvmReceipt(rpc,p,tx,{...receipt,logs:[before,transfer,event(('0x'+'a'.repeat(64)) as Hex)]}));
});
test('inner user-operation failure is distinct from successful bundle; extra token fee/approval cannot pass conservation',async()=>{
 assert.equal((await sponsoredEvmReceipt(rpc,p,tx,{...receipt,logs:[before,event(hash,op.sender,false)]})).success,false);
 const segment={...receipt,logs:[transfer,{...transfer,topics:[transfer.topics[0]!,'0x'+addressWord(owner.evm),'0x'+addressWord(paymaster)],data:'0x'+word('1')}]};
 assert.throws(()=>assertTokenEvent(b,p,segment));
});
test('7702 executeUserOp prefix can wrap one exact execution; changed calldata is rejected',async()=>{
 const prefix=encodeFunctionData({abi:ACCOUNT_ABI,functionName:'executeUserOp',args:[op,zero32]}).slice(0,10);
 const prefixed={...op,callData:(prefix+callData.slice(2)) as Hex};
 const wrapped={...tx,input:encodeFunctionData({abi:ENTRY_ABI,functionName:'handleOps',args:[[prefixed],paymaster]})};
 assert.equal((await sponsoredEvmReceipt(rpc,p,wrapped,receipt)).success,true);
});
const solRaw={id:'sol-fixture',goalId:b.goalId,owner:owner.solana,action:'deposit' as const,network:'solana' as const,amountRaw:'1000000',gasPayment:'privy-testnet' as const,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60000).toISOString()};
const original=new VersionedTransaction(new TransactionMessage({payerKey:new PublicKey(owner.solana),recentBlockhash:b.solanaGoal,instructions:[financialInstruction(b,'deposit','1000000')]}).compileToV0Message());
const sol=sealed({...solRaw,transaction:{kind:'solana',chainId:'solana-devnet',base64:Buffer.from(original.serialize()).toString('base64'),blockhash:b.solanaGoal,lastValidBlockHeight:1}});
test('Solana sponsorship permits only payer/blockhash changes while preserving owner signature and canonical instructions',()=>{
 const payer=Keypair.generate().publicKey;
 const message=new TransactionMessage({payerKey:payer,recentBlockhash:payer.toBase58(),instructions:[financialInstruction(b,'deposit','1000000')]}).compileToV0Message();
 assertSponsoredSolanaMessage(sol,message);
 const altered=new TransactionMessage({payerKey:payer,recentBlockhash:payer.toBase58(),instructions:[financialInstruction(b,'deposit','999999')]}).compileToV0Message();
 assert.throws(()=>assertSponsoredSolanaMessage(sol,altered));
 message.header.numRequiredSignatures=1;assert.throws(()=>assertSponsoredSolanaMessage(sol,message));
});
test('original unsigned blockhash expiry cannot close an unknown sponsored Solana outcome',async()=>{
 await assert.rejects(resolveExpiredSolana({} as RpcTransport,b,sol),(error:any)=>error.code==='SPONSORED_ORIGINAL_SIGNATURE_REQUIRED');
 assert.equal(sponsoredFeeSimulationError('InsufficientFundsForFee'),true);assert.equal(sponsoredFeeSimulationError({InstructionError:[0,'InsufficientFunds']}),false);
});
test('sponsored wallet-start still checks sealed route and exact calldata with zero owner gas; direct mode still rejects',async()=>{
 let simulations=0,gasReads=0;const peer=b.participants[0]!;
 const routeRpc={call:async(_n:string,method:string)=>{if(method==='eth_chainId')return '0x14a34';if(method==='eth_call'){simulations++;return '0x';}gasReads++;return method==='eth_estimateGas'?'0x5208':method==='eth_gasPrice'?'0x1':'0x0';},
  batch:async()=>['0x1','0x'+addressWord(peer.factory),'0x'+solanaAddressWord(SOLANA_DEPLOYMENT.store),'0x2','0x'+peer.eid.toString(16)]} as unknown as RpcTransport;
 await assertUsablePlan(routeRpc,b,p);assert.equal(simulations,1);assert.equal(gasReads,0);
 const {fingerprint,...raw}=p;await assert.rejects(assertUsablePlan(routeRpc,b,sealed({...raw,gasPayment:undefined})),(error:any)=>error.code==='INSUFFICIENT_GAS');
 const wrong={...routeRpc,batch:async()=>['0x0','0x'+addressWord(peer.factory),'0x'+solanaAddressWord(SOLANA_DEPLOYMENT.store),'0x2','0x'+peer.eid.toString(16)]};
 await assert.rejects(assertUsablePlan(wrong,b,p),(error:any)=>error.code==='WRONG_ROUTE');
});
test('HTTP capability negotiation keeps old PWA plans direct; client bodies cannot request sponsorship',async()=>{
 const gid='f725f35d-870b-45af-a7bf-8583e87a1e50',sid='8ca6304d-23f5-4c9c-b14f-18f5f24f24db';let selected:string|undefined;
 const repo={user:async()=>({id:'test-owner'}),goal:async()=>({id:gid,binding:b}),reserveStep:async()=>({isNew:true,step:{id:sid}}),savePlan:async(_u:unknown,_g:unknown,_s:unknown,plan:ChainPlan)=>({plan})} as unknown as ApplicationRepository;
 const chain={planGoalStep:async(_b:unknown,input:any)=>{selected=input.gasPayment;return p;}} as unknown as ChainServices;
 const server=applicationServer({privyAppId:'fixture',privyAppSecret:'unused',databaseUrl:'unused',origins:['http://127.0.0.1'],port:3001,host:'127.0.0.1',production:false,testnetGasSponsorship:true},repo,
  {authenticate:async()=>({subject:'fixture',wallets:[{chainType:'ethereum',address:owner.evm,walletId:'fixture-evm',walletClientType:'privy'},{chainType:'solana',address:owner.solana}]})},chain);
 server.listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();assert(address&&typeof address!=='string');
 const url=`http://127.0.0.1:${address.port}/api/goals/${gid}/steps`;
 const input={requestId:'f725f35d-870b-45af-a7bf-8583e87a1e51',network:'base',action:'deposit',amountRaw:'1000000'};
 try{
  const call=(body:unknown,version?:string)=>fetch(url,{method:'POST',headers:{'content-type':'application/json',...(version?{'X-NabungFi-Plan-Version':version}:{})},body:JSON.stringify(body)});
  assert.equal((await call(input)).status,201);assert.equal(selected,undefined);
  assert.equal((await call(input,'gas-v1')).status,201);assert.equal(selected,'privy-testnet');
  assert.equal((await call({...input,gasPayment:'privy-testnet'},'gas-v1')).status,400);
  const options=await fetch(url,{method:'OPTIONS',headers:{Origin:'http://127.0.0.1'}});assert.match(options.headers.get('access-control-allow-headers')!,/X-NabungFi-Plan-Version/);
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
