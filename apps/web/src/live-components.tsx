import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Check,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  LockKeyhole,
  Plus,
  RefreshCw,
  TriangleAlert,
  Wallet,
} from "./icons";
import type {
  AppNetwork,
  CreateGoalRequest,
  GoalDTO,
  GoalHistoryEntry,
  GoalModel,
  GoalStepAction,
  GoalStepDTO,
  SessionDTO,
} from "@nabungfi/shared/application";
import { EVM_DEPLOYMENTS } from "@nabungfi/shared/chain";
import { GOAL_TEMPLATES } from "@nabungfi/shared/application";
import { Button, Dialog, FormError, IconButton, NetworkMark, WorkshopBoundary } from "./ui";
import { GoalIllustration } from "./Shell";
import {
  decimalAmount,
  formatUsdc,
  fundedPieces,
  rawAmount,
  type PendingApiRequest,
  type WalletRecovery,
} from "./live-api";
import { actions, networks, phases, short } from "./live-config";
import { nextPieceProgress, formatNativeGas } from "./savings-progress";
import { ChainAllocation } from "./ChainAllocation";
import { VaultAddress } from "./VaultAddress";
import { LoadingState } from "./LoadingState";
const CarWorkshop = lazy(() => import("./CarWorkshop"));
const activityDateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", year: "numeric",
  hour: "2-digit", minute: "2-digit", timeZoneName: "short",
});

export function PortfolioSummary({ balance, scope }: { balance: string; scope: string }) {
  const [hidden, setHidden] = useState(false);
  return (
    <section className="portfolio-summary" aria-label="Savings across goals">
      <div className="portfolio-balance">
        <div className="portfolio-label">
          <h2>Current savings</h2>
          <IconButton label={hidden ? "Show current savings" : "Hide current savings"} aria-pressed={hidden} onClick={() => setHidden(value => !value)}>
            {hidden ? <Eye size={19} /> : <EyeOff size={19} />}
          </IconButton>
        </div>
        <strong aria-label={hidden ? "Balance hidden" : undefined}>{hidden ? "••••••" : balance}<span className="portfolio-currency">USDC</span></strong>
        <p>{scope}</p>
        <p>Funds still in your goal vaults. Collected amounts stay on completed goal cards.</p>
      </div>
      <div className="portfolio-caption">
        <Box size={40} />
        <div>
          <strong>Little by little. Goal by goal.</strong>
          <p>Each goal unlocks at its own target, after completion is verified.</p>
        </div>
      </div>
    </section>
  );
}
export function Welcome({
  configured = true,
  login,
  ready = true,
  offline = false,
}: {
  configured?: boolean;
  login?: () => void;
  ready?: boolean;
  offline?: boolean;
}) {
  return (
    <section className="account-gate">
      <img src="/brand/nabungfi-mark.svg" width={88} height={88} alt="" />
      <h1>Open your workshop.</h1>
      <p>
        Sign in to create savings goals, add USDC and keep track of every build.
      </p>
      <Button
        variant="build"
        disabled={!configured || !ready || offline}
        onClick={login}
      >
        {offline ? "Reconnect to sign in" : ready ? "Sign in" : "Connecting…"}
        <ArrowRight size={18} />
      </Button>
      {!configured && (
        <p className="live-error" role="alert">
          Sign-in is unavailable for this deployment.
        </p>
      )}
      <a className="landing-text-link" href="/">
        Learn about NabungFi
      </a>
    </section>
  );
}

