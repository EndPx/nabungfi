import type { ChainNetwork, GoalBinding, ChainPlan } from '@nabungfi/shared/chain';
import type { VerifiedIdentity } from './auth.js';
import { ApiError } from './errors.js';

/** No request body can select sponsorship. Only the authoritative linked embedded owner is eligible. */
export function testnetGasPayment(enabled: boolean | undefined, identity: VerifiedIdentity, binding: GoalBinding, network: ChainNetwork): 'privy-testnet' | undefined {
  if (!enabled || !['solana', 'base', 'arbitrum', 'ethereum'].includes(network)) return undefined;
  const chainType = network === 'solana' ? 'solana' : 'ethereum';
  const owner = network === 'solana' ? binding.owner.solana : binding.owner.evm.toLowerCase();
  return identity.wallets.some(wallet => wallet.chainType === chainType && wallet.address === owner && wallet.walletClientType === 'privy' && wallet.walletId)
    ? 'privy-testnet' : undefined;
}
export function assertGasEligibility(enabled: boolean | undefined, identity: VerifiedIdentity, binding: GoalBinding, plan: ChainPlan): void {
  if (plan.gasPayment && testnetGasPayment(enabled, identity, binding, plan.network) !== plan.gasPayment)
    throw new ApiError('SPONSORSHIP_UNAVAILABLE', 409, 'This original plan needs its linked Privy wallet and testnet sponsorship. No wallet was opened.');
}
