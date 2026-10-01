import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  FlaskConical,
  History,
  Info,
  LockKeyhole,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sprout,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  chainNames,
  money,
  remainingLabel,
  progressLabel,
  readPendingAction,
  persistPendingAction,
  clearPendingAction,
  RequestError,
  requestState,
  validAmount,
  type AppState,
  type Chain,
  type Goal,
  type GoalStatus,
  type PendingAction,
} from "./api";
import {
  Button,
  ChainMark,
  Dialog,
  IconButton,
  Logo,
  WorkshopBoundary,
} from "./ui";

const CarWorkshop = lazy(() => import("./CarWorkshop"));
type Modal = "deposit" | "create" | "how" | "demo" | "claim" | null;
const statusLabels: Record<GoalStatus, string> = {
  saving: "In progress",
  preparing: "Preparing funds",
  ready: "Ready to complete",
  achieved: "Goal achieved",
  closed: "Collected",
};
const activityDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function useReducedMotion() {
  const [enabled, setEnabled] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const match = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = () => setEnabled(match.matches);
    match.addEventListener("change", listener);
    return () => match.removeEventListener("change", listener);
  }, []);
  return [enabled, setEnabled] as const;
}

function GoalStatusPanel({
  goal,
  pending,
  act,
}: {
  goal: Goal;
  pending: boolean;
  act: (action: string, fields?: Record<string, unknown>) => Promise<boolean>;
}) {
  if (goal.status === "closed")
    return (
      <div className="lifecycle-message lifecycle-message--success">
        <Check size={20} />
        <div>
          <strong>Goal collected</strong>
          <p>
            Your completed build stays yours. All funds from this goal have been
            collected.
          </p>
        </div>
      </div>
    );
  if (goal.achieved)
    return (
      <div className="lifecycle-message lifecycle-message--success">
        <ShieldCheck size={20} />
        <div>
          <strong>You made it.</strong>
          <p>
            Your goal is verified. Each chain is now unlocked for collection.
          </p>
        </div>
      </div>
    );
  if (goal.status === "ready")
    return (
      <div className="lifecycle-message">
        <ShieldCheck size={20} />
        <div>
          <strong>
            {goal.progress >= 100
              ? "Your funds are ready"
              : "A little more to go"}
          </strong>
          <p>
            {goal.progress >= 100
              ? "Both chains have reserved the full amount. Complete your goal to unlock collection."
              : "Your actual reserved funds are below the target. Return to saving to add the remaining amount."}
          </p>
          <div className="cluster">
            {goal.progress >= 100 && (
              <Button
                variant="secondary"
                busy={pending}
                onClick={() => void act("finalize")}
              >
                Complete goal
                <Check size={16} />
              </Button>
            )}
            <Button
              variant="quiet"
              disabled={pending}
              onClick={() => void act("abort")}
            >
              Return to saving
            </Button>
          </div>
        </div>
      </div>
    );
  if (goal.status === "preparing")
    return (
      <div className="lifecycle-message">
        <RefreshCw size={20} />
        <div>
          <strong>Preparing your funds</strong>
          <p>
            Some strategy funds are still waiting for liquidity. Your savings
            remain locked and accounted for.
          </p>
          <div className="cluster">
            <Button
              variant="secondary"
              busy={pending}
              onClick={() => void act("refresh")}
            >
              Check again
            </Button>
            <Button
              variant="quiet"
              disabled={pending}
              onClick={() => void act("abort")}
            >
              Return to saving
            </Button>
          </div>
        </div>
      </div>
    );
  if (goal.progress >= 100)
    return (
      <div className="lifecycle-message">
        <Sparkles size={20} />
        <div>
          <strong>You're at the finish line</strong>
          <p>
            Prepare the actual funds on both chains before placing your last
            piece.
          </p>
          <Button
            variant="secondary"
            busy={pending}
            onClick={() => void act("prepare")}
          >
            Prepare my funds
            <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    );
  return null;
}

