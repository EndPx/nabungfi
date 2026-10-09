import type { GoalBinding, GoalStepInput, ChainPlan, GoalChainState, ReconcileResult } from '@nabungfi/shared/chain';
import { ReadOnlyRpc, type RpcTransport } from './rpc.js';
import { deriveGoalBinding } from './codec.js';
import { buildPlan, assertUsablePlan } from './planner.js';
import { snapshot } from './state.js';
import { reconcile } from './receipt.js';
import {resolveExpiredSolana,type ExpiredSolanaResolution} from './expired-solana.js';
import { readWalletBalances as walletBalances } from './wallet-balances.js';
import type { VerifiedWallet, WalletBalanceDTO } from '@nabungfi/shared/application';
export { deriveGoalBinding } from './codec.js';
export type { RpcTransport } from './rpc.js';
export interface ChainService {
    readWalletBalances(wallets: readonly VerifiedWallet[]): Promise<WalletBalanceDTO[]>;
    assertPlanUsable(binding: GoalBinding, plan: ChainPlan): Promise<void>;
    planGoalStep(binding: GoalBinding, input: GoalStepInput): Promise<ChainPlan>;
    readGoalState(binding: GoalBinding): Promise<GoalChainState>;
    reconcileGoalStep(binding: GoalBinding, plan: ChainPlan, hash: string): Promise<ReconcileResult>;
    resolveExpiredSolana(binding:GoalBinding,plan:ChainPlan):Promise<ExpiredSolanaResolution>;
}
export function createChainService(rpc: RpcTransport = new ReadOnlyRpc()): ChainService { return { readWalletBalances: wallets => walletBalances(rpc,wallets), resolveExpiredSolana:(b,plan)=>resolveExpiredSolana(rpc,b,plan),assertPlanUsable: (b, plan) => assertUsablePlan(rpc, b, plan), planGoalStep: (b, input) => buildPlan(rpc, b, input), readGoalState: b => snapshot(rpc, b), reconcileGoalStep: (b, plan, hash) => reconcile(rpc, b, plan, hash) }; }
let service: ChainService | undefined;
const current = () => service ??= createChainService();
export const readWalletBalances: ChainService['readWalletBalances'] = wallets => current().readWalletBalances(wallets);
export const planGoalStep: ChainService['planGoalStep'] = (b, input) => current().planGoalStep(b, input);
export const readGoalState: ChainService['readGoalState'] = b => current().readGoalState(b);
export const reconcileGoalStep: ChainService['reconcileGoalStep'] = (b, plan, hash) => current().reconcileGoalStep(b, plan, hash);
export const assertPlanUsable: ChainService['assertPlanUsable'] = (b, plan) => current().assertPlanUsable(b, plan);
export const resolveExpiredSolanaPlan:ChainService['resolveExpiredSolana']=(b,plan)=>current().resolveExpiredSolana(b,plan);