export function GoalCard({
  goal,
  onOpen,
}: {
  goal: GoalDTO;
  onOpen: () => void;
}) {
  const state = goal.chainState;
  const amount =
    state?.phase === "achieved" || state?.phase === "claimed"
      ? state.achievedTotalRaw
      : (state?.totalAssetsRaw ?? "0");
  const available = goal.chainStatus !== "unavailable";
  const pieces = fundedPieces(
    amount,
    goal.targetRaw,
    state?.phase === "achieved" || state?.phase === "claimed",
  );
  return (
    <button type="button" className="goal-card" data-model={goal.model} data-state={state?.phase ?? "unprovisioned"} data-read={goal.chainStatus} onClick={onOpen}>
      <GoalIllustration model={goal.model} />
      <div className="goal-card-body">
        <div className="goal-card-title">
          <h2>{goal.name}</h2>
          <span className="goal-card-open" aria-hidden="true"><ChevronRight size={18} /></span>
        </div>
        <span className="goal-card-status">
          {goal.chainStatus === "unavailable" ? <TriangleAlert size={14} /> :
            state?.phase === "achieved" || state?.phase === "claimed" ? <Check size={14} /> : <LockKeyhole size={14} />}
          {goal.chainStatus === "unavailable"
            ? "Balance unavailable"
            : phases[state?.phase ?? "unprovisioned"]}
        </span>
        <div className="goal-card-total">
          <strong>
            {goal.chainStatus === "unavailable"
              ? "—"
              : `$${formatUsdc(amount)}`}
          </strong>
          <span>{state?.phase === "claimed" ? "Collected" : "Total funded"} · Target ${formatUsdc(goal.targetRaw)}</span>
        </div>
        {available && (
          <div className="goal-progress" aria-hidden="true">
            {Array.from({ length: 100 }, (_, index) => (
              <i key={index} className={index < pieces ? "is-filled" : ""} />
            ))}
          </div>
        )}
        <div className="goal-card-foot">
          <span>
            {available ? `${pieces} / 100 funded pieces` : "Progress unavailable"}
          </span>
          <span>
            {goal.binding.participants.length + 1} chains
            <ChevronRight size={14} />
          </span>
        </div>
      </div>
    </button>
  );
}