function useNabungController() {
  const [data, setData] = useState<AppState | null>(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [activeTab, setActiveTab] = useState<"build" | "activity">("build");
  const [toast, setToast] = useState("");
  const [reducedMotion, setReducedMotion] = useReducedMotion();
  const [recovery, setRecovery] = useState<PendingAction | null>(
    readPendingAction,
  );
  const actionLock = useRef(false);
  const stateGeneration = useRef(0);
  const retryKey = useRef<PendingAction | null>(recovery);
  const announcement = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const load = useCallback(async () => {
    if (actionLock.current) return;
    const generation = ++stateGeneration.current;
    setLoading(true);
    setLoadError("");
    try {
      const state = await requestState();
      if (generation !== stateGeneration.current) return;
      setData(state);
      const unresolved = retryKey.current;
      if (
        unresolved &&
        state.transactions.some(
          (transaction) => transaction.id === unresolved.requestId,
        )
      ) {
        try {
          clearPendingAction(unresolved.requestId);
        } catch {
          /* The recorded receipt still proves completion. */
        }
        retryKey.current = readPendingAction();
        setRecovery(retryKey.current);
        setToast(
          "Your previous request was already recorded. The recovered balance is shown below.",
        );
      }
    } catch (cause) {
      if (generation !== stateGeneration.current) return;
      setLoadError(
        cause instanceof Error ? cause.message : "Could not load your goal.",
      );
    } finally {
      if (generation === stateGeneration.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    return () => clearTimeout(announcement.current);
  }, [load]);

  const act = async (action: string, fields: Record<string, unknown> = {}) => {
    if (actionLock.current) return false;
    retryKey.current ??= readPendingAction();
    setRecovery(retryKey.current);
    const signature = JSON.stringify({ action, ...fields });
    if (retryKey.current && retryKey.current.signature !== signature) {
      setError(
        "Recover your previous request before starting a different action. Its result may already have been recorded.",
      );
      return false;
    }
    actionLock.current = true;
    stateGeneration.current += 1;
    setLoading(false);
    setPending(true);
    setError("");
    const operation: PendingAction = retryKey.current ?? {
      signature,
      action,
      fields,
      requestId: crypto.randomUUID(),
      goalId: data?.goal?.id ?? null,
    };
    try {
      try {
        persistPendingAction(operation);
      } catch {
        throw new RequestError(
          "This browser cannot save a recovery record. Enable site storage before submitting a financial action.",
          true,
        );
      }
      retryKey.current = operation;
      setRecovery(operation);
      const state = await requestState(`/api/${action}`, {
        ...operation.fields,
        requestId: operation.requestId,
        goalId: operation.goalId,
      });
      setData(state);
      try {
        clearPendingAction(operation.requestId);
      } catch {
        /* GET reconciliation can clear the completed record later. */
      }
      retryKey.current = readPendingAction();
      setRecovery(retryKey.current);
      const messages: Record<string, string> = {
        deposit:
          "Deposit recorded. Your next pieces are waiting in the workshop.",
        prepare: "Completion preparation started.",
        finalize: "Goal achieved. Your final piece is ready to build.",
        claim: "Funds collected from this chain.",
        refresh: "Your goal status is up to date.",
        abort: "Back to saving. All funds remain locked.",
        "create-goal": "Your next chapter is ready.",
        "demo/reset": "Sample goal restored.",
        "demo/yield": "Simulated strategy change applied.",
        "demo/liquidity": "Demo liquidity updated.",
      };
      setToast(messages[action] ?? "Goal updated.");
      clearTimeout(announcement.current);
      announcement.current = setTimeout(() => setToast(""), 6000);
      if (action === "create-goal" || action === "demo/reset")
        setActiveTab("build");
      return true;
    } catch (cause) {
      if (cause instanceof RequestError && cause.rejected) {
        try {
          clearPendingAction(operation.requestId);
        } catch {
          /* No successful action was accepted. */
        }
        retryKey.current = readPendingAction();
        setRecovery(retryKey.current);
      }
      setError(
        cause instanceof Error
          ? cause.message
          : "This action could not be completed.",
      );
      return false;
    } finally {
      actionLock.current = false;
      setPending(false);
    }
  };
  const goal = data?.goal;
  const open = (next: Modal) => {
    setError("");
    setModal(next);
  };

  return {
    data,
    loadError,
    error,
    setError,
    loading,
    pending,
    modal,
    setModal,
    activeTab,
    setActiveTab,
    toast,
    setToast,
    reducedMotion,
    setReducedMotion,
    recovery,
    load,
    act,
    goal,
    open,
  };
}

export default function App() {
  const {
    data,
    loadError,
    error,
    setError,
    loading,
    pending,
    modal,
    setModal,
    activeTab,
    setActiveTab,
    toast,
    setToast,
    reducedMotion,
    setReducedMotion,
    recovery,
    load,
    act,
    goal,
    open,
  } = useNabungController();
  return (
    <div className="app" data-reduced-motion={reducedMotion}>
      <a href="#main" className="skip-link">
        Skip to your goal
      </a>
      <header className="header">
        <button
          aria-label="NabungFi home"
          className="brand-link"
          onClick={() => setActiveTab("build")}
        >
          <Logo />
        </button>
        <nav aria-label="Main navigation">
          <button
            className={activeTab === "build" ? "nav-link active" : "nav-link"}
            onClick={() => setActiveTab("build")}
          >
            My workshop
          </button>
          <button
            className={
              activeTab === "activity" ? "nav-link active" : "nav-link"
            }
            onClick={() => setActiveTab("activity")}
          >
            Activity
          </button>
          <button className="nav-link how-nav" onClick={() => open("how")}>
            How it works
            <ArrowUpRight size={14} />
          </button>
        </nav>
        <button className="demo-badge" onClick={() => open("demo")}>
          <span className="demo-dot" />
          <span className="demo-word-full">Local demo</span>
          <span className="demo-word-short">Demo</span>
          <span className="demo-badge-detail">· no real funds</span>
          <ChevronDown size={14} />
        </button>
      </header>
      <main id="main" className="main-content">
        {recovery && !pending && data && (
          <div className="lifecycle-message recovery-message" role="status">
            <Info size={20} />
            <div>
              <strong>A previous request needs recovery</strong>
              <p>
                Its response was interrupted. Retry the original request
                identity to find or finish the same action; no second deposit
                will be created.
              </p>
              <div className="cluster">
                <Button
                  variant="secondary"
                  busy={pending}
                  onClick={() => void act(recovery.action, recovery.fields)}
                >
                  Recover previous request
                </Button>
                <Button
                  variant="quiet"
                  busy={loading}
                  onClick={() => void load()}
                >
                  Check saved status
                </Button>
              </div>
            </div>
          </div>
        )}
        {loading && !data ? (
          <div className="page-state">
            <span className="loader-dot" />
            <h1>Opening your workshop</h1>
            <p>Loading your goal and its savings.</p>
          </div>
        ) : loadError && !data ? (
          <div className="page-state">
            <TriangleAlert size={32} />
            <h1>Let's reconnect</h1>
            <p>{loadError}</p>
            <Button onClick={() => void load()} busy={loading}>
              <RefreshCw size={18} />
              Try again
            </Button>
          </div>
        ) : !goal ? (
          <div className="empty-goal">
            <span className="empty-cube">
              <Box size={52} />
            </span>
            <p className="eyebrow">Something worth saving for</p>
            <h1>
              Your next big thing
              <br />
              starts small.
            </h1>
            <p>
              Pick a goal. Give it a number.
              <br />
              Bring it to life, one saved piece at a time.
            </p>
            <Button variant="build" onClick={() => open("create")}>
              <Plus size={18} />
              Create your first goal
            </Button>
          </div>
        ) : (
          <>
            <div className="page-title-row">
              <div>
                <div className="breadcrumb">
                  <span>My workshop</span>
                  <ChevronRight size={12} />
                  <span>
                    {activeTab === "activity"
                      ? "Activity"
                      : "Your current build"}
                  </span>
                </div>
                <h1>
                  {activeTab === "activity"
                    ? "Small steps. Real progress."
                    : goal.name}
                  <span className="title-period">.</span>
                </h1>
                <p className="page-intro">
                  {activeTab === "activity"
                    ? "Every move on the way to your next big thing."
                    : "Build what you’re saving for. One piece at a time."}
                </p>
              </div>
              <div className="page-title-actions">
                <span
                  className={`status-badge ${goal.achieved ? "status-badge--success" : ""}`}
                >
                  <span className="status-dot" />
                  {statusLabels[goal.status]}
                </span>
                {goal.status === "closed" && (
                  <Button variant="secondary" onClick={() => open("create")}>
                    <Plus size={16} />
                    New goal
                  </Button>
                )}
              </div>
            </div>
            {error && !modal && (
              <div className="inline-error" role="alert">
                <TriangleAlert size={18} />
                <span>{error}</span>
                <IconButton label="Dismiss error" onClick={() => setError("")}>
                  <X size={16} />
                </IconButton>
              </div>
            )}
            {activeTab === "build" ? (
              <div className="goal-layout">
                <div className="build-column">
                  <WorkshopBoundary>
                    <Suspense
                      fallback={
                        <div className="workshop workshop-skeleton">
                          <span className="loader-dot" />
                          <p>Setting up your 3D workshop…</p>
                        </div>
                      }
                    >
                      <CarWorkshop
                        key={`${goal.id}:${goal.fundedPieces}`}
                        goalId={goal.id}
                        funded={goal.fundedPieces}
                        achieved={goal.achieved}
                        reducedMotion={reducedMotion}
                      />
                    </Suspense>
                  </WorkshopBoundary>
                  <div className="under-stage">
                    <div>
                      <span className="under-stage-icon">
                        <Sprout size={19} />
                      </span>
                      <p>
                        <strong>Let small steps add up.</strong> Your savings
                        and net earnings both build your goal.
                      </p>
                    </div>
                    <button className="text-button" onClick={() => open("how")}>
                      The idea behind it
                      <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <GoalStatusPanel goal={goal} pending={pending} act={act} />
                </div>
                <SavingsRail goal={goal} open={open} />
              </div>
            ) : (
              <TransactionHistory data={data!} expanded />
            )}
            {activeTab === "build" && (
              <TransactionHistory
                data={data!}
                onViewAll={() => setActiveTab("activity")}
              />
            )}
          </>
        )}
        <footer className="footer">
          <span>Little by little. Something wonderful.</span>
          <div>
            <button
              onClick={() => setReducedMotion((value) => !value)}
              aria-pressed={reducedMotion}
            >
              <Settings2 size={14} />
              {reducedMotion ? "Reduced motion on" : "Motion settings"}
            </button>
            <button onClick={() => open("how")}>
              <CircleHelp size={14} />
              About NabungFi
            </button>
          </div>
        </footer>
      </main>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          <span>{toast}</span>
          <IconButton label="Dismiss notification" onClick={() => setToast("")}>
            <X size={15} />
          </IconButton>
        </div>
      )}
      {modal === "deposit" && goal && (
        <DepositModal
          goal={goal}
          busy={pending}
          error={error}
          onClose={() => setModal(null)}
          act={act}
        />
      )}
      {modal === "create" && (
        <CreateModal
          busy={pending}
          error={error}
          onClose={() => setModal(null)}
          act={act}
        />
      )}
      {modal === "how" && <HowModal onClose={() => setModal(null)} />}
      {modal === "demo" && (
        <DemoModal
          data={data}
          busy={pending}
          error={error}
          onClose={() => setModal(null)}
          act={act}
        />
      )}
      {modal === "claim" && goal && (
        <ClaimModal
          goal={goal}
          busy={pending}
          error={error}
          onClose={() => setModal(null)}
          act={act}
        />
      )}
    </div>
  );
}

function SavingsRail({
  goal,
  open,
}: {
  goal: Goal;
  open: (modal: Modal) => void;
}) {
  return (
    <aside className="savings-rail" aria-label="Goal savings details">
      <section className="savings-panel">
        <div className="panel-label">
          <span>{goal.achieved ? "Remaining to collect" : "Saved so far"}</span>
          <span className="asset-pill">
            <span>＄</span>USDC
          </span>
        </div>
        <div className="total-balance" title={`${goal.balance} USDC`}>
          <span>$</span>
          {money(goal.balance)}
        </div>
        <p className="target-caption">
          {goal.achieved ? (
            "Your goal is complete. Claim each local balance."
          ) : (
            <>
              of{" "}
              <strong>
                $
                {money(goal.target, {
                  decimals: Number(goal.target) < 1 ? 6 : 2,
                })}
              </strong>{" "}
              goal
            </>
          )}
        </p>
        <div
          className="progress-track"
          role="progressbar"
          aria-valuenow={Math.min(goal.progress, 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Savings progress"
        >
          <span
            style={{
              transform: `scaleX(${Math.min(goal.progress, 100) / 100})`,
            }}
          />
        </div>
        <div className="progress-labels">
          <strong>
            {progressLabel(goal)}% {goal.achieved ? "achieved" : "there"}
          </strong>
          <span>
            {goal.achieved
              ? "A promise kept"
              : `$${remainingLabel(goal)} to go`}
          </span>
        </div>
        <div className="financial-split">
          <div>
            <span>Your contributions</span>
            <strong>${money(goal.principal)}</strong>
          </div>
          <div>
            <span>
              <Sprout size={14} />
              Net earnings
            </span>
            <strong
              className={
                Number(goal.earnings) >= 0
                  ? "earnings-positive"
                  : "earnings-negative"
              }
            >
              {Number(goal.earnings) >= 0 ? "+" : "−"}$
              {money(String(Math.abs(Number(goal.earnings))))}
            </strong>
          </div>
        </div>
        {goal.achieved ? (
          <Button
            className="full-width"
            onClick={() => open("claim")}
            disabled={goal.status === "closed"}
          >
            <ArrowDownLeft size={18} />
            {goal.status === "closed"
              ? "All funds collected"
              : "Collect my savings"}
          </Button>
        ) : (
          <Button
            className="full-width"
            onClick={() => open("deposit")}
            disabled={goal.status !== "saving"}
          >
            <Plus size={18} />
            Add to savings
          </Button>
        )}
        <div className="lock-note">
          <LockKeyhole size={14} />
          <span>
            {goal.achieved
              ? "Achievement stays unlocked after collection."
              : "Locked until your goal is reached. No deadline."}
          </span>
        </div>
      </section>
      <section className="chain-panel">
        <div className="section-heading">
          <h2>Growing across chains</h2>
          <span>2 networks</span>
        </div>
        <div className="chain-rows">
          {goal.chains.map((position) => (
            <div className="chain-row" key={position.chain}>
              <ChainMark chain={position.chain} />
              <div className="chain-description">
                <strong>{position.label}</strong>
                <span>
                  {position.chain === "solana"
                    ? "Kamino Supply"
                    : "Aave V3 Supply"}
                </span>
              </div>
              <div className="chain-amount">
                <strong>${money(position.balance)}</strong>
                <span>
                  {goal.achieved
                    ? Number(position.reserved) > 0
                      ? "Ready to collect"
                      : "Collected"
                    : Number(position.reserved) > 0
                      ? "Funds reserved"
                      : "Earning strategy"}
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="chain-disclosure">
          <Info size={13} />
          Strategies are simulated in this local demo.
        </p>
        <button
          className="text-button chain-detail-link"
          onClick={() => open("demo")}
        >
          View demo & evidence
          <ArrowUpRight size={14} />
        </button>
      </section>
    </aside>
  );
}

type ActionProps = {
  busy: boolean;
  error: string;
  onClose: () => void;
  act: (action: string, fields?: Record<string, unknown>) => Promise<boolean>;
};

function DepositModal({
  goal,
  busy,
  error,
  onClose,
  act,
}: ActionProps & { goal: Goal }) {
  const [chain, setChain] = useState<Chain>("solana");
  const [amount, setAmount] = useState("100");
  const [understood, setUnderstood] = useState(false);
  const [validation, setValidation] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validAmount(amount)) {
      setValidation(
        "Enter a positive USDC amount with up to 6 decimal places.",
      );
      return;
    }
    if (!understood) {
      setValidation(
        "Confirm you understand the goal lock before adding funds.",
      );
      return;
    }
    if (await act("deposit", { chain, amount })) onClose();
  };
  return (
    <Dialog
      title="A little closer."
      description={`Add to “${goal.name}”. Every contribution counts toward your next piece.`}
      onClose={onClose}
    >
      <form onSubmit={(event) => void submit(event)}>
        <fieldset className="chain-picker">
          <legend>Save on</legend>
          {(["solana", "base"] as Chain[]).map((item) => (
            <label
              key={item}
              className={
                chain === item ? "chain-option selected" : "chain-option"
              }
            >
              <input
                type="radio"
                name="chain"
                value={item}
                checked={chain === item}
                onChange={() => setChain(item)}
              />
              <ChainMark chain={item} />
              <span>{chainNames[item]}</span>
              {chain === item && <Check size={16} />}
            </label>
          ))}
        </fieldset>
        <label className="field-label" htmlFor="deposit-amount">
          Amount to save
        </label>
        <div className="amount-input">
          <span>$</span>
          <input
            id="deposit-amount"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setValidation("");
            }}
            inputMode="decimal"
            autoComplete="off"
            aria-describedby="deposit-error"
          />
          <span>USDC</span>
        </div>
        <div className="amount-presets">
          {["25", "100", "250", "500"].map((value) => (
            <button
              key={value}
              type="button"
              className={amount === value ? "selected" : ""}
              onClick={() => setAmount(value)}
            >
              ${value}
            </button>
          ))}
        </div>
        <div className="deposit-detail">
          <span>Destination</span>
          <strong>{chainNames[chain]} goal vault</strong>
          <span>Earning integration</span>
          <strong>{chain === "solana" ? "Kamino Supply" : "Aave V3"}</strong>
        </div>
        <label className="consent">
          <input
            type="checkbox"
            checked={understood}
            onChange={(event) => setUnderstood(event.target.checked)}
          />
          <span>
            I understand contributions and earnings stay locked until the shared
            target is reached, with no time limit. Returns can vary and losses
            are possible.
          </span>
        </label>
        <FormError id="deposit-error" message={validation || error} />
        <Button type="submit" className="full-width" busy={busy}>
          Add {amount && validAmount(amount) ? `$${money(amount)}` : "funds"} to
          savings
          <ArrowRight size={17} />
        </Button>
        <p className="form-footnote">
          <FlaskConical size={13} />
          Local simulation. No wallet or real funds are used.
        </p>
      </form>
    </Dialog>
  );
}

function CreateModal({ busy, error, onClose, act }: ActionProps) {
  const [name, setName] = useState("My next adventure");
  const [target, setTarget] = useState("10000");
  const [validation, setValidation] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || name.trim().length > 60 || !validAmount(target)) {
      setValidation(
        "Choose a name up to 60 characters and a positive target with up to 6 decimals.",
      );
      return;
    }
    if (await act("create-goal", { name: name.trim(), target })) onClose();
  };
  return (
    <Dialog
      title="What are you building toward?"
      description="Give your goal a name and an amount. Your target is fixed once you start saving."
      onClose={onClose}
    >
      <form onSubmit={(event) => void submit(event)}>
        <label className="field-label" htmlFor="goal-name">
          Goal name
        </label>
        <input
          className="text-input"
          id="goal-name"
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
        />
        <label className="field-label" htmlFor="goal-target">
          Savings target
        </label>
        <div className="amount-input">
          <span>$</span>
          <input
            id="goal-target"
            inputMode="decimal"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          />
          <span>USDC</span>
        </div>
        <div className="model-choice">
          <Box size={25} />
          <div>
            <strong>The Roadster</strong>
            <p>Your first 100-piece build. More models in future versions.</p>
          </div>
          <Check size={18} />
        </div>
        <div className="info-note">
          <LockKeyhole size={18} />
          <p>
            Funds stay locked until your target is verified. There is no early
            withdrawal or automatic deadline.
          </p>
        </div>
        <FormError message={validation || error} />
        <Button type="submit" className="full-width" busy={busy}>
          Create my goal
          <Plus size={17} />
        </Button>
      </form>
    </Dialog>
  );
}

