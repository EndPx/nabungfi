/** AUTHORING MODULE: never runs a wallet, creates a key, loads secrets or starts production by import. */
import { createHash, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { applicationServer, type ChainServices, type ApplicationRuntime } from '../src/application-server.js';
import type { AppConfig } from '../src/config.js';
import type { ApplicationRepository } from '../src/repository.js';
import type { Authentication, VerifiedIdentity } from '../src/auth.js';
import { ApiError } from '../src/errors.js';
import { deriveGoalBinding, configurationHash, solanaAddressWord, addressWord } from '../src/chain/codec.js';
import { assertPlan } from '../src/chain/planner.js';
import type { GoalDTO, GoalStepDTO, GoalHistoryEntry, SessionDTO } from '@nabungfi/shared/application';
import type { ChainPlan, GoalBinding, ChainAction, ChainNetwork } from '@nabungfi/shared/chain';
export const OWNER_FIXTURE_PROFILE = 'owner-fixture-sol-base-v2' as const;
export const OWNER_FIXTURE_ACKNOWLEDGEMENT = 'RUN_FRESH_TESTNET_FIXTURE_WITH_EXTERNAL_OWNER_SIGNATURES' as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export interface FixtureIdentity {
    subject: string;
    owner: {
        solana: string;
        evm: string;
    };
    operator: {
        solana: string;
        evm: string;
    };
}
export interface OwnerStepEvidence {
    label: string;
    requestId: string;
    action: ChainAction;
    network: ChainNetwork;
    amountRaw?: string;
    stepId?: string;
    fingerprint?: string;
    walletStarted: boolean;
    transactionHash?: string;
    confirmed: boolean;
}
export interface OwnerLifecycleJournal {
    startedAt: string;
    deadlineAt: string;
    version: 1;
    profile: typeof OWNER_FIXTURE_PROFILE;
    runId: string;
    identity: FixtureIdentity;
    authenticationClass: 'fixture-authentication-not-real-Privy';
    metadataGoalId?: string;
    goalId?: string;
    stages: Record<string, OwnerStepEvidence>;
    completed: boolean;
    initialWalletUsdc?: Record<string, string>;
    lastError?: string;
    messages?: LayerZeroWitness[];
    finalGoal?: GoalDTO;
    history?: GoalHistoryEntry[];
}
export interface MessageSource {
    transactionHash: string;
    label: string;
}
export interface LayerZeroWitness {
    sourceHash: string;
    destinationHash: string;
    guid: string;
    kind: number;
    amountRaw: string;
    round: string;
    applicationSequence: string;
    srcEid: number;
    dstEid: number;
    status: 'DELIVERED';
    observedAt: string;
}
export interface OwnerLifecycleOptions {
    profile: typeof OWNER_FIXTURE_PROFILE;
    acknowledgement: typeof OWNER_FIXTURE_ACKNOWLEDGEMENT;
    runId: string;
    baseUrl: string;
    fixtureToken: string;
    identity: FixtureIdentity;
    /** External Root signer must durably record the exact signed hash BEFORE broadcasting. */
    sendPlan(plan: ChainPlan, context: {
        label: string;
        deadline: number;
        recordOriginalHash(hash: string): Promise<void>;
    }): Promise<{
        transactionHash: string;
    }>;
    collectMessageSources(binding: GoalBinding): Promise<MessageSource[]>;
    checkpoint(journal: OwnerLifecycleJournal): Promise<void>;
    resume?: OwnerLifecycleJournal;
    deadlineMs?: number;
    pollMs?: number;
    onProgress?(event: {
        stage: string;
        time: string;
        message: string;
    }): void;
}
export interface LifecycleRuntime {
    fetch?: typeof fetch;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
}
export class OwnerLifecycleError extends Error {
    constructor(readonly code: string, message: string) { super(message); this.name = 'OwnerLifecycleError'; }
}
function requireThat(value: unknown, code: string, message: string): asserts value { if (!value)
    throw new OwnerLifecycleError(code, message); }
export function validateFixtureIdentity(identity: FixtureIdentity): void {
    requireThat(/^did:privy:nabungfi-owner-fixture-[0-9a-f-]{36}$/i.test(identity.subject) && uuid.test(identity.subject.slice('did:privy:nabungfi-owner-fixture-'.length)), 'FIXTURE_SUBJECT_REQUIRED', 'Use an isolated unique fixture subject, never a real user subject.');
    deriveGoalBinding({ goalId: '0x' + '1'.repeat(64), targetRaw: '2000000', owner: identity.owner, networks: ['solana', 'base'] });
    requireThat(identity.owner.solana !== identity.operator.solana && identity.owner.evm.toLowerCase() !== identity.operator.evm.toLowerCase(), 'OWNER_OPERATOR_MUST_DIFFER', 'Both financial owner wallets must differ from the coordination operator.');
}
function loopback(value: string): URL { const u = new URL(value); requireThat(u.protocol === 'http:' && u.hostname === '127.0.0.1' && !!u.port && !u.username && !u.password && !u.search && !u.hash && (u.pathname === '/' || u.pathname === ''), 'ISOLATED_LOOPBACK_REQUIRED', 'Use a dedicated HTTP 127.0.0.1 fixture server.'); return u; }
export async function startOwnerFixtureServer(input: {
    profile: typeof OWNER_FIXTURE_PROFILE;
    acknowledgement: typeof OWNER_FIXTURE_ACKNOWLEDGEMENT;
    config: AppConfig;
    repo: ApplicationRepository;
    chain: ChainServices;
    runtime: ApplicationRuntime;
    identity: FixtureIdentity;
    fixtureToken: string;
    port?: number;
}): Promise<{
    server: ReturnType<typeof applicationServer>;
    baseUrl: string;
    close(): Promise<void>;
}> {
    requireThat(input.profile === OWNER_FIXTURE_PROFILE && input.acknowledgement === OWNER_FIXTURE_ACKNOWLEDGEMENT, 'EXPLICIT_FIXTURE_REQUIRED', 'This server factory is an explicit test harness.');
    validateFixtureIdentity(input.identity);
    requireThat(!input.config.production && input.config.host === '127.0.0.1' && input.config.origins.every(origin => new URL(origin).protocol === 'http:' && new URL(origin).hostname === '127.0.0.1'), 'FIXTURE_SERVER_NOT_PRODUCTION', 'Fixture authentication cannot run in production or on a public listen address.');
    requireThat(input.fixtureToken.length >= 32, 'FIXTURE_TOKEN_REQUIRED', 'Supply a private one-run fixture token.');
    const expected = Buffer.from('Bearer ' + input.fixtureToken);
    const auth: Authentication = { async authenticate(header) { const actual = Buffer.from(header ?? ''); if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
            throw new ApiError('UNAUTHENTICATED', 401, 'Explicit fixture token required.'); return { subject: input.identity.subject, wallets: [{ chainType: 'solana', address: input.identity.owner.solana }, { chainType: 'ethereum', address: input.identity.owner.evm.toLowerCase() }] } satisfies VerifiedIdentity; } };
    // The caller must provide actual Neon repository, actual ChainServices and the real operator runtime.
    // Normal src/index.ts never imports this factory; no environment flag enables it there.
    const server = applicationServer(input.config, input.repo, auth, input.chain, input.runtime);
    const port = input.port ?? 0;
    requireThat(Number.isInteger(port) && port >= 0 && port <= 65535, 'INVALID_FIXTURE_PORT', 'Use an explicit valid loopback port.');
    await new Promise<void>((ready, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => { server.off('error', reject); ready(); }); });
    const address = server.address();
    requireThat(address && typeof address !== 'string' && address.address === '127.0.0.1', 'ISOLATED_LOOPBACK_REQUIRED', 'Fixture server must be bound only to127.0.0.1.');
    return { server, baseUrl: 'http://127.0.0.1:' + address.port, close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}
export function stableStageId(runId: string, label: string): string { requireThat(uuid.test(runId), 'RUN_ID_REQUIRED', 'Use a stable UUID run identifier.'); const bytes = createHash('sha256').update(runId + ':' + label).digest().subarray(0, 16); bytes[6] = (bytes[6]! & 15) | 128; bytes[8] = (bytes[8]! & 63) | 128; const hex = bytes.toString('hex'); return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-'); }
function hashFormat(network: ChainNetwork, hash: string): boolean { return network === 'solana' ? /^[1-9A-HJ-NP-Za-km-z]{70,100}$/.test(hash) : /^0x[0-9a-f]{64}$/i.test(hash); }
function assertGoal(goal: GoalDTO, options: OwnerLifecycleOptions): void { const b = goal.binding; requireThat(goal.targetRaw === '2000000' && b.targetRaw === '2000000' && b.owner.solana === options.identity.owner.solana && b.owner.evm.toLowerCase() === options.identity.owner.evm.toLowerCase() && b.participants.length === 1 && b.participants[0]?.network === 'base', 'GOAL_IDENTITY_CHANGED', 'The fixed owner/target/Solana+Base goal identity changed.'); if (options.resume?.goalId)
    requireThat(goal.goalId === options.resume.goalId, 'GOAL_IDENTITY_CHANGED', 'Resume the original goal only.'); }
function assertStep(step: GoalStepDTO, goal: GoalDTO, evidence: OwnerStepEvidence): void { requireThat(step.metadataGoalId === goal.id && step.goalId === goal.goalId && step.action === evidence.action && step.network === evidence.network && step.amountRaw === evidence.amountRaw, 'STEP_IDENTITY_CHANGED', 'The stored step is not this exact goal/action/network/amount.'); if (evidence.stepId)
    requireThat(evidence.stepId === step.id, 'STEP_IDENTITY_CHANGED', 'The original step ID changed.'); }
export async function runOwnerLifecycle(options: OwnerLifecycleOptions, runtime: LifecycleRuntime = {}): Promise<OwnerLifecycleJournal> {
    requireThat(options.profile === OWNER_FIXTURE_PROFILE && options.acknowledgement === OWNER_FIXTURE_ACKNOWLEDGEMENT, 'EXPLICIT_FIXTURE_REQUIRED', 'This authoring module cannot run without explicit fixture approval.');
    loopback(options.baseUrl);
    validateFixtureIdentity(options.identity);
    requireThat(uuid.test(options.runId) && options.fixtureToken.length >= 32, 'RUN_ID_REQUIRED', 'Supply stable run identity and private fixture token.');
    const now = runtime.now ?? Date.now, sleep = runtime.sleep ?? (ms => new Promise(done => setTimeout(done, ms))), request = runtime.fetch ?? fetch, pollMs = options.pollMs ?? 10000, deadlineMs = options.deadlineMs ?? 2700000;
    requireThat(pollMs >= 100 && pollMs <= 30000 && deadlineMs >= 1000 && deadlineMs <= 3600000, 'FINITE_DEADLINE_REQUIRED', 'Use bounded deadline and polling waits.');
    let deadline = now() + deadlineMs;
    const journal: OwnerLifecycleJournal = options.resume ? structuredClone(options.resume) : { startedAt: new Date(now()).toISOString(), deadlineAt: new Date(deadline).toISOString(), version: 1, profile: OWNER_FIXTURE_PROFILE, runId: options.runId, identity: structuredClone(options.identity), authenticationClass: 'fixture-authentication-not-real-Privy', stages: {}, completed: false };
    requireThat(journal.runId === options.runId && journal.profile === options.profile && JSON.stringify(journal.identity) === JSON.stringify(options.identity), 'RESUME_IDENTITY_CHANGED', 'Run identity/owners/operator are immutable.');
    deadline = Date.parse(journal.deadlineAt);
    requireThat(Number.isFinite(deadline), 'FINITE_DEADLINE_REQUIRED', 'Restore the original fixed deadline.');
    const save = () => options.checkpoint(structuredClone(journal));
    const progress = (stage: string, message: string) => options.onProgress?.({ stage, time: new Date(now()).toISOString(), message });
    const budget = () => requireThat(now() < deadline, 'LIFECYCLE_DEADLINE', 'Deadline reached. Preserve goal, original hashes, registry and funded state; never reset or delete.');
    async function api<T>(path: string, method = 'GET', data?: unknown, idempotency?: string): Promise<T> { budget(); const response = await request(options.baseUrl.replace(/\/$/, '') + path, { method, redirect: 'error', signal: AbortSignal.timeout(20000), headers: { authorization: 'Bearer ' + options.fixtureToken, ...(data !== undefined ? { 'content-type': 'application/json' } : {}), ...(idempotency ? { 'Idempotency-Key': idempotency } : {}) }, ...(data !== undefined ? { body: JSON.stringify(data) } : {}) }); const result = await response.json() as T & {
        code?: string;
    }; if (!response.ok)
        throw new OwnerLifecycleError(result.code ?? 'HTTP_FAILED', 'Fixture API operation did not complete; preserve its immutable request and original outcome.'); return result; }
    async function wait<T>(stage: string, read: () => Promise<T>, ready: (value: T) => boolean): Promise<T> { while (true) {
        budget();
        const value = await read();
        if (ready(value))
            return value;
        progress(stage, 'Waiting for authoritative original receipt or crosschain application state.');
        await sleep(Math.min(pollMs, Math.max(1, deadline - now())));
    } }
    await save();
    try {
        const session = await api<SessionDTO>('/api/session');
        requireThat(session.profile === 'testnet' && session.user.privySubject === options.identity.subject, 'FIXTURE_SESSION_MISMATCH', 'The isolated synthetic fixture session does not match.');
        requireThat(session.user.wallets.some(w => w.chainType === 'solana' && w.address === options.identity.owner.solana) && session.user.wallets.some(w => w.chainType === 'ethereum' && w.address.toLowerCase() === options.identity.owner.evm.toLowerCase()), 'FIXTURE_SESSION_MISMATCH', 'Both external owner addresses must be present in the fixture identity.');
        const reserved = await api<{
            goal: GoalDTO;
        }>('/api/goals', 'POST', { name: 'Owner lifecycle ' + options.runId, model: 'custom', targetAmount: '2', solanaOwner: options.identity.owner.solana, evmOwner: options.identity.owner.evm, chains: ['solana', 'base'] }, options.runId);
        let goal = reserved.goal;
        assertGoal(goal, options);
        if (journal.metadataGoalId)
            requireThat(goal.id === journal.metadataGoalId, 'GOAL_IDENTITY_CHANGED', 'Original metadata ID changed.');
        journal.metadataGoalId = goal.id;
        journal.goalId = goal.goalId;
        await save();
        const refreshGoal = async () => { const result = await api<{
            goal: GoalDTO;
        }>('/api/goals/' + goal.id); assertGoal(result.goal, options); goal = result.goal; return goal; };
        async function step(label: string, action: ChainAction, network: ChainNetwork, amountRaw?: string): Promise<void> {
            const evidence = journal.stages[label] ?? { label, requestId: stableStageId(options.runId, label), action, network, ...(amountRaw ? { amountRaw } : {}), walletStarted: false, confirmed: false };
            requireThat(evidence.action === action && evidence.network === network && evidence.amountRaw === amountRaw, 'STEP_IDENTITY_CHANGED', 'Resume only the original finite action.');
            journal.stages[label] = evidence;
            await save();
            let current = (await api<{
                step: GoalStepDTO;
            }>('/api/goals/' + goal.id + '/steps', 'POST', { requestId: evidence.requestId, action, network, ...(amountRaw ? { amountRaw } : {}) })).step;
            assertStep(current, goal, evidence);
            evidence.stepId = current.id;
            if (current.transactionHash) {
                if (evidence.transactionHash)
                    requireThat(evidence.transactionHash === current.transactionHash, 'ORIGINAL_HASH_CHANGED', 'Backend and checkpoint must retain the same original hash.');
                evidence.transactionHash = current.transactionHash;
                await save();
            }
            if (current.status === 'confirmed') {
                requireThat(!!evidence.transactionHash && hashFormat(network, evidence.transactionHash), 'CONFIRMED_WITHOUT_ORIGINAL_HASH', 'Confirmed API steps require a real original transaction hash.');
                evidence.confirmed = true;
                await save();
                return;
            }
            requireThat(current.status !== 'failed' && current.status !== 'rejected', 'OWNER_TRANSACTION_FAILED', 'This original owner transaction failed or was rejected; no automatic financial replacement.');
            if (!evidence.transactionHash) {
                requireThat(!evidence.walletStarted && current.status === 'planned' && !!current.plan, 'UNKNOWN_OWNER_OUTCOME', 'A wallet attempt already began without a known hash. Stop and reconcile externally; never invoke the signer again.');
                let plan = current.plan!;
                assertPlan(goal.binding, plan);
                requireThat(plan.id === current.id && plan.action === action && plan.network === network && plan.amountRaw === amountRaw, 'PLAN_IDENTITY_CHANGED', 'Unsigned plan does not bind this step.');
                if (Date.parse(plan.expiresAt) <= now()) {
                    current = (await api<{
                        step: GoalStepDTO;
                    }>(`/api/goals/${goal.id}/steps/${current.id}/refresh`, 'POST', { fingerprint: plan.fingerprint })).step;
                    assertStep(current, goal, evidence);
                    requireThat(current.status === 'planned' && !!current.plan, 'UNSIGNED_REFRESH_FAILED', 'Only never-attempted unsigned plans may refresh.');
                    plan = current.plan!;
                    assertPlan(goal.binding, plan);
                }
                const started = await api<{
                    step: GoalStepDTO;
                }>(`/api/goals/${goal.id}/steps/${current.id}/wallet-start`, 'POST', { fingerprint: plan.fingerprint });
                assertStep(started.step, goal, evidence);
                requireThat(started.step.status === 'signing' && started.step.plan?.fingerprint === plan.fingerprint, 'WALLET_MARKER_MISSING', 'Actual API wallet-start marker must precede the external signer.');
                evidence.walletStarted = true;
                evidence.fingerprint = plan.fingerprint;
                await save();
                try {
                    const result = await options.sendPlan(plan, { label, deadline, async recordOriginalHash(hash) { requireThat(hashFormat(network, hash), 'INVALID_SIGNED_HASH', 'External signer must provide its actual signed transaction hash.'); const normalized = network === 'solana' ? hash : hash.toLowerCase(); if (evidence.transactionHash)
                            requireThat(evidence.transactionHash === normalized, 'ORIGINAL_HASH_CHANGED', 'Never replace the original signed transaction.'); evidence.transactionHash = normalized; await save(); } });
                    requireThat(!!evidence.transactionHash && result.transactionHash === (network === 'solana' ? evidence.transactionHash : evidence.transactionHash.toLowerCase()), 'SIGNER_WAL_NOT_DURABLE', 'Signer must durably record and return the original hash before broadcast.');
                }
                catch (error) {
                    if (error instanceof OwnerLifecycleError && ['ORIGINAL_HASH_CHANGED', 'SIGNER_WAL_NOT_DURABLE', 'INVALID_SIGNED_HASH'].includes(error.code))
                        throw error;
                    if (!evidence.transactionHash)
                        throw new OwnerLifecycleError('UNKNOWN_OWNER_OUTCOME', 'Signer failed without a durable original hash. Preserve wallet-start marker and funded metadata.');
                    progress(label, 'Signer submission was unclear; reconciling only its durably recorded original hash.');
                }
            }
            const original = evidence.transactionHash!;
            await wait(label, async () => { const result = await api<{
                step: GoalStepDTO;
            }>(`/api/goals/${goal.id}/steps/${current.id}/reconcile`, 'POST', { transactionHash: original }); assertStep(result.step, goal, evidence); requireThat(result.step.transactionHash === original, 'ORIGINAL_HASH_CHANGED', 'Reconciliation changed the original transaction.'); requireThat(result.step.status !== 'failed' && result.step.status !== 'rejected', 'OWNER_TRANSACTION_FAILED', 'Original transaction failed; no automatic replacement.'); return result.step; }, value => value.status === 'confirmed');
            evidence.confirmed = true;
            await save();
            await refreshGoal();
            progress(label, 'Original owner transaction confirmed through the actual API.');
        }
        await step('create-base-vault', 'create-vault', 'base');
        await refreshGoal();
        await step('initialize-solana', 'initialize', 'solana');
        await wait('authenticated-registration', refreshGoal, g => g.chainStatus === 'available' && g.chainState?.linked === true);
        if (!journal.initialWalletUsdc) {
            requireThat(!journal.stages['deposit-solana-one']?.walletStarted && !journal.stages['deposit-base-one']?.walletStarted, 'MISSING_FINANCIAL_BASELINE', 'Do not invent a baseline after a financial attempt.');
            journal.initialWalletUsdc = Object.fromEntries(goal.chainState!.positions.map(p => [p.network, p.walletUsdcRaw]));
            await save();
        }
        await step('deposit-solana-one', 'deposit', 'solana', '1000000');
        await step('approve-base-one', 'approve', 'base', '1000000');
        await step('deposit-base-one', 'deposit', 'base', '1000000');
        if (!journal.stages['owner-prepare']?.walletStarted)
            await wait('fresh-qualified-target', refreshGoal, g => g.chainState?.canPrepare === true);
        await step('owner-prepare', 'prepare', 'solana');
        await wait('all-ready-and-commit', refreshGoal, g => !!g.chainState && ['achieved', 'claimed'].includes(g.chainState.phase) && g.chainState.achievedTotalRaw === '2000000' && g.chainState.positions.length === 2 && g.chainState.positions.every(p => p.phase === 'achieved' && (p.assetsRaw === '1000000' && p.claimedRaw === '0' || p.assetsRaw === '0' && p.claimedRaw === '1000000')));
        await step('claim-base-one', 'claim', 'base', '1000000');
        await step('claim-solana-one', 'claim', 'solana', '1000000');
        await wait('postclaim-zero-progress', refreshGoal, g => g.chainState?.phase === 'claimed' && g.chainState.totalAssetsRaw === '0' && g.chainState.totalClaimedRaw === '2000000' && g.chainState.achievedTotalRaw === '2000000' && g.chainState.positions.every(p => p.assetsRaw === '0' && p.claimedRaw === '1000000') && g.chainState.solana.participants.every(p => p.netAssetsRaw === '0'));
        for (const p of goal.chainState!.positions)
            requireThat(p.walletUsdcRaw === journal.initialWalletUsdc?.[p.network], 'WALLET_CONSERVATION', 'Owner wallet USDC must return to its actual pre-deposit balance.');
        while (true) {
            budget();
            try {
                const sources = await options.collectMessageSources(goal.binding);
                journal.messages = await collectLayerZeroWitnesses(goal.binding, sources, request, budget);
                break;
            }
            catch (error) {
                if (!(error instanceof OwnerLifecycleError) || !['SCAN_UNAVAILABLE', 'SCAN_NOT_INDEXED', 'LAYERZERO_NOT_DELIVERED', 'MISSING_MESSAGE_SOURCES'].includes(error.code))
                    throw error;
                progress('public-layerzero-witness', 'Owner funds are recovered; waiting only for original public message indexing/delivery evidence.');
                await sleep(Math.min(pollMs, Math.max(1, deadline - now())));
            }
        }
        journal.finalGoal = goal;
        journal.history = (await api<{
            history: GoalHistoryEntry[];
        }>(`/api/goals/${goal.id}/history`)).history;
        for (const e of Object.values(journal.stages))
            requireThat(journal.history.some(h => h.id === e.stepId && h.status === 'confirmed' && h.transactionHash === e.transactionHash), 'HISTORY_NOT_CONFIRMED', 'Every original owner receipt must be confirmed in actual API history.');
        journal.completed = true;
        delete journal.lastError;
        await save();
        progress('completed', 'Fresh owner/API/chain lifecycle complete. This remains fixture authentication, not real Privy JWT/UI proof.');
        return structuredClone(journal);
    }
    catch (error) {
        journal.lastError = error instanceof OwnerLifecycleError ? error.code : 'UNRESOLVED_FIXTURE_OUTCOME';
        await save();
        throw error;
    }
}
interface ScanRecord {
    pathway: {
        srcEid: number;
        dstEid: number;
    };
    source: {
        tx: {
            txHash: string;
            payload: string;
        };
    };
    destination: {
        tx?: {
            txHash: string;
        };
    };
    guid: string;
    status: {
        name: string;
    };
    config?: {
        error?: boolean;
    };
    verification?: {
        dvn?: {
            status: string;
        };
    };
}
export function verifyLayerZeroWitness(binding: GoalBinding, source: MessageSource, record: ScanRecord): LayerZeroWitness {
    const p = binding.participants.find(p => p.network === 'base');
    requireThat(p?.vault && p.configHash, 'MISSING_BASE_BINDING', 'An actual Base vault binding is required.');
    const payload = Buffer.from(record.source.tx.payload.replace(/^0x/, ''), 'hex');
    requireThat(payload.length === 222 && payload.subarray(0, 4).toString() === 'NBFG' && payload[4] === 2, 'WRONG_LAYERZERO_PAYLOAD', 'Require the real deployed v2 payload.');
    const src = payload.readUInt32BE(6), dst = payload.readUInt32BE(10), solToBase = src === 1 && dst === 2, baseToSol = src === 2 && dst === 1;
    requireThat(solToBase || baseToSol, 'WRONG_LAYERZERO_PATH', 'Only the selected Solana/Base pair belongs to this fixture.');
    requireThat(record.source.tx.txHash === source.transactionHash && record.pathway.srcEid === (solToBase ? 40168 : 40245) && record.pathway.dstEid === (solToBase ? 40245 : 40168) && record.status.name === 'DELIVERED' && record.config?.error === false && record.verification?.dvn?.status === 'SUCCEEDED' && !!record.destination.tx?.txHash, 'LAYERZERO_NOT_DELIVERED', 'Require actual source, successful configured verification and destination delivery.');
    requireThat('0x' + payload.subarray(14, 46).toString('hex') === binding.goalId && '0x' + payload.subarray(46, 78).toString('hex') === configurationHash(binding, p, p.vault), 'WRONG_LAYERZERO_GOAL', 'Message belongs to another goal or immutable configuration.');
    const sol = solanaAddressWord(binding.solanaGoal), vault = addressWord(p.vault), owner = addressWord(binding.owner.evm);
    requireThat(payload.subarray(78, 110).toString('hex') === (solToBase ? sol : vault) && payload.subarray(110, 142).toString('hex') === (solToBase ? vault : sol) && payload.subarray(142, 174).toString('hex') === owner, 'WRONG_LAYERZERO_GOAL', 'Source/destination/owner must be the actual bound goal.');
    const kind = payload[5]!, round = payload.readBigUInt64BE(174), sequence = payload.readBigUInt64BE(182), amount = payload.readBigUInt64BE(190), aggregate = payload.readBigUInt64BE(198);
    requireThat(payload.readBigUInt64BE(206) > 0n && payload.readBigUInt64BE(214) > 0n, 'INVALID_LIFECYCLE_WITNESS', 'Message observation and time must be actual positive chain values.');
    if (kind === 7 || kind === 8)
        requireThat((kind === 7 ? solToBase : baseToSol) && round === 0n && sequence === 0n && amount === 2000000n, 'INVALID_LIFECYCLE_WITNESS', 'Registration must certify this exact target.');
    else if (kind === 1)
        requireThat(solToBase && round === 1n && sequence === 1n && amount === 2000000n, 'INVALID_LIFECYCLE_WITNESS', 'Require the original preparation round.');
    else if (kind === 4)
        requireThat(baseToSol && round === 1n && sequence === 1n && amount === 1000000n, 'INVALID_LIFECYCLE_WITNESS', 'Require the actual Base cash reserve.');
    else if (kind === 2)
        requireThat(solToBase && round === 1n && sequence === 2n && amount === 1000000n && aggregate === 2000000n, 'INVALID_LIFECYCLE_WITNESS', 'Require exact reserve and committed aggregate.');
    else
        requireThat(kind === 6 && baseToSol && sequence > 0n && (amount === 1000000n || amount === 0n), 'INVALID_LIFECYCLE_WITNESS', 'Require an actual absolute progress message.');
    requireThat(/^0x[0-9a-f]{64}$/i.test(record.guid), 'INVALID_LIFECYCLE_WITNESS', 'Require the actual message GUID.');
    return { sourceHash: source.transactionHash, destinationHash: record.destination.tx!.txHash, guid: record.guid, kind: payload[5]!, amountRaw: payload.readBigUInt64BE(190).toString(), round: payload.readBigUInt64BE(174).toString(), applicationSequence: payload.readBigUInt64BE(182).toString(), srcEid: record.pathway.srcEid, dstEid: record.pathway.dstEid, status: 'DELIVERED', observedAt: new Date().toISOString() };
}
export async function collectLayerZeroWitnesses(binding: GoalBinding, sources: MessageSource[], request: typeof fetch = fetch, guard: () => void = () => { }): Promise<LayerZeroWitness[]> {
    requireThat(sources.length >= 7 && sources.length <= 100, 'MISSING_MESSAGE_SOURCES', 'Supply original operator source hashes from its actual journal.');
    const witnesses: LayerZeroWitness[] = [];
    for (const source of sources) {
        guard();
        requireThat(/^[0-9A-Za-z]{70,100}$/.test(source.transactionHash) || /^0x[0-9a-f]{64}$/i.test(source.transactionHash), 'INVALID_MESSAGE_SOURCE', 'Use original source transaction hashes.');
        const response = await request('https://scan-testnet.layerzero-api.com/v1/messages/tx/' + encodeURIComponent(source.transactionHash), { redirect: 'error', signal: AbortSignal.timeout(20000) });
        requireThat(response.ok, 'SCAN_UNAVAILABLE', 'Preserve confirmed owner operations while Scan is unavailable.');
        const result = await response.json() as {
            data: ScanRecord[];
        };
        guard();
        requireThat(Array.isArray(result.data), 'SCAN_UNAVAILABLE', 'Scan response is unavailable.');
        const matching = result.data.filter(r => r.source.tx.txHash === source.transactionHash);
        requireThat(matching.length > 0, 'SCAN_NOT_INDEXED', 'Wait for original public message indexing.');
        requireThat(matching.length === 1, 'AMBIGUOUS_SCAN_MESSAGE', 'Each source hash must identify one actual message.');
        witnesses.push(verifyLayerZeroWitness(binding, source, matching[0]!));
    }
    requireThat(new Set(witnesses.map(w => w.guid)).size === witnesses.length, 'DUPLICATE_MESSAGE_WITNESS', 'A message GUID cannot prove two stages.');
    for (const kind of [7, 8, 1, 4, 2])
        requireThat(witnesses.some(w => w.kind === kind), 'MISSING_LIFECYCLE_MESSAGE', 'Require registration, acknowledgement, preparation, readiness and commitment delivery.');
    requireThat(witnesses.some(w => w.kind === 6 && w.amountRaw === '1000000') && witnesses.some(w => w.kind === 6 && w.amountRaw === '0'), 'MISSING_ABSOLUTE_PROGRESS', 'Require actual positive and zero absolute balance reports.');
    return witnesses;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    console.error('AUTHORING ONLY: import runOwnerLifecycle from an explicit private Root launcher. This module never loads secrets, signs, funds or runs automatically. Fixture auth is not real Privy authentication proof.');
    process.exitCode = 2;
}