export function GoalDetail({
  goal,
  history,
  reducedMotion,
  back,
  refresh,
  refreshing = false,
  busy,
  deposit,
  step,
  setup,
  focusHistory = false,
}: {
  goal: GoalDTO;
  history: GoalHistoryEntry[];
  reducedMotion: boolean;
  back: () => void;
  refresh: () => void;
  refreshing?: boolean;
  busy: boolean;
  deposit: () => void;
  step: (
    action: GoalStepAction,
    network: AppNetwork,
    amountRaw?: string,
  ) => void;
  setup?: () => void;
  focusHistory?: boolean;
}) {
  const activityRef = useRef<HTMLElement>(null);
  const activityFocused = useRef<string | null>(null);
  useEffect(() => {
    if (!focusHistory) { activityFocused.current = null; return; }
    if (activityFocused.current === goal.id || !activityRef.current) return;
    const frame = requestAnimationFrame(() => {
      activityRef.current?.focus({ preventScroll: true });
      activityRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
      activityFocused.current = goal.id;
    });
    return () => cancelAnimationFrame(frame);
  }, [focusHistory, goal.id, refreshing]);
  const state = goal.chainState;
  const achieved = state?.phase === "achieved" || state?.phase === "claimed";
  const total = achieved
    ? state.achievedTotalRaw
    : (state?.totalAssetsRaw ?? "0");
  const available = goal.chainStatus !== "unavailable";
  const pieces = fundedPieces(total, goal.targetRaw, achieved);
  const nextPiece = nextPieceProgress(total, goal.targetRaw);
  const financialProgress = Number(
    (BigInt(total) * 10000n) / BigInt(goal.targetRaw),
  );
  const positions = new Map(
    available ? state?.positions.map((position) => [position.network, position]) ?? [] : [],
  );
  const header = (
    <>
      <button className="live-back" type="button" onClick={back}>
        <ArrowLeft size={18} />
        Back to dashboard
      </button>
      <div className="page-heading">
        <div>
          <h1>{goal.name}</h1>
          <p>A build of your own, one deposit at a time.</p>
        </div>
        <Button variant="secondary" onClick={refresh} disabled={busy || refreshing} busy={refreshing}>
          <RefreshCw size={18} />
          Refresh
        </Button>
      </div>
    </>
  );
  if (refreshing && (!available || !state))
    return <>{header}<LoadingState message="Loading your goal…" description="We’re getting the latest savings for this goal." /></>;
  return (
    <>
      {header}
      {refreshing && <p className="live-help" role="status">Updating balances. Showing the last verified read until the update finishes.</p>}
      <div className="live-detail-grid">
        <div className="goal-workshop-column">
          {available ? (
            <WorkshopBoundary>
              <Suspense
                fallback={
                  <div className="workshop workshop-skeleton">
                    <Box />
                    <p>Opening your workshop…</p>
                  </div>
                }
              >
                <CarWorkshop
                  key={`live:${goal.id}:${goal.model}`}
                  model={goal.model}
                  goalId={`live:${goal.id}`}
                  funded={pieces}
                  achieved={achieved}
                  reducedMotion={reducedMotion}
                  nextPiece={achieved ? undefined : nextPiece}
                />
              </Suspense>
            </WorkshopBoundary>
          ) : (
            <div className="workshop workshop-skeleton">
              <TriangleAlert size={28} />
              <h2>Your build is waiting for a fresh read</h2>
              <p>
                We couldn’t verify this goal’s balances on its networks. Your saved build and goal are preserved. Check your connection, then retry the balance read.
              </p>
              <Button variant="secondary" onClick={refresh} disabled={busy}>
                Refresh balance
              </Button>
            </div>
          )}
        </div>
        <aside className="live-financial-rail">
          <section className="live-panel goal-financial-summary">
            <span className="live-state-badge">
              <LockKeyhole size={14} />
              {goal.chainStatus === "unavailable"
                ? "Read unavailable"
                : phases[state?.phase ?? "unprovisioned"]}
            </span>
            <p className="live-balance">
              {goal.chainStatus === "unavailable"
                ? "—"
                : `$${formatUsdc(total)}`}
            </p>
            <span className="live-target">
              {state?.phase === "claimed" ? "Total collected" : "Total funded"} · Target ${formatUsdc(goal.targetRaw)} USDC
            </span>
            {available && BigInt(total) > BigInt(goal.targetRaw) && <p className="live-help">You saved beyond your target. Progress is capped at 100%; the full amount is included.</p>}
            {available &&
              !achieved &&
              BigInt(total) >= BigInt(goal.targetRaw) && (
                <p className="live-help">
                  Target funded. The final piece is placed after completion is
                  verified and delivered to your vaults.
                </p>
              )}
            {available && (
              <div className="goal-progress" aria-hidden="true">
                {Array.from({ length: 100 }, (_, index) => (
                  <i
                    key={index}
                    className={index < pieces ? "is-filled" : ""}
                  />
                ))}
              </div>
            )}
            <div className="live-amounts">
              <span>Goal progress</span>
              <strong>
                {available
                  ? `${Math.min(10000, financialProgress) / 100}%`
                  : "—"}
              </strong>
            </div>
            <div className="live-amounts">
              <span>Claimed</span>
              <strong>
                {available
                  ? `$${formatUsdc(state?.totalClaimedRaw ?? "0")}`
                  : "—"}
              </strong>
            </div>
            {!available ? (
              <p className="live-help">
                The current chain state could not be read. Refresh before taking
                a financial action.
              </p>
            ) : !goal.binding.initialized && setup ? (
              <div className="live-form">
                <p>Finish setting up the vaults on your selected chains. Your wallet will confirm each remaining transaction.</p>
                <Button variant="build" disabled={busy} onClick={setup}>Continue setup</Button>
              </div>
            ) : !goal.binding.initialized ? (
              <>
                <p className="live-help">
                  Create each EVM vault first, then initialize the Solana goal.
                  Each action opens your wallet.
                </p>
                <div className="live-form">
                  {goal.binding.participants
                    .filter((participant) => !participant.vault)
                    .map((participant) => (
                      <Button
                        key={participant.network}
                        variant="build"
                        disabled={busy}
                        onClick={() =>
                          step("create-vault", participant.network)
                        }
                      >
                        Create {networks[participant.network]} vault
                      </Button>
                    ))}
                  <Button
                    variant="build"
                    disabled={busy || !goal.binding.participants.every(participant => participant.vault && participant.configHash)}
                    onClick={() => step("initialize", "solana")}
                  >
                    Initialize Solana goal
                  </Button>
                  {!goal.binding.participants.every(participant => participant.vault && participant.configHash) &&
                    <p className="live-help">Solana setup becomes available after the selected EVM vaults are created and verified.</p>}
                </div>
              </>
            ) : !state?.linked ? (
              <p className="live-help">
                Your vaults are being linked through LayerZero. Wait for the
                registration messages before adding funds.
              </p>
            ) : !achieved ? (
              <div className="live-form">
                <Button
                  variant="build"
                  disabled={
                    busy ||
                    goal.chainStatus !== "available" ||
                    state.phase !== "saving"
                  }
                  onClick={deposit}
                >
                  <Plus size={18} />
                  Add savings
                </Button>
                {state?.canPrepare && (
                  <Button
                    disabled={busy}
                    onClick={() => step("prepare", "solana")}
                  >
                    Prepare completion
                  </Button>
                )}
                {state?.phase === "preparing" && (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => step("abort", "solana")}
                  >
                    Return to saving
                  </Button>
                )}
              </div>
            ) : state?.phase === "claimed" ? (
              <p className="live-help">
                All savings have been collected. Your completed goal stays here. Assemble or replay its funded pieces anytime.
              </p>
            ) : (
              <p className="live-help">
                Your goal is achieved. Claim each chain’s available savings
                below after its completion message arrives.
              </p>
            )}
          </section>
          <section className="live-panel goal-chain-panel">
            <h2>Where your pieces are</h2>
            {available && state && <ChainAllocation positions={state.positions} />}
            <div className="network-list">
              {(
                [
                  "solana",
                  ...goal.binding.participants.map(
                    (participant) => participant.network,
                  ),
                ] as AppNetwork[]
              ).map((network) => {
                const position = positions.get(network);
                const vault = network === "solana"
                  ? goal.binding.initialized ? goal.binding.solanaCash : undefined
                  : goal.binding.participants.find(participant => participant.network === network)?.vault;
                return (
                  <div key={network} className="network-row">
                    <div className="network-row-name">
                      <NetworkMark network={network} />
                      <div>
                        <strong>{networks[network]}</strong>
                        <small>
                          {position?.initialized
                            ? BigInt(position.claimedRaw) > 0n && BigInt(position.assetsRaw) === 0n
                              ? "Collected"
                              : position.phase === "achieved"
                              ? "Unlocked"
                              : "Goal-locked"
                            : available
                              ? "Setup pending"
                              : "Read unavailable"}
                        </small>
                      </div>
                    </div>
                    <div className="network-row-value">
                      {position ? `$${formatUsdc(position.assetsRaw)}` : "—"}
                      <span>Cash USDC</span>
                      {position && BigInt(position.claimableRaw) > 0n && (
                        <Button
                          variant="quiet"
                          disabled={busy || !state?.claimable}
                          onClick={() =>
                            step("claim", network, position.claimableRaw)
                          }
                        >
                          Claim
                        </Button>
                      )}
                    </div>
                    <VaultAddress network={network} address={vault} />
                  </div>
                );
              })}
            </div>
          </section>
          <section className="live-panel goal-commitment-panel">
            <div className="live-actions">
              <LockKeyhole size={20} />
              <strong>A commitment to this goal</strong>
            </div>
            <p className="live-help">
              Funds stay locked until this goal’s target is reached. Other goals
              and your wallet balance do not count. No deadline guarantees an
              unlock.
            </p>
            <details className="goal-completion-help">
              <summary>How your savings unlock</summary>
              <ol className="live-help">
                <li>Save until this goal reaches its own target.</li>
                <li>Choose Prepare completion. NabungFi verifies the goal and delivers completion messages to its vaults.</li>
                <li>Claim savings on each chain when its completion message arrives. Each claim needs your wallet confirmation.</li>
              </ol>
              <p className="live-help">If a chain is still waiting, refresh its status. Arrival times can differ; a delay doesn’t send a new transaction or change your target.</p>
            </details>
          </section>
        </aside>
        <section ref={activityRef} id="goal-activity" tabIndex={-1} className="live-panel goal-history-panel" aria-label="Goal activity">
          <h2>Goal activity</h2>
          <HistoryList history={history} />
        </section>
      </div>
    </>
  );
}

