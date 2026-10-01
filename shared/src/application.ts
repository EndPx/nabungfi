/** Authenticated application metadata/DTOs. Financial authority comes only from verified chain state. */
import type { GoalBinding, GoalChainState, ChainPlan } from './chain.js';

export const APP_NETWORKS = ['solana', 'base', 'arbitrum', 'ethereum'] as const;
export type AppNetwork = typeof APP_NETWORKS[number];
export type GoalModel = 'car' | 'laptop' | 'house' | 'custom';
export type GoalStepAction = 'create-vault' | 'initialize' | 'approve' | 'deposit' | 'prepare' | 'abort' | 'claim';
export interface VerifiedWallet { chainType: 'ethereum' | 'solana'; address: string; walletId?: string }
export interface SessionDTO { user: { id: string; privySubject: string; wallets: VerifiedWallet[] }; profile: 'testnet'; privyAppId: string; chains: AppNetwork[] }
export interface CreateGoalRequest { name: string; targetAmount: string; model: GoalModel; solanaOwner: string; evmOwner: string; chains: AppNetwork[] }
export interface GoalDTO {
  id: string; goalId: string; name: string; model: GoalModel; targetRaw: string;
  createdAt: string; updatedAt: string; binding: GoalBinding;
  chainState: GoalChainState | null; chainStatus: 'available' | 'unavailable' | 'unprovisioned';
}
export interface GoalStepRequest { requestId: string; action: GoalStepAction; network: AppNetwork; amountRaw?: string }
export type GoalStepStatus = 'planning' | 'planned' | 'signing' | 'submitted' | 'pending' | 'confirmed' | 'failed' | 'attention' | 'rejected';
export interface GoalStepDTO {
  id: string; goalId: string; metadataGoalId: string; action: GoalStepAction; network: AppNetwork;
  amountRaw?: string; status: GoalStepStatus; plan: ChainPlan | null; transactionHash: string | null;
  createdAt: string; updatedAt: string; reasonCode?: string;
}
export interface GoalHistoryEntry {
  id: string; goalId: string; action: GoalStepAction; network: AppNetwork; amountRaw?: string;
  status: GoalStepStatus; transactionHash: string | null; createdAt: string; updatedAt: string;
}
export interface ApiFailure { code: string; error: string; requestId?: string }

export function parseGoalTarget(value: unknown): string {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/.test(value)) throw new Error('INVALID_TARGET');
  const [whole='0', fraction=''] = value.split('.');
  const raw=BigInt(whole)*1_000_000n+BigInt(fraction.padEnd(6,'0'));
  if(raw===0n||raw>18_446_744_073_709_551_615n)throw new Error('INVALID_TARGET');
  return raw.toString();
}
