/** Public testnet identities and exact-unit DTOs. No wallet keys or signed transactions. */
export type ChainNetwork = 'solana' | 'base' | 'arbitrum' | 'ethereum';
export type EvmNetwork = Exclude<ChainNetwork, 'solana'>;
export type ChainAction = 'create-vault' | 'initialize' | 'approve' | 'deposit' | 'prepare' | 'abort' | 'claim';
export const SOLANA_DEPLOYMENT = Object.freeze({
    core: 'FWfjDER6zJbP227GymMqTwGveJ5fjw7nKJvwLEAbXsZn', transport: 'G2R7kB4yiYKB8Z6sF8f34w79Lof4L5oqqMhumiTzrG3d',
    store: 'v4GPUZ7BbKvpzyrtTBXYsASXcDKiC4TZppZaRSeudrp', mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    genesis: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG', eid: 40168,
});
export const EVM_DEPLOYMENTS = Object.freeze({
    base: { network: 'base', chainId: 84532, domain: 2, eid: 40245, router: '0xc3bf62a605f52a2ae238766a47b2f21623dfd1a1', factory: '0x3c981d151ec6060fd3f2307801d764fecb22c688', asset: '0x036cbd53842c5426634e7929541ec2318f3dcf7e', explorer: 'https://sepolia.basescan.org' },
    arbitrum: { network: 'arbitrum', chainId: 421614, domain: 3, eid: 40231, router: '0xd524e3d9e7f0b419a862b4ad854422d573b5d651', factory: '0x20a585751c48d4341c27cc0d91bd4ed6b621626f', asset: '0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d', explorer: 'https://sepolia.arbiscan.io' },
    ethereum: { network: 'ethereum', chainId: 11155111, domain: 4, eid: 40161, router: '0xd524e3d9e7f0b419a862b4ad854422d573b5d651', factory: '0x20a585751c48d4341c27cc0d91bd4ed6b621626f', asset: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238', explorer: 'https://sepolia.etherscan.io' },
} as const);
export interface ParticipantBinding {
    network: EvmNetwork;
    domain: 2 | 3 | 4;
    eid: number;
    asset: string;
    router: string;
    factory: string;
    vault?: string;
    configHash?: string;
    creationHash?: string;
}
export interface GoalBinding {
    version: 2;
    profile: 'nabungfi-v2-devnet-four-chain';
    goalId: string;
    targetRaw: string;
    owner: {
        solana: string;
        evm: string;
    };
    solanaGoal: string;
    solanaCash: string;
    participants: ParticipantBinding[];
    initialized?: boolean;
}
export interface ChainPlan {
    id: string;
    goalId: string;
    action: ChainAction;
    network: ChainNetwork;
    owner: string;
    /** Sealed by the server from an authoritative Privy embedded-wallet identity. Absent on legacy direct plans. */
    gasPayment?: 'privy-testnet';
    amountRaw?: string;
    fingerprint: string;
    createdAt: string;
    expiresAt: string;
    transaction: {
        kind: 'evm';
        chainId: number;
        to: string;
        data: string;
        value: string;
    } | {
        kind: 'solana';
        chainId: 'solana-devnet';
        base64: string;
        blockhash: string;
        lastValidBlockHeight: number;
    };
}
export interface GoalPositionState {
    network: ChainNetwork;
    domain: 1 | 2 | 3 | 4;
    phase: 'uninitialized' | 'locked' | 'preparing' | 'ready' | 'aborting' | 'achieved';
    initialized: boolean;
    registered: boolean;
    linked: boolean;
    assetsRaw: string;
    principalRaw: string;
    claimedRaw: string;
    claimableRaw: string;
    walletUsdcRaw: string;
    nativeBalanceRaw: string;
    strategyReceiptRaw: string;
    round: string;
    commandSequence: string;
    reportSequence: string;
    progressSequence: string;
    ready: boolean;
    reservedRaw: string;
    observation: string;
}
export interface GoalChainState {
    goalId: string;
    observedAt: string;
    phase: 'unprovisioned' | 'saving' | 'preparing' | 'aborting' | 'achieved' | 'claimed';
    targetRaw: string;
    totalAssetsRaw: string;
    totalClaimedRaw: string;
    achievedTotalRaw: string;
    linked: boolean;
    claimable: boolean;
    canPrepare: boolean;
    positions: GoalPositionState[];
    solana: {
        slot: number;
        phase: number | null;
        round: string;
        outboundSequence: string;
        localReady: boolean;
        localReadySlot: string;
        localReservedRaw: string;
        participants: {
            domain: number;
            configHash: string;
            linked: boolean;
            netAssetsRaw: string;
            progressSequence: string;
            receivedAt: string;
            inboundSequence: string;
            ready: boolean;
            reservedRaw: string;
        }[];
    };
}
export interface GoalStepInput {
    id: string;
    action: ChainAction;
    network: ChainNetwork;
    amountRaw?: string;
    gasPayment?: 'privy-testnet';
}
export interface ReconcileResult {
    status: 'confirmed' | 'pending' | 'failed' | 'attention';
    transactionHash: string;
    reasonCode?: string;
    receipt?: {
        network: ChainNetwork;
        block: string;
        transactionHash: string;
        observedAt: string;
        userOperationHash?: string;
    };
    bindingPatch?: {
        network: EvmNetwork;
        vault: string;
        configHash: string;
        creationHash: string;
    } | {
        initialized: true;
    };
}
export class ChainValidationError extends Error {
    constructor(readonly code: string, message: string) { super(message); this.name = 'ChainValidationError'; }
}
export function rawAmount(value: unknown, allowZero = false): bigint {
    if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,19})$/.test(value))
        throw new ChainValidationError('INVALID_RAW_AMOUNT', 'Use an exact integer amount in USDC base units.');
    const n = BigInt(value);
    if (n > 0xffffffffffffffffn || (!allowZero && n === 0n))
        throw new ChainValidationError('INVALID_RAW_AMOUNT', 'Amount is outside the supported exact-unit range.');
    return n;
}
export function assertEvmAddress(value: unknown): asserts value is string {
    if (typeof value !== 'string' || !/^0x[0-9a-f]{40}$/i.test(value) || BigInt(value) === 0n)
        throw new ChainValidationError('INVALID_ADDRESS', 'Invalid EVM address.');
}
export function assertGoalId(value: unknown): asserts value is string {
    if (typeof value !== 'string' || !/^0x[0-9a-f]{64}$/i.test(value) || BigInt(value) === 0n)
        throw new ChainValidationError('INVALID_GOAL_ID', 'Invalid goal ID.');
}
export function assertGoalBinding(b: GoalBinding): void {
    if (b.version !== 2 || b.profile !== 'nabungfi-v2-devnet-four-chain')
        throw new ChainValidationError('UNSUPPORTED_PROFILE', 'Use the deployed testnet profile.');
    assertGoalId(b.goalId);
    rawAmount(b.targetRaw);
    assertEvmAddress(b.owner.evm);
    if (b.participants.length < 1 || b.participants.length > 3)
        throw new ChainValidationError('PARTICIPANT_COUNT', 'Choose Solana and one to three supported EVM chains.');
    let domain = 1;
    for (const p of b.participants) {
        const d = EVM_DEPLOYMENTS[p.network];
        if (!d || p.domain <= domain || p.domain !== d.domain || p.eid !== d.eid || p.asset.toLowerCase() !== d.asset || p.router.toLowerCase() !== d.router || p.factory.toLowerCase() !== d.factory)
            throw new ChainValidationError('WRONG_DEPLOYMENT', 'Participant does not match the canonical deployment.');
        domain = p.domain;
        if (p.vault) {
            assertEvmAddress(p.vault);
            assertGoalId(p.configHash);
        }
        else if (p.configHash)
            throw new ChainValidationError('INCOMPLETE_BINDING', 'A configuration hash requires an actual vault.');
    }
}
export function goalProgressBasisPoints(state: GoalChainState): number { const target = rawAmount(state.targetRaw); const amount = state.phase === 'achieved' || state.phase === 'claimed' ? rawAmount(state.achievedTotalRaw, true) : rawAmount(state.totalAssetsRaw, true); return Number((amount * 10000n / target) > 10000n ? 10000n : amount * 10000n / target); }
/** A timeout or expired observation never proves failure of the original submitted transaction. */
export function reconcileObservation(receipt: 'success' | 'failed' | 'missing', expired: boolean): 'confirmed' | 'failed' | 'pending' | 'attention' { return receipt === 'success' ? 'confirmed' : receipt === 'failed' ? 'failed' : expired ? 'attention' : 'pending'; }
