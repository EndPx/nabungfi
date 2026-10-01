import {fingerprint} from './persistence.mjs';

/** Identity of the exact operator-produced bytes and spend parameters before signing. */
export function preparedPlanIdentity(plan) {
  const transaction = plan.network === 'solana'
    ? {message:Buffer.from(plan.tx.message.serialize()).toString('base64'),signatures:plan.tx.signatures?.map(bytes=>Buffer.from(bytes).toString('base64'))}
    : {chainId:plan.chain.chainId,tx:plan.tx,nonce:plan.nonce,gasLimit:plan.gasLimit,gasPrice:plan.gasPrice,value:plan.value};
  return fingerprint({network:plan.network,action:plan.action,spend:plan.spend,transaction});
}
