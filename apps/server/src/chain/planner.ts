import { createHash } from 'node:crypto';
import { PublicKey, TransactionMessage, VersionedTransaction, type TransactionInstruction } from '@solana/web3.js';
import { EVM_DEPLOYMENTS, SOLANA_DEPLOYMENT, ChainValidationError, rawAmount, type GoalBinding, type ChainPlan, type GoalStepInput, type GoalChainState } from '@nabungfi/shared/chain';
import { ABI, addressWord, word, createVaultCalldata, initializeInstruction, financialInstruction, prepareInstruction, createAtaInstruction, ownerAta, validateBinding } from './codec.js';
import { snapshot, validateRoute } from './state.js';
import type { RpcTransport } from './rpc.js';
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)])) : value;
export function planFingerprint(plan: Omit<ChainPlan, 'fingerprint'>): string { return '0x' + createHash('sha256').update(JSON.stringify(canonical(plan))).digest('hex'); }
export function assertPlan(binding: GoalBinding, plan: ChainPlan): void {
    if (plan.gasPayment !== undefined && plan.gasPayment !== 'privy-testnet')
        throw new ChainValidationError('PLAN_SUBSTITUTION', 'Unsupported gas payment mode.');
    const { fingerprint, ...unsigned } = plan;
    if (fingerprint !== planFingerprint(unsigned) || plan.goalId !== binding.goalId || plan.owner !== (plan.network === 'solana' ? binding.owner.solana : binding.owner.evm))
        throw new ChainValidationError('PLAN_SUBSTITUTION', 'Transaction plan does not match the stored owner and goal.');
    if (plan.network !== 'solana' && !binding.participants.some(p => p.network === plan.network))
        throw new ChainValidationError('PLAN_SUBSTITUTION', 'Transaction targets an unselected network.');
    if (plan.transaction.kind === 'evm' && (plan.network === 'solana' || plan.transaction.chainId !== EVM_DEPLOYMENTS[plan.network].chainId))
        throw new ChainValidationError('PLAN_SUBSTITUTION', 'Transaction targets the wrong chain.');
    if (plan.transaction.kind === 'solana' && plan.network !== 'solana')
        throw new ChainValidationError('PLAN_SUBSTITUTION', 'Solana transaction has a wrong network.');
    if (plan.transaction.kind === 'evm') {
        const p = binding.participants.find(p => p.network === plan.network)!;
        let to: string, data: string;
        if (plan.action === 'create-vault') {
            to = p.router;
            data = createVaultCalldata(binding);
        }
        else if (['approve', 'deposit', 'claim'].includes(plan.action) && p.vault) {
            const amount = rawAmount(plan.amountRaw);
            to = plan.action === 'approve' ? p.asset : p.vault;
            data = plan.action === 'approve' ? '0x' + ABI.approve + addressWord(p.vault) + word(amount) : '0x' + ABI[plan.action === 'deposit' ? 'deposit' : 'claim'] + word(amount);
        }
        else
            throw new ChainValidationError('PLAN_SUBSTITUTION', 'Action is not valid on this network.');
        if (plan.transaction.to.toLowerCase() !== to.toLowerCase() || plan.transaction.data.toLowerCase() !== data || plan.transaction.value !== '0')
            throw new ChainValidationError('PLAN_SUBSTITUTION', 'Calldata is not the canonical owner action for this goal.');
    }
    else {
        if (plan.transaction.chainId !== 'solana-devnet')
            throw new ChainValidationError('PLAN_SUBSTITUTION', 'Expected Solana Devnet.');
        const tx = VersionedTransaction.deserialize(Buffer.from(plan.transaction.base64, 'base64'));
        if (tx.signatures.some(sig => sig.some(byte => byte !== 0)))
            throw new ChainValidationError('PLAN_SUBSTITUTION', 'Stored plans must be unsigned.');
        let instructions: TransactionInstruction[];
        if (plan.action === 'initialize')
            instructions = [initializeInstruction(binding)];
        else if (plan.action === 'prepare' || plan.action === 'abort')
            instructions = [prepareInstruction(binding, plan.action === 'abort')];
        else if (plan.action === 'deposit' || plan.action === 'claim') {
            instructions = [financialInstruction(binding, plan.action, rawAmount(plan.amountRaw).toString())];
            if (plan.action === 'claim' && tx.message.compiledInstructions.length === 2)
                instructions.unshift(createAtaInstruction(binding.owner.solana));
        }
        else
            throw new ChainValidationError('PLAN_SUBSTITUTION', 'Action is not valid on Solana.');
        const expected = new TransactionMessage({ payerKey: new PublicKey(binding.owner.solana), recentBlockhash: plan.transaction.blockhash, instructions }).compileToV0Message();
        if (!Buffer.from(expected.serialize()).equals(Buffer.from(tx.message.serialize())))
            throw new ChainValidationError('PLAN_SUBSTITUTION', 'Solana accounts, signer, program or instruction do not match the canonical goal action.');
    }
}
export async function assertEvmGasFunds(rpc: RpcTransport, network: GoalBinding['participants'][number]['network'], owner: string, tx: {
    to: string;
    data: string;
    value: string;
}): Promise<void> {
    const gas = BigInt(await rpc.call<string>(network, 'eth_estimateGas', [{ from: owner, ...tx }])), price = BigInt(await rpc.call<string>(network, 'eth_gasPrice', [])), balance = BigInt(await rpc.call<string>(network, 'eth_getBalance', [owner, 'latest']));
    if (gas <= 0n || price <= 0n)
        throw new ChainValidationError('CHAIN_GAS_UNAVAILABLE', 'Cannot verify current transaction gas.');
    const required = ((gas * 120n + 99n) / 100n) * price + BigInt(tx.value);
    if (balance < required)
        throw new ChainValidationError('INSUFFICIENT_GAS', 'Fund enough testnet gas for the estimated owner transaction before opening the wallet.');
}
export async function assertUsablePlan(rpc: RpcTransport, binding: GoalBinding, plan: ChainPlan): Promise<void> {
    validateBinding(binding);
    assertPlan(binding, plan);
    if (!Number.isFinite(Date.parse(plan.expiresAt)) || Date.now() > Date.parse(plan.expiresAt))
        throw new ChainValidationError('PLAN_EXPIRED', 'Refresh this unsigned plan before opening the wallet.');
    if (plan.transaction.kind === 'solana') {
        if (await rpc.solana.getGenesisHash() !== SOLANA_DEPLOYMENT.genesis)
            throw new ChainValidationError('WRONG_CHAIN', 'Expected Solana Devnet.');
        const height = await rpc.solana.getBlockHeight('confirmed');
        if (height > plan.transaction.lastValidBlockHeight)
            throw new ChainValidationError('PLAN_EXPIRED', 'Solana blockhash expired before signing; refresh the unsigned plan.');
        const validity = await rpc.solana.isBlockhashValid(plan.transaction.blockhash, { commitment: 'confirmed' });
        if (!validity.value)
            throw new ChainValidationError('PLAN_EXPIRED', 'The original blockhash is no longer valid.');
        const unsigned = VersionedTransaction.deserialize(Buffer.from(plan.transaction.base64, 'base64'));
        const simulation = await rpc.solana.simulateTransaction(unsigned, { sigVerify: false, commitment: 'confirmed' });
        if (simulation.value.err && !(plan.gasPayment === 'privy-testnet' && sponsoredFeeSimulationError(simulation.value.err)))
            throw new ChainValidationError('SIMULATION_FAILED', 'Goal state or wallet gas changed before signing; refresh the unsigned plan.');
    }
    else {
        const network = plan.network as Exclude<GoalBinding['participants'][number]['network'], 'solana'>;
        if (BigInt(await rpc.call<string>(network, 'eth_chainId', [])) !== BigInt(plan.transaction.chainId))
            throw new ChainValidationError('WRONG_CHAIN', 'Wallet action is bound to another testnet.');
        const p = binding.participants.find(p => p.network === network)!;
        await validateRoute(rpc, p, 'latest');
        await rpc.call(network, 'eth_call', [{ from: plan.owner, to: plan.transaction.to, data: plan.transaction.data, value: '0x0' }, 'latest']);
        if (!plan.gasPayment) await assertEvmGasFunds(rpc, network, plan.owner, { to: plan.transaction.to, data: plan.transaction.data, value: '0x0' });
    }
}
export function assertActionState(state: GoalChainState, input: GoalStepInput): void {
    const position = state.positions.find(p => p.network === input.network);
    if (!position)
        throw new ChainValidationError('INVALID_NETWORK', 'Choose one of this goal’s networks.');
    if (input.action === 'deposit' || input.action === 'approve') {
        const amount = rawAmount(input.amountRaw);
        if (!state.linked || position.phase !== 'locked')
            throw new ChainValidationError('NOT_LINKED_OR_LOCKED', 'Wait for every vault to be registered before depositing.');
        if (BigInt(position.walletUsdcRaw) < amount)
            throw new ChainValidationError('INSUFFICIENT_USDC', 'Add testnet USDC to this wallet.');
    }
    if (input.action === 'claim') {
        const amount = rawAmount(input.amountRaw);
        if (!state.claimable || position.phase !== 'achieved')
            throw new ChainValidationError('STILL_LOCKED', 'Wait until every vault has committed achievement.');
        if (BigInt(position.claimableRaw) < amount)
            throw new ChainValidationError('INVALID_CLAIM_AMOUNT', 'Claim only this vault’s available USDC.');
    }
    if (input.action === 'prepare' && !state.canPrepare)
        throw new ChainValidationError('NOT_READY_TO_PREPARE', 'Wait for fresh authenticated reports and the savings target.');
    if (input.action === 'abort' && state.phase !== 'preparing')
        throw new ChainValidationError('WRONG_PHASE', 'Only a preparation round can be aborted.');
}
export async function buildPlan(rpc: RpcTransport, b: GoalBinding, input: GoalStepInput): Promise<ChainPlan> {
    validateBinding(b);
    if (input.gasPayment !== undefined && input.gasPayment !== 'privy-testnet') throw new ChainValidationError('PLAN_SUBSTITUTION', 'Unsupported gas payment mode.');
    if (!input.id || !['create-vault', 'initialize', 'approve', 'deposit', 'prepare', 'abort', 'claim'].includes(input.action))
        throw new ChainValidationError('INVALID_ACTION', 'Unsupported wallet action.');
    const createdAt = new Date().toISOString(), expiresAt = new Date(Date.now() + 300000).toISOString(), owner = input.network === 'solana' ? b.owner.solana : b.owner.evm;
    const base: Omit<ChainPlan, 'fingerprint' | 'transaction'> = { id: input.id, goalId: b.goalId, action: input.action, network: input.network, owner, createdAt, expiresAt, ...(input.gasPayment ? { gasPayment: input.gasPayment } : {}), ...(input.amountRaw !== undefined ? { amountRaw: rawAmount(input.amountRaw).toString() } : {}) };
    if (input.network !== 'solana') {
        const p = b.participants.find(p => p.network === input.network);
        if (!p)
            throw new ChainValidationError('INVALID_NETWORK', 'Network is not selected for this goal.');
        const network = p.network, block = await rpc.call<string>(network, 'eth_blockNumber', []);
        await validateRoute(rpc, p, block);
        let to: string, data: string;
        if (input.action === 'create-vault') {
            if (p.vault)
                throw new ChainValidationError('ALREADY_PROVISIONED', 'Reconcile the original creation instead of creating another vault.');
            const existing = (await rpc.batch(network, [{ to: p.router, data: '0x' + ABI.vaultForCoordinator + new PublicKey(b.solanaGoal).toBuffer().toString('hex') }], block))[0]!;
            if (BigInt(existing) !== 0n)
                throw new ChainValidationError('CREATION_OUTCOME_UNKNOWN', 'This goal already has a vault; reconcile its original creation hash.');
            to = p.router;
            data = createVaultCalldata(b);
        }
        else {
            if (!['approve', 'deposit', 'claim'].includes(input.action) || !p.vault)
                throw new ChainValidationError('INVALID_ACTION', 'Create the vault first; preparation is signed on Solana.');
            const state = await snapshot(rpc, b);
            assertActionState(state, input);
            const amount = rawAmount(input.amountRaw);
            if (input.action === 'approve') {
                to = p.asset;
                data = '0x' + ABI.approve + addressWord(p.vault) + word(amount);
            }
            else {
                to = p.vault;
                data = '0x' + ABI[input.action === 'deposit' ? 'deposit' : 'claim'] + word(amount);
                if (input.action === 'deposit') {
                    const allowance = (await rpc.batch(network, [{ to: p.asset, data: '0x' + ABI.allowance + addressWord(b.owner.evm) + addressWord(p.vault) }], block))[0]!;
                    if (BigInt(allowance) < amount)
                        throw new ChainValidationError('APPROVAL_REQUIRED', 'Approve the exact deposit amount first.');
                }
            }
        }
        const native = BigInt(await rpc.call<string>(network, 'eth_getBalance', [owner, 'latest']));
        if (native === 0n && !input.gasPayment)
            throw new ChainValidationError('INSUFFICIENT_GAS', 'Add testnet gas to this wallet.');
        await rpc.call(network, 'eth_call', [{ from: owner, to, data, value: '0x0' }, 'latest']);
        if (!input.gasPayment) await assertEvmGasFunds(rpc, network, owner, { to, data, value: '0x0' });
        const plan = { ...base, transaction: { kind: 'evm' as const, chainId: EVM_DEPLOYMENTS[network].chainId, to, data, value: '0' } };
        return { ...plan, fingerprint: planFingerprint(plan) };
    }
    if (!['initialize', 'deposit', 'prepare', 'abort', 'claim'].includes(input.action))
        throw new ChainValidationError('INVALID_ACTION', 'Use a supported Solana wallet action.');
    const state = await snapshot(rpc, b);
    let instructions: TransactionInstruction[];
    if (input.action === 'initialize') {
        if (state.solana.phase !== null)
            throw new ChainValidationError('ALREADY_INITIALIZED', 'Reconcile the original initialization signature.');
        instructions = [initializeInstruction(b)];
    }
    else {
        assertActionState(state, input);
        if (input.action === 'prepare' || input.action === 'abort')
            instructions = [prepareInstruction(b, input.action === 'abort')];
        else {
            if (input.action !== 'deposit' && input.action !== 'claim')
                throw new ChainValidationError('INVALID_ACTION', 'Unsupported Solana action.');
            const amount = rawAmount(input.amountRaw).toString();
            instructions = [financialInstruction(b, input.action, amount)];
            if (input.action === 'claim' && !await rpc.solana.getAccountInfo(new PublicKey(ownerAta(b.owner.solana)), 'confirmed'))
                instructions.unshift(createAtaInstruction(b.owner.solana));
        }
    }
    const lifetime = await rpc.solana.getLatestBlockhash('confirmed'), tx = new VersionedTransaction(new TransactionMessage({ payerKey: new PublicKey(owner), recentBlockhash: lifetime.blockhash, instructions }).compileToV0Message());
    if (tx.serialize().length > 1232)
        throw new ChainValidationError('TRANSACTION_SIZE', 'The transaction exceeds the supported Solana wire size.');
    const simulation = await rpc.solana.simulateTransaction(tx, { sigVerify: false, commitment: 'confirmed' });
    if (simulation.value.err && !(input.gasPayment === 'privy-testnet' && sponsoredFeeSimulationError(simulation.value.err)))
        throw new ChainValidationError('SIMULATION_FAILED', 'Wallet transaction could not simulate; check gas and current goal state.');
    const plan = { ...base, expiresAt: new Date(Date.now() + 60000).toISOString(), transaction: { kind: 'solana' as const, chainId: 'solana-devnet' as const, base64: Buffer.from(tx.serialize()).toString('base64'), blockhash: lifetime.blockhash, lastValidBlockHeight: lifetime.lastValidBlockHeight } };
    return { ...plan, fingerprint: planFingerprint(plan) };
}

/** Only the pre-execution fee check may be deferred to Privy's mandatory sponsored simulation.
 * Instruction failures, including custom-program rent, are never treated as successful simulation. */
export function sponsoredFeeSimulationError(error: unknown): boolean {
    return error === 'InsufficientFundsForFee' || error === 'AccountNotFound';
}
