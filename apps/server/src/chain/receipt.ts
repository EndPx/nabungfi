import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import { EVM_DEPLOYMENTS, SOLANA_DEPLOYMENT, ChainValidationError, reconcileObservation, rawAmount, type GoalBinding, type ChainPlan, type ReconcileResult, type EvmNetwork } from '@nabungfi/shared/chain';
import { ABI, addressWord, solanaAddressWord, configurationHash, ownerAta, validateBinding, decodeGoal, validateDecodedGoal } from './codec.js';
import { assertPlan } from './planner.js';
import { validateRoute, validateEvmVault } from './state.js';
import type { RpcTransport } from './rpc.js';
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', APPROVAL = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925', VAULT_CREATED = '0x9d4c56aa1ee57230854bc61ae127f007cc16fbe66b8d5c088c2d3112708c9cc6';
export interface EvmLog {
    address: string;
    topics: string[];
    data: string;
    removed?: boolean;
}
export interface EvmReceipt {
    transactionHash: string;
    status: string;
    blockNumber: string;
    blockHash: string;
    logs: EvmLog[];
}
export interface EvmTransaction {
    hash: string;
    from: string;
    to: string | null;
    input: string;
    value: string;
    chainId?: string;
    blockNumber?: string | null;
}
export function assertEvmEnvelope(plan: ChainPlan, tx: EvmTransaction): void {
    if (plan.transaction.kind !== 'evm')
        throw new ChainValidationError('WRONG_TRANSACTION_TYPE', 'Expected EVM transaction.');
    const p = plan.transaction;
    if (tx.hash.length !== 66 || tx.from.toLowerCase() !== plan.owner.toLowerCase() || tx.to?.toLowerCase() !== p.to.toLowerCase() || tx.input.toLowerCase() !== p.data.toLowerCase() || BigInt(tx.value) !== BigInt(p.value) || tx.chainId !== undefined && BigInt(tx.chainId) !== BigInt(p.chainId))
        throw new ChainValidationError('TRANSACTION_SUBSTITUTION', 'Transaction caller, calldata, value or network differs from its plan.');
}
export function creationPatch(binding: GoalBinding, network: EvmNetwork, receipt: EvmReceipt): NonNullable<ReconcileResult['bindingPatch']> {
    const p = binding.participants.find(p => p.network === network)!;
    const matches = receipt.logs.filter(l => !l.removed && l.address.toLowerCase() === p.router && l.topics[0]?.toLowerCase() === VAULT_CREATED && l.topics[1]?.toLowerCase() === '0x' + addressWord(binding.owner.evm) && l.topics[3]?.toLowerCase() === '0x' + solanaAddressWord(binding.solanaGoal));
    if (matches.length !== 1)
        throw new ChainValidationError('WRONG_CREATION_EVENT', 'Expected one canonical vault creation event.');
    const event = matches[0]!, vault = '0x' + event.topics[2]!.slice(-40).toLowerCase(), hash = configurationHash(binding, p, vault);
    if (event.data.toLowerCase() !== '0x' + binding.goalId.slice(2) + hash.slice(2))
        throw new ChainValidationError('WRONG_CONFIGURATION', 'Creation event leaf does not bind the actual vault to this owner.');
    return { network, vault, configHash: hash, creationHash: receipt.transactionHash.toLowerCase() };
}
export function assertTokenEvent(binding: GoalBinding, plan: ChainPlan, receipt: EvmReceipt): void {
    if (!['approve', 'deposit', 'claim'].includes(plan.action))
        return;
    const p = binding.participants.find(p => p.network === plan.network)!;
    if (!p.vault)
        throw new ChainValidationError('MISSING_VAULT', 'Actual vault is missing.');
    const amount = rawAmount(plan.amountRaw), approval = plan.action === 'approve', from = approval || plan.action === 'deposit' ? binding.owner.evm : p.vault, to = approval || plan.action === 'deposit' ? p.vault : binding.owner.evm;
    const events = receipt.logs.filter(l => !l.removed && l.address.toLowerCase() === p.asset && l.topics[0]?.toLowerCase() === (approval ? APPROVAL : TRANSFER) && l.topics[1]?.toLowerCase() === '0x' + addressWord(from) && l.topics[2]?.toLowerCase() === '0x' + addressWord(to) && /^0x[0-9a-f]{64}$/i.test(l.data));
    if (events.length !== 1 || BigInt(events[0]!.data) !== amount)
        throw new ChainValidationError('TOKEN_CONSERVATION', 'Exact USDC approval/transfer was not present in the original receipt.');
}
function validSolanaSignature(value: string): boolean {
    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    if (value.length < 64 || value.length > 88)
        return false;
    let n = 0n;
    for (const character of value) {
        const digit = alphabet.indexOf(character);
        if (digit < 0)
            return false;
        n = n * 58n + BigInt(digit);
    }
    let count = 0;
    while (n > 0n) {
        count++;
        n >>= 8n;
    }
    return count + (value.match(/^1*/)?.[0].length ?? 0) === 64;
}
function checkedHash(plan: ChainPlan, hash: string): string {
    if (plan.network !== 'solana') {
        if (!/^0x[0-9a-f]{64}$/i.test(hash))
            throw new ChainValidationError('INVALID_TRANSACTION_HASH', 'Use the original EVM transaction hash.');
        return hash.toLowerCase();
    }
    if (!validSolanaSignature(hash))
        throw new ChainValidationError('INVALID_TRANSACTION_HASH', 'Use the original Solana signature.');
    return hash;
}
export async function reconcile(rpc: RpcTransport, b: GoalBinding, plan: ChainPlan, submitted: string): Promise<ReconcileResult> {
    validateBinding(b);
    assertPlan(b, plan);
    const hash = checkedHash(plan, submitted), observedAt = new Date().toISOString();
    const attention = (reasonCode: string): ReconcileResult => ({ status: 'attention', transactionHash: hash, reasonCode });
    if (plan.network !== 'solana') {
        const network = plan.network, p = b.participants.find(p => p.network === network)!;
        if (BigInt(await rpc.call<string>(network, 'eth_chainId', [])) !== BigInt(EVM_DEPLOYMENTS[network].chainId))
            throw new ChainValidationError('WRONG_CHAIN', 'Receipt RPC is on another network.');
        const tx = await rpc.call<EvmTransaction | null>(network, 'eth_getTransactionByHash', [hash]), receipt = await rpc.call<EvmReceipt | null>(network, 'eth_getTransactionReceipt', [hash]);
        if (!tx || !receipt)
            return { status: reconcileObservation('missing', !tx && Date.now() > Date.parse(plan.expiresAt)), transactionHash: hash, reasonCode: 'ORIGINAL_RECEIPT_UNAVAILABLE' };
        if (tx.hash.toLowerCase() !== hash || receipt.transactionHash.toLowerCase() !== hash)
            return attention('WRONG_RECEIPT_HASH');
        try {
            assertEvmEnvelope(plan, tx);
        }
        catch {
            return attention('TRANSACTION_SUBSTITUTION');
        }
        if (!['0x0', '0x1'].includes(receipt.status))
            return attention('INVALID_RECEIPT_STATUS');
        const block = await rpc.call<{
            hash: string;
            timestamp: string;
        } | null>(network, 'eth_getBlockByNumber', [receipt.blockNumber, false]);
        if (!block || block.hash !== receipt.blockHash)
            return { status: 'pending', transactionHash: hash, reasonCode: 'RECEIPT_BLOCK_NOT_CANONICAL' };
        if (Number(BigInt(block.timestamp)) * 1000 < Date.parse(plan.createdAt) - 30000)
            return attention('RECEIPT_PRECEDES_PLAN');
        const latest = BigInt(await rpc.call<string>(network, 'eth_blockNumber', []));
        if (latest < BigInt(receipt.blockNumber) + 1n)
            return { status: 'pending', transactionHash: hash, reasonCode: 'AWAITING_CONFIRMATIONS' };
        if (receipt.status === '0x0')
            return { status: 'failed', transactionHash: hash, reasonCode: 'ONCHAIN_TRANSACTION_FAILED' };
        await validateRoute(rpc, p, 'latest');
        let patch: ReconcileResult['bindingPatch'];
        try {
            if (plan.action === 'create-vault') {
                patch = creationPatch(b, network, receipt);
                if ('network' in patch)
                    await validateEvmVault(rpc, b, { ...p, vault: patch.vault, configHash: patch.configHash }, 'latest');
            }
            else {
                await validateEvmVault(rpc, b, p, 'latest');
                assertTokenEvent(b, plan, receipt);
            }
        }
        catch (error) {
            return attention(error instanceof ChainValidationError ? error.code : 'INVALID_RECEIPT');
        }
        return { status: 'confirmed', transactionHash: hash, receipt: { network, block: BigInt(receipt.blockNumber).toString(), transactionHash: hash, observedAt }, ...(patch ? { bindingPatch: patch } : {}) };
    }
    if (plan.transaction.kind !== 'solana')
        return attention('WRONG_TRANSACTION_TYPE');
    if (await rpc.solana.getGenesisHash() !== SOLANA_DEPLOYMENT.genesis)
        throw new ChainValidationError('WRONG_CHAIN', 'Expected Solana Devnet.');
    const tx = await rpc.solana.getTransaction(hash, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
    if (!tx) {
        const height = await rpc.solana.getBlockHeight('confirmed');
        return { status: reconcileObservation('missing', height > plan.transaction.lastValidBlockHeight), transactionHash: hash, reasonCode: 'ORIGINAL_RECEIPT_UNAVAILABLE' };
    }
    const expected = VersionedTransaction.deserialize(Buffer.from(plan.transaction.base64, 'base64'));
    if (!Buffer.from(tx.transaction.message.serialize()).equals(Buffer.from(expected.message.serialize())) || tx.transaction.signatures[0] !== hash || tx.transaction.message.staticAccountKeys[0]?.toBase58() !== b.owner.solana)
        return attention('TRANSACTION_SUBSTITUTION');
    if (tx.blockTime === null || tx.blockTime === undefined)
        return { status: 'pending', transactionHash: hash, reasonCode: 'RECEIPT_TIME_UNAVAILABLE' };
    if (tx.blockTime * 1000 < Date.parse(plan.createdAt) - 30000)
        return attention('RECEIPT_PRECEDES_PLAN');
    if (!tx.meta)
        return attention('MISSING_TRANSACTION_METADATA');
    if (tx.meta.err)
        return { status: 'failed', transactionHash: hash, reasonCode: 'ONCHAIN_TRANSACTION_FAILED' };
    if (plan.action === 'initialize') {
        const account = (await rpc.solana.getAccountInfoAndContext(new PublicKey(b.solanaGoal), { commitment: 'confirmed', minContextSlot: tx.slot })).value;
        if (!account || account.owner.toBase58() !== 'FWfjDER6zJbP227GymMqTwGveJ5fjw7nKJvwLEAbXsZn')
            return attention('MISSING_INITIALIZED_GOAL');
        try {
            validateDecodedGoal(b, decodeGoal(account.data));
        }
        catch {
            return attention('WRONG_INITIALIZED_GOAL');
        }
    }
    else if (plan.action === 'deposit' || plan.action === 'claim') {
        const keys = tx.transaction.message.staticAccountKeys, pre = tx.meta.preTokenBalances ?? [], post = tx.meta.postTokenBalances ?? [];
        const amountAt = (balances: typeof pre, address: string, allowMissing = false) => {
            const index = keys.findIndex(k => k.toBase58() === address), entry = balances.find(e => e.accountIndex === index);
            if (!entry) {
                if (allowMissing)
                    return 0n;
                throw new Error();
            }
            if (entry.mint !== '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU' || entry.uiTokenAmount.decimals !== 6)
                throw new Error();
            return BigInt(entry.uiTokenAmount.amount);
        };
        try {
            const delta = plan.action === 'deposit' ? rawAmount(plan.amountRaw) : -rawAmount(plan.amountRaw), cashDelta = amountAt(post, b.solanaCash) - amountAt(pre, b.solanaCash), walletDelta = amountAt(post, ownerAta(b.owner.solana)) - amountAt(pre, ownerAta(b.owner.solana), plan.action === 'claim');
            if (cashDelta !== delta || walletDelta !== -delta)
                return attention('TOKEN_CONSERVATION');
        }
        catch {
            return attention('TOKEN_CONSERVATION');
        }
    }
    return { status: 'confirmed', transactionHash: hash, receipt: { network: 'solana', block: tx.slot.toString(), transactionHash: hash, observedAt }, ...(plan.action === 'initialize' ? { bindingPatch: { initialized: true as const } } : {}) };
}
