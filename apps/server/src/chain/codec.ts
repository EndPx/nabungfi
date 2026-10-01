import { createHash } from 'node:crypto';
import { PublicKey, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { SOLANA_DEPLOYMENT as SOL, EVM_DEPLOYMENTS, assertGoalBinding, assertGoalId, assertEvmAddress, rawAmount, ChainValidationError, type GoalBinding, type ChainNetwork, type ParticipantBinding, type EvmNetwork } from '@nabungfi/shared/chain';
export const TOKEN = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const ASSOCIATED_TOKEN = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const publicBytes = (value: string) => new PublicKey(value).toBuffer();
export const addressWord = (address: string) => { assertEvmAddress(address); return address.slice(2).toLowerCase().padStart(64, '0'); };
export const word = (value: bigint | string | number) => {
    const n = BigInt(value);
    if (n < 0n || n >= 1n << 256n)
        throw new ChainValidationError('INTEGER_RANGE', 'Invalid ABI integer.');
    return n.toString(16).padStart(64, '0');
};
export const u64 = (value: string | bigint) => { const n = rawAmount(String(value), true), b = Buffer.alloc(8); b.writeBigUInt64LE(n); return b; };
export const u32 = (value: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(value); return b; };
export const discriminator = (name: string, kind = 'global') => createHash('sha256').update(`${kind}:${name}`).digest().subarray(0, 8);
export function solanaAddressWord(value: string): string { return publicBytes(value).toString('hex'); }
export function ownerAta(owner: string): string { return PublicKey.findProgramAddressSync([publicBytes(owner), TOKEN.toBuffer(), publicBytes(SOL.mint)], ASSOCIATED_TOKEN)[0].toBase58(); }
export function deriveGoalBinding(input: {
    goalId: string;
    targetRaw: string;
    owner: {
        solana: string;
        evm: string;
    };
    networks: ChainNetwork[];
}): GoalBinding {
    assertGoalId(input.goalId);
    rawAmount(input.targetRaw);
    assertEvmAddress(input.owner.evm);
    const owner = new PublicKey(input.owner.solana);
    if (!PublicKey.isOnCurve(owner.toBytes()))
        throw new ChainValidationError('OWNER_SIGNATURE_REQUIRED', 'Use a Solana wallet that can sign directly.');
    if (!input.networks.includes('solana') || new Set(input.networks).size !== input.networks.length)
        throw new ChainValidationError('INVALID_NETWORKS', 'Solana and distinct EVM networks are required.');
    const participants = input.networks.filter((n): n is EvmNetwork => n !== 'solana').map(network => {
        const d = EVM_DEPLOYMENTS[network];
        if (!d)
            throw new ChainValidationError('INVALID_NETWORK', 'Unsupported testnet.');
        return { network, domain: d.domain, eid: d.eid, router: d.router, factory: d.factory, asset: d.asset };
    }).sort((a, b) => a.domain - b.domain);
    const goal = PublicKey.findProgramAddressSync([Buffer.from('goal'), owner.toBuffer(), Buffer.from(input.goalId.slice(2), 'hex')], new PublicKey(SOL.core))[0];
    const cash = PublicKey.findProgramAddressSync([Buffer.from('usdc'), goal.toBuffer()], new PublicKey(SOL.core))[0];
    const binding: GoalBinding = { version: 2, profile: 'nabungfi-v2-devnet-four-chain', goalId: input.goalId.toLowerCase(), targetRaw: input.targetRaw, owner: { solana: owner.toBase58(), evm: input.owner.evm.toLowerCase() }, solanaGoal: goal.toBase58(), solanaCash: cash.toBase58(), participants };
    assertGoalBinding(binding);
    return binding;
}
export function validateBinding(binding: GoalBinding): void {
    assertGoalBinding(binding);
    const expected = deriveGoalBinding({ goalId: binding.goalId, targetRaw: binding.targetRaw, owner: binding.owner, networks: ['solana', ...binding.participants.map(p => p.network)] });
    if (binding.solanaGoal !== expected.solanaGoal || binding.solanaCash !== expected.solanaCash)
        throw new ChainValidationError('WRONG_COORDINATOR', 'Goal account does not match its owner and immutable ID.');
    for (const p of binding.participants)
        if (p.vault && p.configHash !== configurationHash(binding, p, p.vault))
            throw new ChainValidationError('WRONG_CONFIGURATION', 'Vault configuration hash does not match this goal.');
}
export function configurationHash(binding: GoalBinding, p: ParticipantBinding, vault: string): string {
    const preimage = Buffer.concat([Buffer.from('NABUNGFI_MULTICHAIN_CONFIG_V2'), publicBytes(SOL.core), publicBytes(binding.solanaGoal), publicBytes(binding.owner.solana), Buffer.from(binding.goalId.slice(2), 'hex'), u64(binding.targetRaw), u32(p.domain), u32(p.eid), publicBytes(SOL.mint), Buffer.from(addressWord(p.asset), 'hex'), Buffer.from(addressWord(p.router), 'hex'), Buffer.from(addressWord(vault), 'hex'), Buffer.from(addressWord(binding.owner.evm), 'hex'), publicBytes(SOL.transport)]);
    return '0x' + createHash('sha256').update(preimage).digest('hex');
}
export const ABI = { createGoal: '00f16bd1', deposit: 'b6b55f25', claim: '379607f5', approve: '095ea7b3', allowance: 'dd62ed3e', balanceOf: '70a08231', owner: '8da5cb5b', goalId: '04f70214', configHash: 'e1f1176d', sourceCoordinator: '64af3598', target: 'd4b83992', destinationDomain: '2858c55a', messenger: '3cb747bf', phase: 'b1c9fe6e', round: '8a19c8bc', commandSequence: 'd649f00c', reportSequence: 'ef0a8a2b', progressSequence: '73db9a6e', totalAssets: '01e1d114', receiptBalance: '30f637f0', preparedAssets: 'eac92fc9', principal: '861b3030', claimed: '7918a14d', claimable: '5d6a34a3', asset: '38d52e0f', isVault: '652b9b41', registered: '23435c51', routeSealed: '4eede86a', factory: 'c45a0155', solanaOApp: 'd25c3815', domain: 'c2fb26a6', eid: '416ecebf', vaultForCoordinator: 'fd317ea6' } as const;
export function createVaultCalldata(b: GoalBinding): string { return '0x' + ABI.createGoal + b.goalId.slice(2) + solanaAddressWord(b.owner.solana) + solanaAddressWord(b.solanaGoal) + word(b.targetRaw) + word(0); }
const meta = (address: string, writable = false, signer = false) => ({ pubkey: new PublicKey(address), isWritable: writable, isSigner: signer });
const coreInstruction = (name: string, keys: ReturnType<typeof meta>[], data: Buffer[]) => new TransactionInstruction({ programId: new PublicKey(SOL.core), keys, data: Buffer.concat([discriminator(name), ...data]) });
export function initializeInstruction(b: GoalBinding): TransactionInstruction {
    if (b.participants.some(p => !p.vault || !p.configHash))
        throw new ChainValidationError('MISSING_VAULTS', 'Create and verify every selected EVM vault first.');
    return coreInstruction('initialize', [meta(b.owner.solana, true, true), meta(b.solanaGoal, true), meta(SOL.mint), meta(b.solanaCash, true), meta(TOKEN.toBase58()), meta(SystemProgram.programId.toBase58())], [Buffer.from(b.goalId.slice(2), 'hex'), u64(b.targetRaw), u32(b.participants.length), ...b.participants.map(p => Buffer.concat([u32(p.domain), u32(p.eid), Buffer.from(addressWord(p.asset), 'hex'), Buffer.from(addressWord(p.router), 'hex'), Buffer.from(addressWord(p.vault!), 'hex'), Buffer.from(addressWord(b.owner.evm), 'hex')]))]);
}
export function financialInstruction(b: GoalBinding, action: 'deposit' | 'claim', amount: string): TransactionInstruction { return coreInstruction(action, [meta(b.owner.solana, false, true), meta(b.solanaGoal, true), meta(SOL.mint), ...(action === 'deposit' ? [meta(ownerAta(b.owner.solana), true), meta(b.solanaCash, true)] : [meta(b.solanaCash, true), meta(ownerAta(b.owner.solana), true)]), meta(TOKEN.toBase58())], [u64(amount)]); }
export function prepareInstruction(b: GoalBinding, abort = false): TransactionInstruction { return coreInstruction(abort ? 'begin_abort' : 'begin_prepare', [meta(b.owner.solana, false, true), meta(b.solanaGoal, true)], []); }
export function createAtaInstruction(owner: string): TransactionInstruction { return new TransactionInstruction({ programId: ASSOCIATED_TOKEN, keys: [meta(owner, true, true), meta(ownerAta(owner), true), meta(owner), meta(SOL.mint), meta(SystemProgram.programId.toBase58()), meta(TOKEN.toBase58())], data: Buffer.from([1]) }); }
export interface DecodedGoal {
    owner: string;
    goalId: string;
    target: bigint;
    principal: bigint;
    claimed: bigint;
    round: bigint;
    outboundSequence: bigint;
    localReserved: bigint;
    localReadySlot: bigint;
    achievedTotal: bigint;
    localReady: boolean;
    phase: number;
    bump: number;
    participants: {
        domain: number;
        eid: number;
        asset: string;
        router: string;
        vault: string;
        owner: string;
        configHash: string;
        linked: boolean;
        netAssets: bigint;
        progressSequence: bigint;
        observation: bigint;
        observedAt: bigint;
        receivedAt: bigint;
        inboundSequence: bigint;
        reserved: bigint;
        ready: boolean;
        abortAck: boolean;
    }[];
}
export function decodeGoal(data: Uint8Array): DecodedGoal {
    const b = Buffer.from(data);
    if (!b.subarray(0, 8).equals(discriminator('Goal', 'account')))
        throw new ChainValidationError('INVALID_GOAL_ACCOUNT', 'Unexpected Solana account discriminator.');
    let offset = 8;
    const take = (n: number) => {
        const v = b.subarray(offset, offset + n);
        if (v.length !== n)
            throw new ChainValidationError('INVALID_GOAL_ACCOUNT', 'Truncated Solana goal.');
        offset += n;
        return v;
    };
    const amount = () => take(8).readBigUInt64LE();
    const address = () => '0x' + take(32).toString('hex');
    const g = { owner: new PublicKey(take(32)).toBase58(), goalId: address(), target: amount(), principal: amount(), claimed: amount(), round: amount(), outboundSequence: amount(), localReserved: amount(), localReadySlot: amount(), achievedTotal: amount(), localReady: take(1)[0] === 1, phase: take(1)[0]!, bump: take(1)[0]!, participants: [] } as DecodedGoal;
    const count = take(4).readUInt32LE();
    if (count < 1 || count > 3 || g.phase > 3)
        throw new ChainValidationError('INVALID_GOAL_ACCOUNT', 'Invalid goal state.');
    for (let i = 0; i < count; i++)
        g.participants.push({ domain: take(4).readUInt32LE(), eid: take(4).readUInt32LE(), asset: address(), router: address(), vault: address(), owner: address(), configHash: address(), linked: take(1)[0] === 1, netAssets: amount(), progressSequence: amount(), observation: amount(), observedAt: amount(), receivedAt: amount(), inboundSequence: amount(), reserved: amount(), ready: take(1)[0] === 1, abortAck: take(1)[0] === 1 });
    if (b.subarray(offset).some(v => v !== 0))
        throw new ChainValidationError('INVALID_GOAL_ACCOUNT', 'Unexpected goal account data.');
    return g;
}
export function validateDecodedGoal(binding: GoalBinding, g: DecodedGoal): void {
    if (g.owner !== binding.owner.solana || g.goalId !== binding.goalId || g.target !== BigInt(binding.targetRaw) || g.participants.length !== binding.participants.length)
        throw new ChainValidationError('WRONG_GOAL', 'Onchain goal does not belong to this binding.');
    for (const p of binding.participants) {
        const actual = g.participants.find(a => a.domain === p.domain);
        if (!actual || actual.eid !== p.eid || actual.configHash !== p.configHash || actual.asset.slice(-40) !== p.asset.slice(2) || actual.router.slice(-40) !== p.router.slice(2) || actual.vault.slice(-40) !== p.vault?.slice(2) || actual.owner.slice(-40) !== binding.owner.evm.slice(2))
            throw new ChainValidationError('WRONG_PEER', 'Onchain participant binding differs.');
    }
}