function HowModal({ onClose }: { onClose: () => void }) {
  return (
    <Dialog
      title="Your savings, taking shape."
      description="One goal. A hundred little milestones. Something you can watch yourself build."
      onClose={onClose}
    >
      <div className="how-steps">
        <div>
          <span>1</span>
          <section>
            <h3>Pick something worth saving for</h3>
            <p>
              Your fixed USDC target becomes a 100-piece model. Smaller deposits
              accumulate until a whole piece is funded.
            </p>
          </section>
        </div>
        <div>
          <span>2</span>
          <section>
            <h3>Save where your money lives</h3>
            <p>
              Solana and Base balances stay on their own chains. Contributions
              plus net earnings count together toward one goal.
            </p>
          </section>
        </div>
        <div>
          <span>3</span>
          <section>
            <h3>Build it. Then make it real.</h3>
            <p>
              Rakit your model when new pieces are funded. At your target, funds
              are prepared and verified before collection unlocks.
            </p>
          </section>
        </div>
      </div>
      <div className="info-note">
        <LockKeyhole size={18} />
        <p>
          Principal and earnings are locked until achievement, with no time
          limit. Lending liquidity is not guaranteed, and strategy losses can
          reduce progress.
        </p>
      </div>
      <p className="form-footnote">
        This build is a local demonstration, not a live deposit service.
        Building and replaying never move money.
      </p>
      <Button variant="build" className="full-width" onClick={onClose}>
        Back to my workshop
        <Box size={18} />
      </Button>
    </Dialog>
  );
}

