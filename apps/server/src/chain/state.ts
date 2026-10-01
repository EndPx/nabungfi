import { PublicKey } from '@solana/web3.js';
import { SOLANA_DEPLOYMENT as SOL, EVM_DEPLOYMENTS, ChainValidationError, type GoalBinding, type GoalChainState, type GoalPositionState, type ParticipantBinding } from '@nabungfi/shared/chain';
import { ABI, addressWord, solanaAddressWord, decodeGoal, validateDecodedGoal, configurationHash, validateBinding, ownerAta, TOKEN, type DecodedGoal } from './codec.js';
import type { RpcTransport } from './rpc.js';
const evmPhase = (phase: number): GoalPositionState['phase'] => {
    const p = (['locked', 'preparing', 'ready', 'achieved'] as const)[phase];
    if (!p)
        throw new ChainValidationError('INVALID_STATE', 'Unknown EVM phase.');
    return p;
};
const solPhase = (phase: number): GoalPositionState['phase'] => {
    const p = (['locked', 'preparing', 'aborting', 'achieved'] as const)[phase];
    if (!p)
        throw new ChainValidationError('INVALID_STATE', 'Unknown Solana phase.');
    return p;
};
const quantity = (value: string) => {
    if (!/^0x[0-9a-f]+$/i.test(value))
        throw new ChainValidationError('INVALID_STATE', 'Invalid chain integer.');
    return BigInt(value).toString();
};
export function tokenBalance(account: {
    owner: PublicKey;
    data: Buffer;
} | null, authority: string, required = false): string {
    if (!account) {
        if (required)
            throw new ChainValidationError('MISSING_TOKEN_ACCOUNT', 'Expected token account is absent.');
        return '0';
    }
    if (!account.owner.equals(TOKEN) || account.data.length < 165 || new PublicKey(account.data.subarray(0, 32)).toBase58() !== SOL.mint || new PublicKey(account.data.subarray(32, 64)).toBase58() !== authority)
        throw new ChainValidationError('WRONG_TOKEN_ACCOUNT', 'USDC mint or token authority differs.');
    return account.data.readBigUInt64LE(64).toString();
}
export async function validateEvmVault(rpc: RpcTransport, b: GoalBinding, p: ParticipantBinding, block: string): Promise<Record<string, string>> {
    if (!p.vault)
        throw new ChainValidationError('MISSING_VAULT', 'Create this vault first.');
    const requests: {
        key: string;
        to: string;
        data: string;
    }[] = [{ key: 'isVault', to: p.router, data: '0x' + ABI.isVault + addressWord(p.vault) }, { key: 'registered', to: p.router, data: '0x' + ABI.registered + addressWord(p.vault) }, ...(['owner', 'asset', 'goalId', 'configHash', 'sourceCoordinator', 'target', 'destinationDomain', 'messenger', 'phase', 'round', 'commandSequence', 'reportSequence', 'progressSequence', 'totalAssets', 'receiptBalance', 'preparedAssets', 'principal', 'claimed', 'claimable'] as const).map(key => ({ key, to: p.vault!, data: '0x' + ABI[key] }))];
    const values = await rpc.batch(p.network, requests, block), fields = Object.fromEntries(requests.map((request, i) => [request.key, values[i]!])) as Record<string, string>;
    const expectedHash = configurationHash(b, p, p.vault);
    if (BigInt(fields.isVault!) !== 1n || fields.owner!.slice(-40).toLowerCase() !== b.owner.evm.slice(2).toLowerCase() || fields.asset!.slice(-40).toLowerCase() !== p.asset.slice(2).toLowerCase() || fields.goalId !== b.goalId || fields.configHash !== expectedHash || fields.sourceCoordinator !== '0x' + solanaAddressWord(b.solanaGoal) || BigInt(fields.target!) !== BigInt(b.targetRaw) || BigInt(fields.destinationDomain!) !== BigInt(p.domain) || fields.messenger!.slice(-40).toLowerCase() !== p.router.slice(2).toLowerCase())
        throw new ChainValidationError('WRONG_VAULT', 'Vault provenance or immutable goal identity differs.');
    return fields;
}
export async function validateRoute(rpc: RpcTransport, p: ParticipantBinding, block: string): Promise<void> {
    if (BigInt(await rpc.call<string>(p.network, 'eth_chainId', [])) !== BigInt(EVM_DEPLOYMENTS[p.network].chainId))
        throw new ChainValidationError('WRONG_CHAIN', 'Expected the configured testnet.');
    const keys = ['routeSealed', 'factory', 'solanaOApp', 'domain', 'eid'] as const;
    const values = await rpc.batch(p.network, keys.map(key => ({ to: p.router, data: '0x' + ABI[key] })), block);
    const v = Object.fromEntries(keys.map((key, i) => [key, values[i]!])) as Record<string, string>;
    if (BigInt(v.routeSealed!) !== 1n || v.factory!.slice(-40).toLowerCase() !== p.factory.slice(2) || v.solanaOApp !== '0x' + solanaAddressWord(SOL.store) || BigInt(v.domain!) !== BigInt(p.domain) || BigInt(v.eid!) !== BigInt(p.eid))
        throw new ChainValidationError('WRONG_ROUTE', 'The deployed execution route does not match.');
}
export function combineState(b: GoalBinding, positions: GoalPositionState[], g: DecodedGoal | null, slot: number, observedAt = new Date().toISOString()): GoalChainState {
    const totalAssets = positions.reduce((sum, p) => sum + BigInt(p.assetsRaw), 0n), claimed = positions.reduce((sum, p) => sum + BigInt(p.claimedRaw), 0n);
    const linked = !!g && g.participants.every(p => p.linked) && positions.every(p => p.initialized && p.registered && p.linked);
    const allAchieved = !!g && g.phase === 3 && positions.every(p => p.phase === 'achieved');
    const phase: GoalChainState['phase'] = !g ? 'unprovisioned' : g.phase === 3 ? (allAchieved && totalAssets === 0n ? 'claimed' : 'achieved') : g.phase === 2 ? 'aborting' : g.phase === 1 ? 'preparing' : 'saving';
    const now = Date.parse(observedAt), fresh = !!g && g.participants.every(p => p.progressSequence > 0n && p.receivedAt > 0n && now - Number(p.receivedAt) * 1000 <= 600000 && Number(p.receivedAt) * 1000 <= now + 5000);
    // Preparation relies on authenticated coordinator reports, not a portfolio/global sum.
    const reported = !!g ? BigInt(positions.find(p => p.network === 'solana')?.assetsRaw ?? '0') + g.participants.reduce((sum, p) => sum + p.netAssets, 0n) : 0n;
    const reportsMatch = !!g && positions.filter(p => p.network !== 'solana').every(p => g.participants.find(x => x.domain === p.domain)?.netAssets === BigInt(p.assetsRaw));
    return { goalId: b.goalId, observedAt, phase, targetRaw: b.targetRaw, totalAssetsRaw: totalAssets.toString(), totalClaimedRaw: claimed.toString(), achievedTotalRaw: g?.achievedTotal.toString() ?? '0', linked, claimable: allAchieved && positions.some(p => BigInt(p.claimableRaw) > 0n), canPrepare: !!g && g.phase === 0 && linked && fresh && reportsMatch && reported >= BigInt(b.targetRaw) && positions.every(p => BigInt(p.strategyReceiptRaw) === 0n), positions, solana: { slot, phase: g?.phase ?? null, round: g?.round.toString() ?? '0', outboundSequence: g?.outboundSequence.toString() ?? '0', localReady: g?.localReady ?? false, localReadySlot: g?.localReadySlot.toString() ?? '0', localReservedRaw: g?.localReserved.toString() ?? '0', participants: g?.participants.map(p => ({ domain: p.domain, configHash: p.configHash, linked: p.linked, netAssetsRaw: p.netAssets.toString(), progressSequence: p.progressSequence.toString(), receivedAt: p.receivedAt.toString(), inboundSequence: p.inboundSequence.toString(), ready: p.ready, reservedRaw: p.reserved.toString() })) ?? [] } };
}
export async function snapshot(rpc: RpcTransport, b: GoalBinding): Promise<GoalChainState> {
    validateBinding(b);
    if (await rpc.solana.getGenesisHash() !== SOL.genesis)
        throw new ChainValidationError('WRONG_CHAIN', 'Expected Solana Devnet.');
    const result = await rpc.solana.getMultipleAccountsInfoAndContext([b.solanaGoal, b.solanaCash, ownerAta(b.owner.solana)].map(address => new PublicKey(address)), { commitment: 'confirmed' }), [goalAccount, cash, ata] = result.value;
    let g: DecodedGoal | null = null;
    if (goalAccount) {
        if (goalAccount.owner.toBase58() !== SOL.core)
            throw new ChainValidationError('WRONG_GOAL_PROGRAM', 'Goal belongs to another program.');
        g = decodeGoal(goalAccount.data);
        validateDecodedGoal(b, g);
    }
    const wallet = tokenBalance(ata ?? null, b.owner.solana), assets = tokenBalance(cash ?? null, b.solanaGoal, !!g), positions: GoalPositionState[] = [{ network: 'solana', domain: 1, phase: g ? solPhase(g.phase) : 'uninitialized', initialized: !!g, registered: !!g && g.participants.every(p => p.linked), linked: !!g && g.participants.every(p => p.linked), assetsRaw: assets, principalRaw: g?.principal.toString() ?? '0', claimedRaw: g?.claimed.toString() ?? '0', claimableRaw: g?.phase === 3 ? assets : '0', walletUsdcRaw: wallet, nativeBalanceRaw: (await rpc.solana.getBalance(new PublicKey(b.owner.solana), 'confirmed')).toString(), strategyReceiptRaw: '0', round: g?.round.toString() ?? '0', commandSequence: g?.outboundSequence.toString() ?? '0', reportSequence: '0', progressSequence: '0', ready: g?.localReady ?? false, reservedRaw: g?.localReserved.toString() ?? '0', observation: result.context.slot.toString() }];
    for (const p of b.participants) {
        const block = await rpc.call<string>(p.network, 'eth_blockNumber', []);
        await validateRoute(rpc, p, block);
        const walletRaw = quantity((await rpc.batch(p.network, [{ to: p.asset, data: '0x' + ABI.balanceOf + addressWord(b.owner.evm) }], block))[0]!), native = quantity(await rpc.call<string>(p.network, 'eth_getBalance', [b.owner.evm, block]));
        let f: Record<string, string> | null = null;
        if (p.vault)
            f = await validateEvmVault(rpc, b, p, block);
        const corePeer = g?.participants.find(a => a.domain === p.domain), registered = !!f && BigInt(f.registered!) === 1n;
        positions.push({ network: p.network, domain: p.domain, phase: f ? evmPhase(Number(BigInt(f.phase!))) : 'uninitialized', initialized: !!f, registered, linked: !!corePeer?.linked && registered, assetsRaw: f ? quantity(f.totalAssets!) : '0', principalRaw: f ? quantity(f.principal!) : '0', claimedRaw: f ? quantity(f.claimed!) : '0', claimableRaw: f ? quantity(f.claimable!) : '0', walletUsdcRaw: walletRaw, nativeBalanceRaw: native, strategyReceiptRaw: f ? quantity(f.receiptBalance!) : '0', round: f ? quantity(f.round!) : '0', commandSequence: f ? quantity(f.commandSequence!) : '0', reportSequence: f ? quantity(f.reportSequence!) : '0', progressSequence: f ? quantity(f.progressSequence!) : '0', ready: corePeer?.ready ?? false, reservedRaw: corePeer?.reserved.toString() ?? '0', observation: BigInt(block).toString() });
    }
    return combineState(b, positions, g, result.context.slot);
}