export function HistoryList({ history }: { history: GoalHistoryEntry[] }) {
  if (!history.length)
    return (
      <p className="live-help">
        Confirmed, pending, and failed wallet steps will appear here.
      </p>
    );
  return (
    <div className="live-timeline">
      {history.map((entry) => {
        const timestamp = new Date(entry.createdAt);
        const validDate = Number.isFinite(timestamp.getTime());
        return (
          <div className="live-timeline-row" key={entry.id}>
            <div>
              <strong>{actions[entry.action]}</strong>
              <p>
                {networks[entry.network]} · {entry.status}
                {entry.amountRaw ? ` · ${formatUsdc(entry.amountRaw)} USDC` : ""}
              </p>
              <time className="live-timeline-date" dateTime={validDate ? entry.createdAt : undefined}>
                {validDate ? activityDateFormat.format(timestamp) : "Date unavailable"}
              </time>
            </div>
            {entry.transactionHash && (
              <a
                href={
                  entry.network === "solana"
                    ? `https://explorer.solana.com/tx/${entry.transactionHash}?cluster=devnet`
                    : `${EVM_DEPLOYMENTS[entry.network].explorer}/tx/${entry.transactionHash}`
                }
                target="_blank"
                rel="noreferrer"
              >
                View transaction
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CreateGoalModal({
  wallets,
  availableModels = GOAL_TEMPLATES.map(template=>template.id),
  busy,
  onClose,
  create,
  blockedReason,
}: {
  wallets: SessionDTO["user"]["wallets"];
  availableModels?: GoalModel[];
  busy: boolean;
  onClose: () => void;
  create: (body: CreateGoalRequest) => Promise<void>;
  blockedReason?: string;
}) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [model, setModel] = useState<GoalModel>("car");
  useEffect(() => { if (!availableModels.includes(model) && availableModels[0]) setModel(availableModels[0]); }, [availableModels, model]);
  const [solanaOwner, setSolanaOwner] = useState(
    () =>
      wallets.find((wallet) => wallet.chainType === "solana")?.address ?? "",
  );
  const [evmOwner, setEvmOwner] = useState(
    () =>
      wallets.find((wallet) => wallet.chainType === "ethereum")?.address ?? "",
  );
  const [chains, setChains] = useState<AppNetwork[]>(["solana", "base"]);
  const selectedChains = new Set(chains);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submitFlight = useRef(false);
  const waiting = busy || submitting;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (waiting || blockedReason || submitFlight.current) return;
    setError("");
    try {
      rawAmount(target);
      if (!name.trim() || !accepted || !solanaOwner || !evmOwner || !availableModels.includes(model))
        throw new Error(
          "Name your goal, choose both verified owner wallets, and confirm the lock rules.",
        );
      submitFlight.current = true;
      setSubmitting(true);
      await create({
        name: name.trim(),
        targetAmount: decimalAmount(rawAmount(target)),
        model,
        solanaOwner,
        evmOwner,
        chains,
      });
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Your goal could not be created.",
      );
    } finally {
      submitFlight.current = false;
      setSubmitting(false);
    }
  };
  if (waiting) return (
    <Dialog title="Creating your goal" onClose={onClose}>
      <LoadingState message="Creating your goal…" description="We’re preparing your new goal. Please wait a moment." />
    </Dialog>
  );
  return (
    <Dialog
      title="What are you building toward?"
      description="Choose your goal and chains. We’ll set up the selected vaults next, with each transaction confirmed in your wallet. This workshop uses testnet USDC; earning is currently inactive."
      onClose={onClose}
    >
      <form className="live-form" onSubmit={(event) => void submit(event)}>
        <label className="live-field">
          Goal name
          <input
            value={name}
            maxLength={80}
            placeholder="My next car"
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        <label className="live-field">
          Target in USDC
          <input
            inputMode="decimal"
            value={target}
            placeholder="10000"
            onChange={(event) => setTarget(event.target.value)}
            required
          />
          <small>This target is immutable once the goal is created.</small>
        </label>
        <label className="live-field">
          Build model
          <select
            aria-label="Build model"
            value={model}
            onChange={(event) => setModel(event.target.value as GoalModel)}
          >
            {GOAL_TEMPLATES.filter(template=>availableModels.includes(template.id)).map(template=><option key={template.id} value={template.id}>{template.label}</option>)}
          </select>
        </label>
        <div className="live-model-preview">
          <GoalIllustration model={model} compact priority />
          <p className="live-help">{GOAL_TEMPLATES.find(template=>template.id===model)?.label} · 100 pieces</p>
        </div>
        <label className="live-field">
          Solana owner
          <select
            value={solanaOwner}
            onChange={(event) => setSolanaOwner(event.target.value)}
            required
          >
            <option value="">Link a Solana wallet first</option>
            {wallets
              .filter((wallet) => wallet.chainType === "solana")
              .map((wallet) => (
                <option key={wallet.address} value={wallet.address}>
                  {short(wallet.address)}
                </option>
              ))}
          </select>
        </label>
        <label className="live-field">
          EVM owner
          <select
            value={evmOwner}
            onChange={(event) => setEvmOwner(event.target.value)}
            required
          >
            <option value="">Link an EVM wallet first</option>
            {wallets
              .filter((wallet) => wallet.chainType === "ethereum")
              .map((wallet) => (
                <option key={wallet.address} value={wallet.address}>
                  {short(wallet.address)}
                </option>
              ))}
          </select>
        </label>
        <fieldset className="live-field">
          <legend>Goal chains</legend>
          <small>Solana keeps this goal’s progress in sync. Choose at least one other chain for your deposits.</small>
          <div className="network-choices">
            {Object.keys(networks).map((key) => {
              const network = key as AppNetwork;
              return (
                <label className="network-choice" key={network}>
                  <input
                    type="checkbox"
                    checked={selectedChains.has(network)}
                    disabled={network === "solana"}
                    onChange={(event) =>
                      setChains((prior) =>
                        event.target.checked
                          ? [...prior, network]
                          : prior.filter((item) => item !== network),
                      )
                    }
                  />
                  {networks[network]}
                </label>
              );
            })}
          </div>
        </fieldset>
        <label className="live-check">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
          />
          I understand deposits stay locked until this goal reaches its target,
          even if that takes indefinitely. Earning is currently inactive.
        </label>
        {error && <FormError>{error}</FormError>}
        {blockedReason && <p className="live-help" role="status">{blockedReason}</p>}
        <Button
          type="submit"
          variant="build"
          busy={busy}
          disabled={Boolean(blockedReason) || !accepted || chains.length < 2 || !solanaOwner || !evmOwner}
        >
          Create goal
          <ArrowRight size={18} />
        </Button>
      </form>
    </Dialog>
  );
}

export function DepositModal({
  goal,
  initial,
  onClose,
  plan,
}: {
  goal: GoalDTO;
  initial?: { network: AppNetwork; amountRaw: string };
  onClose: () => void;
  plan: (network: AppNetwork, amount: string, approve: boolean) => void;
}) {
  const [network, setNetwork] = useState<AppNetwork>(
    initial?.network ?? "solana",
  );
  const [amount, setAmount] = useState(
    initial ? decimalAmount(initial.amountRaw) : "",
  );
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const submit = (approve: boolean) => {
    try {
      setError("");
      if (!accepted)
        throw new Error("Confirm the goal lock before continuing.");
      const raw = rawAmount(amount);
      if (!position || goal.chainStatus !== "available")
        throw new Error("Refresh the goal to read your wallet balance first.");
      if (BigInt(raw) > BigInt(position.walletUsdcRaw))
        throw new Error(
          "This amount exceeds your USDC balance on the selected chain.",
        );
      if (BigInt(position.nativeBalanceRaw) === 0n)
        throw new Error(
          `Add testnet ${network === "solana" ? "SOL" : "ETH"} to this owner wallet for transaction fees first.`,
        );
      plan(network, raw, approve);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Enter a valid amount.",
      );
    }
  };
  const position = goal.chainState?.positions.find(
    (candidate) => candidate.network === network,
  );
  return (
    <Dialog
      title={`Add pieces to ${goal.name}`}
      description="Choose the chain holding your USDC. Nothing moves until you confirm the exact transaction in your wallet."
      onClose={onClose}
    >
      <div className="live-form">
        <label className="live-field">
          From chain
          <select
            value={network}
            onChange={(event) => setNetwork(event.target.value as AppNetwork)}
          >
            {(
              [
                "solana",
                ...goal.binding.participants.map(
                  (participant) => participant.network,
                ),
              ] as AppNetwork[]
            ).map((candidate) => (
              <option key={candidate} value={candidate}>
                {networks[candidate]}
              </option>
            ))}
          </select>
        </label>
        <p className="live-help">
          Owner wallet balance:{" "}
          {position
            ? `${formatUsdc(position.walletUsdcRaw)} USDC`
            : "Read unavailable"}
        </p>
        <p className="live-help">
          Gas token balance:{" "}
          {position
            ? formatNativeGas(position.nativeBalanceRaw, network)
            : "Read unavailable"}
          . Your wallet shows the exact fee before confirmation.
        </p>
        <label className="live-field">
          Amount in USDC
          <input
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="25"
          />
        </label>
        <label className="live-check">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
          />
          This deposit belongs only to {goal.name} and stays locked until its
          target is reached.
        </label>
        {error && <FormError>{error}</FormError>}
        {network !== "solana" && (
          <>
            <p className="live-help">
              Approval and deposit are separate wallet confirmations. If you
              have not approved this vault for this amount, complete step 1
              first. Approval alone does not add savings.
            </p>
            <Button
              variant="secondary"
              disabled={!accepted}
              onClick={() => submit(true)}
            >
              1. Review exact approval
            </Button>
          </>
        )}
        <Button
          variant="build"
          disabled={!accepted || !position}
          onClick={() => submit(false)}
        >
          {network === "solana" ? "Review deposit" : "2. Review deposit"}
          <ArrowRight size={18} />
        </Button>
      </div>
    </Dialog>
  );
}

export function WalletStepModal({
  step,
  recovery,
  busy,
  offline,
  onClose,
  confirm,
  refreshPlan,
  setupName,
}: {
  step: GoalStepDTO;
  recovery?: WalletRecovery;
  busy: boolean;
  offline: boolean;
  onClose: () => void;
  confirm: () => void;
  refreshPlan: () => void;
  setupName?: string;
}) {
  const plan = step.plan;
  const [clock, setClock] = useState(Date.now);
  useEffect(() => {
    if (!plan) return;
    const timeout = window.setTimeout(
      () => setClock(Date.now()),
      Math.max(0, new Date(plan.expiresAt).getTime() - Date.now() + 1),
    );
    return () => window.clearTimeout(timeout);
  }, [plan?.expiresAt]);
  const canSign =
    recovery?.state === "planned" &&
    plan &&
    new Date(plan.expiresAt).getTime() > Math.max(clock, Date.now());
  // A native modal makes the SDK's body portal inert and covers it in the top layer.
  // Release the review during handoff; the controller retains the original request.
  if (busy) return null;
  return (
    <Dialog
      title={actions[step.action]}
      description={plan?.gasPayment ? "Review this step before your wallet opens. NabungFi requests testnet gas sponsorship; your wallet still asks for confirmation." : "Review this step before your wallet opens. The wallet will show network fees and ask for your confirmation."}
      onClose={onClose}
    >
      <div className="live-form">
        <dl className="live-transaction-details">
          {setupName && <div><dt>Goal setup</dt><dd>{setupName}</dd></div>}
          <div>
            <dt>Network</dt>
            <dd>{networks[step.network]}</dd>
          </div>
          <div>
            <dt>Action</dt>
            <dd>{actions[step.action]}</dd>
          </div>
          {step.amountRaw && (
            <div>
              <dt>Amount</dt>
              <dd>{formatUsdc(step.amountRaw)} USDC</dd>
            </div>
          )}
          {plan && (
            <>
              <div><dt>Network fee</dt><dd>{plan.gasPayment ? "Sponsored by NabungFi" : "Paid by your wallet"}</dd></div>
              <div>
                <dt>Owner</dt>
                <dd className="address">{plan.owner}</dd>
              </div>
              <div>
                <dt>Goal ID</dt>
                <dd className="address">{step.goalId}</dd>
              </div>
              {plan.transaction.kind === "evm" && (
                <div>
                  <dt>Contract</dt>
                  <dd className="address">{plan.transaction.to}</dd>
                </div>
              )}
              <div>
                <dt>Plan expires</dt>
                <dd>{new Date(plan.expiresAt).toLocaleTimeString()}</dd>
              </div>
            </>
          )}
        </dl>
        {step.action === "approve" && (
          <p className="live-help">
            This approval permits only the exact amount shown. It does not
            deposit funds.
          </p>
        )}
        {plan?.gasPayment && step.network === "solana" && step.action === "initialize" && <p className="live-help">Solana account creation can still require SOL for rent. Network fee sponsorship does not change your goal’s account funding.</p>}
        {!canSign && (
          <p className="live-help">
            This request already started or its plan expired. Keep its original
            identity and check it from the recovery panel.
          </p>
        )}
        {!canSign && recovery?.state === "planned" && plan && (
          <Button
            variant="secondary"
            busy={busy}
            disabled={offline}
            onClick={refreshPlan}
          >
            Refresh unsigned plan
          </Button>
        )}
        <Button
          variant="build"
          busy={busy}
          disabled={!canSign || offline}
          onClick={confirm}
        >
          Confirm in wallet
          <Wallet size={18} />
        </Button>
        <Button variant="quiet" disabled={busy} onClick={onClose}>
          {recovery?.state === "planned" ? "Cancel unsigned step" : "Close review"}
        </Button>
      </div>
    </Dialog>
  );
}

export function RecoveryPanel({
  recoveries,
  requests,
  busy,
  offline,
  reconcile,
  retry,
  resume,
  closeUnsent,
  cancelUnsigned,
  resolveExpired,
}: {
  recoveries: WalletRecovery[];
  requests: PendingApiRequest[];
  busy: boolean;
  offline: boolean;
  reconcile: (record: WalletRecovery, hash?: string) => Promise<void>;
  retry: (record: PendingApiRequest) => Promise<void>;
  resume: (record: WalletRecovery) => Promise<void>;
  closeUnsent: (record: WalletRecovery) => Promise<void>;
  cancelUnsigned?: (record: WalletRecovery) => Promise<void>;
  resolveExpired: (record: WalletRecovery) => Promise<void>;
}) {
  const [hashes, setHashes] = useState<Record<string, string>>({});
  const [notInvoked, setNotInvoked] = useState<Record<string, boolean>>({});
  return (
    <section className="live-panel recovery-panel">
      <h2>{requests.length === 0 && recoveries.every(record => record.state === "planned") ? "A saved step is waiting for your review" : "Check your original request"}</h2>
      <p className="live-help">
        {requests.length === 0 && recoveries.every(record => record.state === "planned") ? "Wallet confirmation hasn’t started. Review the step to continue, or cancel it to resume other actions. Your goal stays saved." : "Check the original request before starting another transaction. An interrupted response doesn’t prove that it failed."}
      </p>
      {requests.map((record) => (
        <div className="recovery-row" key={record.requestId}>
          <div>
            <strong>
              Saved{" "}
              {record.path === "/api/goals"
                ? "goal creation"
                : "transaction plan"}{" "}
              request
            </strong>
            <p>
              Resumes the same request ID. It does not sign a wallet
              transaction.
            </p>
          </div>
          <Button
            variant="secondary"
            busy={busy}
            disabled={offline}
            onClick={() => void retry(record)}
          >
            Recover request
          </Button>
        </div>
      ))}
      {recoveries.map((record) => (
        <div key={record.stepId} className="recovery-row">
          <div>
            <strong>
              {actions[record.action as GoalStepAction]} ·{" "}
              {networks[record.network as AppNetwork]}
            </strong>
            <p>
              {record.transactionHash
                ? short(record.transactionHash)
                : record.state === "planned"
                  ? "Wallet confirmation has not started."
                  : "Wallet request started; inspect its outcome before proceeding."}
            </p>
            {!record.transactionHash && record.state !== "planned" && (
              <label className="live-field">
                Original transaction hash
                <input
                  value={hashes[record.stepId] ?? ""}
                  onChange={(event) =>
                    setHashes((prior) => ({
                      ...prior,
                      [record.stepId]: event.target.value.trim(),
                    }))
                  }
                />
              </label>
            )}
            {!record.transactionHash && record.state === "awaiting-wallet" && (
              <label className="live-consent">
                <input type="checkbox" checked={notInvoked[record.stepId] ?? false} disabled={busy}
                  onChange={event => setNotInvoked(prior => ({...prior,[record.stepId]:event.target.checked}))} />
                My wallet never reached approval for this original request. No approval or signing was attempted.
              </label>
            )}
          </div>
          {record.state === "planned" ? (
            <div className="live-actions"><Button
              variant="secondary"
              busy={busy}
              disabled={offline}
              onClick={() => void resume(record)}
            >
              Review saved step
            </Button>
            {cancelUnsigned && <Button variant="quiet" busy={busy} disabled={offline} onClick={() => void cancelUnsigned(record)}>Cancel unsigned step</Button>}
            </div>
          ) : (
            <div className="live-actions">
              {!record.transactionHash && (
                <Button
                  variant="secondary"
                  busy={busy}
                  disabled={offline}
                  onClick={() => void resume(record)}
                >
                  Inspect original step
                </Button>
              )}
              <Button
                variant="secondary"
                busy={busy}
                disabled={
                  offline || (!record.transactionHash && !hashes[record.stepId])
                }
                onClick={() => void reconcile(record, hashes[record.stepId])}
              >
                Check original transaction
              </Button>
              {!record.transactionHash && record.state === "awaiting-wallet" && (
                <Button variant="quiet" busy={busy} disabled={offline || !notInvoked[record.stepId] || Boolean(hashes[record.stepId])}
                  onClick={() => void closeUnsent(record)}>
                  Close unsent request
                </Button>
              )}
              {!record.transactionHash && !record.gasPayment && record.network === "solana" && record.state === "awaiting-wallet" && (
                <Button variant="secondary" busy={busy} disabled={offline} onClick={() => void resolveExpired(record)}>
                  Check expired Solana request
                </Button>
              )}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
