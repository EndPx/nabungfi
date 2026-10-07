import {PublicKey,VersionedTransaction} from '@solana/web3.js';
import {SOLANA_DEPLOYMENT,ChainValidationError,type ChainPlan,type GoalBinding} from '@nabungfi/shared/chain';
import type {RpcTransport} from './rpc.js';
import {assertPlan} from './planner.js';

export type ExpiredSolanaResolution = {kind:'located';transactionHash:string} | {kind:'expired-unsubmitted';proof:Record<string,unknown>};
/** Finalized payer history plus an invalid original lifetime proves that this exact message cannot execute later. */
export async function resolveExpiredSolana(rpc:RpcTransport,b:GoalBinding,plan:ChainPlan):Promise<ExpiredSolanaResolution>{
  assertPlan(b,plan);
  if(plan.transaction.kind!=='solana')throw new ChainValidationError('SOLANA_ORIGINAL_REQUIRED','This recovery only checks an original Solana message.');
  if(await rpc.solana.getGenesisHash()!==SOLANA_DEPLOYMENT.genesis)throw new ChainValidationError('WRONG_CHAIN','Expected Solana Devnet.');
  const tx=plan.transaction,finalizedHeight=await rpc.solana.getBlockHeight('finalized');
  if(Date.now()<=Date.parse(plan.expiresAt)||finalizedHeight<=tx.lastValidBlockHeight||(await rpc.solana.isBlockhashValid(tx.blockhash,{commitment:'finalized'})).value)
    throw new ChainValidationError('ORIGINAL_STILL_LIVE','The original message can still land. Wait or supply its original signature.');
  const original=Buffer.from(VersionedTransaction.deserialize(Buffer.from(tx.base64,'base64')).message.serialize());
  const earliest=Math.floor((Date.parse(plan.createdAt)-30000)/1000),payer=new PublicKey(plan.owner);let before:string|undefined,checked=0,covered=false;
  for(let page=0;page<5;page++){
    const signatures=await rpc.solana.getSignaturesForAddress(payer,{limit:100,...(before?{before}:{})},'finalized');
    if(!signatures.length){covered=true;break;}
    for(const row of signatures){
      if(row.blockTime===null||row.blockTime===undefined)throw new ChainValidationError('ORIGINAL_HISTORY_UNAVAILABLE','A finalized history timestamp is unavailable. Keep the original request.');
      if(row.blockTime<earliest){covered=true;break;}
      const receipt=await rpc.solana.getTransaction(row.signature,{commitment:'finalized',maxSupportedTransactionVersion:0});
      if(!receipt)throw new ChainValidationError('ORIGINAL_HISTORY_UNAVAILABLE','A finalized transaction could not be inspected. Keep the original request.');
      checked++;
      if(Buffer.from(receipt.transaction.message.serialize()).equals(original))return{kind:'located',transactionHash:row.signature};
    }
    if(covered)break;before=signatures.at(-1)!.signature;
  }
  if(!covered)throw new ChainValidationError('ORIGINAL_HISTORY_LIMIT','Payer history exceeded the bounded recovery window. Keep the original request.');
  return{kind:'expired-unsubmitted',proof:{kind:'finalized-expired-message-absence',network:'solana-devnet',owner:plan.owner,planFingerprint:plan.fingerprint,originalBlockhash:tx.blockhash,lastValidBlockHeight:tx.lastValidBlockHeight,finalizedHeight,checkedTransactions:checked,historyCoveredBeforeCreation:true,observedAt:new Date().toISOString(),transactionReplacement:false}};
}