function DemoModal({
  data,
  busy,
  error,
  onClose,
  act,
}: ActionProps & { data: AppState | null }) {
  const [chain, setChain] = useState<Chain>("solana");
  const [amount, setAmount] = useState("25");
  const [liquidity, setLiquidity] = useState("10000");
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <Dialog
      title="Demo controls"
      description="Exercise the savings lifecycle with simulated funds. These controls never call a real strategy or chain."
      onClose={onClose}
      wide
    >
      <div className="demo-environment">
        <FlaskConical size={22} />
        <div>
          <strong>Local demo · no real funds</strong>
          <p>
            The local API is the only balance source. No wallet connection,
            network deposit, or protocol return is claimed.
          </p>
        </div>
      </div>
      <div className="demo-control-grid">
        <div>
          <label className="field-label" htmlFor="demo-chain">
            Chain
          </label>
          <select
            className="text-input"
            id="demo-chain"
            value={chain}
            onChange={(event) => setChain(event.target.value as Chain)}
          >
            <option value="solana">Solana</option>
            <option value="base">Base</option>
          </select>
          <label className="field-label" htmlFor="demo-yield">
            Net strategy change (USDC)
          </label>
          <input
            className="text-input"
            id="demo-yield"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <p className="field-hint">
            Positive for earnings; negative to exercise a loss.
          </p>
          <Button
            variant="secondary"
            className="full-width"
            busy={busy}
            disabled={!validAmount(amount, true) || !data?.goal}
            onClick={() => void act("demo/yield", { chain, amount })}
          >
            Apply simulated change
          </Button>
        </div>
        <div>
          <label className="field-label" htmlFor="demo-liquidity">
            Available strategy liquidity (USDC)
          </label>
          <input
            className="text-input"
            id="demo-liquidity"
            inputMode="decimal"
            value={liquidity}
            onChange={(event) => setLiquidity(event.target.value)}
          />
          <p className="field-hint">
            Set 0 to test a delayed exit. Increase it and check preparation
            again to recover.
          </p>
          <Button
            variant="secondary"
            className="full-width"
            busy={busy}
            disabled={!/^\d+(?:\.\d{1,6})?$/.test(liquidity) || !data?.goal}
            onClick={() =>
              void act("demo/liquidity", { chain, amount: liquidity })
            }
          >
            Set demo liquidity
          </Button>
        </div>
      </div>
      <FormError message={error} />
      {data?.goal && (
        <div className="demo-positions">
          <h3>Local financial state</h3>
          {data.goal.chains.map((position) => (
            <div key={position.chain}>
              <ChainMark chain={position.chain} />
              <strong>{position.label}</strong>
              <span>Liquid: {money(position.liquid)} USDC</span>
              <span>Reserved: {money(position.reserved)} USDC</span>
            </div>
          ))}
        </div>
      )}
      {data && (
        <details className="evidence-details">
          <summary>
            Implementation evidence
            <ChevronDown size={16} />
          </summary>
          <dl>
            {Object.entries(data.evidence).map(([name, evidence]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{evidence}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      <div className="demo-reset">
        <div>
          <strong>Start the sample again</strong>
          <p>Replaces the current local goal and activity.</p>
        </div>
        <Button
          variant="secondary"
          busy={busy}
          onClick={() => {
            if (!confirmReset) setConfirmReset(true);
            else
              void act("demo/reset").then((success) => {
                if (success) {
                  setConfirmReset(false);
                  onClose();
                }
              });
          }}
        >
          {confirmReset ? "Confirm reset" : "Reset sample"}
        </Button>
      </div>
    </Dialog>
  );
}

function ClaimModal({
  goal,
  busy,
  error,
  onClose,
  act,
}: ActionProps & { goal: Goal }) {
  return (
    <Dialog
      title="You built it. It's yours."
      description="Collect the reserved USDC from each chain. Collecting one balance never locks the other."
      onClose={onClose}
    >
      <div className="claim-list">
        {goal.chains.map((position) => (
          <div className="claim-row" key={position.chain}>
            <div className="cluster">
              <ChainMark chain={position.chain} />
              <div>
                <strong>{position.label}</strong>
                <p>
                  {Number(position.reserved) > 0
                    ? `$${money(position.reserved)} USDC ready`
                    : "All funds collected"}
                </p>
              </div>
            </div>
            <Button
              variant={Number(position.reserved) > 0 ? "primary" : "secondary"}
              busy={busy}
              disabled={Number(position.reserved) <= 0}
              onClick={() => void act("claim", { chain: position.chain })}
            >
              {Number(position.reserved) > 0 ? (
                "Collect"
              ) : (
                <>
                  <Check size={16} />
                  Collected
                </>
              )}
            </Button>
          </div>
        ))}
      </div>
      <FormError message={error} />
      <p className="form-footnote">
        Local demonstration only. No assets are transferred to a wallet.
      </p>
      {goal.status === "closed" && (
        <Button variant="build" className="full-width" onClick={onClose}>
          Enjoy the finished build
          <ArrowRight size={18} />
        </Button>
      )}
    </Dialog>
  );
}

function FormError({ message, id }: { message: string; id?: string }) {
  return message ? (
    <p className="form-error" role="alert" id={id}>
      <TriangleAlert size={16} />
      {message}
    </p>
  ) : (
    <span id={id} />
  );
}

function TransactionHistory({
  data,
  onViewAll,
  expanded = false,
}: {
  data: AppState;
  onViewAll?: () => void;
  expanded?: boolean;
}) {
  const transactions = expanded
    ? data.transactions
    : data.transactions.slice(0, 3);
  return (
    <section
      className={`activity-section ${expanded ? "activity-section--expanded" : ""}`}
    >
      <div className="section-heading">
        <h2>{expanded ? "Your savings activity" : "The little steps"}</h2>
        {onViewAll && (
          <button className="text-button" onClick={onViewAll}>
            View all activity
            <ArrowRight size={15} />
          </button>
        )}
      </div>
      {transactions.length ? (
        <div className="transaction-list">
          {transactions.map((transaction) => {
            const deposited = transaction.type === "deposit";
            const earned =
              transaction.type.includes("yield") ||
              transaction.type.includes("earning");
            return (
              <div className="transaction-row" key={transaction.id}>
                <span
                  className={`transaction-icon ${earned ? "transaction-icon--earning" : ""}`}
                >
                  {deposited ? (
                    <Plus size={17} />
                  ) : earned ? (
                    <Sprout size={17} />
                  ) : transaction.type === "claim" ? (
                    <ArrowUpRight size={17} />
                  ) : (
                    <History size={17} />
                  )}
                </span>
                <div className="transaction-description">
                  <strong>{transaction.description}</strong>
                  <span>
                    {transaction.chain === "solana" ||
                    transaction.chain === "base"
                      ? chainNames[transaction.chain]
                      : "Goal"}
                    <i />
                    {activityDate.format(new Date(transaction.timestamp))}
                  </span>
                </div>
                <div className="transaction-amount">
                  <strong>
                    {Number(transaction.amount) === 0
                      ? "—"
                      : `${deposited || (earned && Number(transaction.amount) >= 0) ? "+" : transaction.type === "claim" || Number(transaction.amount) < 0 ? "−" : ""}$${money(String(Math.abs(Number(transaction.amount))))}`}
                  </strong>
                  <span>Local demo</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-history">
          <History size={24} />
          <p>
            Your first small step starts here.
            <br />
            Add to your savings to start building.
          </p>
        </div>
      )}
    </section>
  );
}

export function PrimitiveShowcase() {
  return (
    <main className="showcase main-content">
      <Logo />
      <h1>NabungFi interface states</h1>
      <div className="cluster">
        <Button>Primary</Button>
        <Button variant="build">Build 3 pieces</Button>
        <Button variant="secondary">Secondary</Button>
        <Button disabled>Disabled</Button>
        <Button busy>Saving</Button>
      </div>
      <label className="field-label" htmlFor="showcase-input">
        Savings amount
      </label>
      <input className="text-input" id="showcase-input" placeholder="100.00" />
      <FormError message="Enter a positive amount with up to 6 decimals." />
      <div className="cluster">
        <span className="status-badge">In progress</span>
        <span className="status-badge status-badge--success">
          Goal achieved
        </span>
        <ChainMark chain="solana" />
        <ChainMark chain="base" />
      </div>
      <p>
        Focus, touch sizes, normal text and visible state feedback use the same
        primitives as the workshop.
      </p>
    </main>
  );
}
