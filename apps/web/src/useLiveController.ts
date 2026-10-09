import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePrivy, useWallets, useCreateWallet, useUser, useSendTransaction } from "@privy-io/react-auth";
import {
  useWallets as useSolanaWallets,
  useSignAndSendTransaction,
  useCreateWallet as useCreateSolanaWallet,
} from "@privy-io/react-auth/solana";
import type {
  AppNetwork,
  CreateGoalRequest,
  GoalDTO,
  GoalHistoryEntry,
  GoalStepAction,
  GoalStepDTO,
  SessionDTO,
  WalletBalanceDTO,
} from "@nabungfi/shared/application";
import type { Destination } from "./Shell";
import {
  appRequest,
  ApiError,
  base58,
  clearApiRequest,
  guardWalletStart,
  validateWalletPlan,
  verifyPlanFingerprint,
  validateSessionIdentity,
  validateRecoveryStep,
  validateReceiptIdentity,
  rawAmount,
  callWalletSdk,
  isWalletRejection,
  clearRejectedRecovery,
  readApiRequests,
  readRecovery,
  writeApiRequest,
  writeRecovery,
  type PendingApiRequest,
  type WalletRecovery,
} from "./live-api";
import { usePwa } from "./pwa";
import {
  validateCanonicalBinding,
  validateTransactionSemantics,
} from "./plan-semantics";
import { navigateApp, readAppRoute } from "./app-routes";
import { actions, networks } from "./live-config";
import { readGoalSnapshots, retainGoalPresentation } from "./goal-snapshots";
import { prepareEvmProvider, assertEvmProviderIdentity } from "./wallet-provider";
import { useWalletOnboarding } from "./useWalletOnboarding";
import { hasOwnerWallets } from "./wallet-onboarding";
import { GOAL_TEMPLATES, type GoalModel } from "@nabungfi/shared/application";
import { useGoalSetup } from "./useGoalSetup";
import { goalSetupStage } from "./goal-setup";
import { sponsoredGoalNetworks } from "./gas-sponsorship";
export function useLiveController() {
  const {
    ready,
    authenticated,
    user,
    login,
    logout,
    getAccessToken,
    linkWallet,
    connectWallet,
  } = usePrivy();
  const { wallets: evmWallets } = useWallets();
  const { wallets: solanaWallets } = useSolanaWallets();
  const { refreshUser } = useUser();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { sendTransaction: sendSponsoredEvmTransaction } = useSendTransaction();
  const { createWallet: createEthereumWallet } = useCreateWallet();
  const { createWallet: createSolanaWallet } = useCreateSolanaWallet();
  const pwa = usePwa();
  const [destination, setDestination] = useState<Destination>(
    () => readAppRoute(location).destination,
  );
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [gasSponsorshipEnabled,setGasSponsorshipEnabled] = useState(false);
  const [goals, setGoals] = useState<GoalDTO[]>([]);
  const [goalModels, setGoalModels] = useState<GoalModel[]>(["car", "laptop", "house"]);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => readAppRoute(location).goalId,
  );
  const [historyView, setHistoryView] = useState(() => location.hash === "#goal-activity");
  const [history, setHistory] = useState<GoalHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyRevision, setHistoryRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialReadSettled, setInitialReadSettled] = useState(false);
  const [openingGoal, setOpeningGoal] = useState<{id:string;name:string;userId:string}|null>(null);
  const [busy, setBusy] = useState(false);
  const [requestError, setError] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [depositing, setDepositing] = useState(false);
  const [depositDraft, setDepositDraft] = useState<{
    goalId: string;
    network: AppNetwork;
    amountRaw: string;
  } | null>(null);
  const [walletStep, setWalletStep] = useState<GoalStepDTO | null>(null);
  const [recoveries, setRecoveries] = useState<WalletRecovery[]>([]);
  const [apiRequests, setApiRequests] = useState<PendingApiRequest[]>([]);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const identityRef = useRef<string | null>(null);
  const walletFlight = useRef(false);
  const readGeneration = useRef(0);
  const userId = user?.id ?? null;
  const walletMembership =
    user?.linkedAccounts
      .filter((account) => account.type === "wallet")
      .map((account) => `${account.chainType}:${account.address}`)
      .sort()
      .join("|") ?? "";
  useEffect(() => {
    identityRef.current = userId;
  }, [userId]);
  const unresolved = recoveries.filter(
    (record) => record.state !== "confirmed" && record.state !== "failed",
  );
  const hasPending =
    unresolved.length > 0 ||
    apiRequests.length > 0 ||
    busy ||
    Boolean(recoveryError);
  const selected = goals.find((goal) => goal.id === selectedId) ?? null;

  const refreshRecovery = useCallback(() => {
    if (!userId) {
      setRecoveries([]);
      setApiRequests([]);
      setRecoveryError("");
      return;
    }
    try {
      setRecoveries(readRecovery(localStorage, userId));
      setApiRequests(readApiRequests(localStorage, userId));
      setRecoveryError("");
    } catch (failure) {
      setRecoveryError(
        failure instanceof Error
          ? failure.message
          : "Saved requests could not be read.",
      );
    }
  }, [userId]);
  const request = useCallback(
    <T>(path: string, options: { body?: unknown; requestId?: string } = {}) =>
      appRequest<T>(getAccessToken, path, options),
    [getAccessToken],
  );
  const walletOnboarding = useWalletOnboarding({
    userId, authenticated, ready,
    profile: user ?? undefined,
    offline: pwa.offline, appId: import.meta.env.VITE_PRIVY_APP_ID,
    refreshUser, createEthereumWallet, createSolanaWallet,
    readSession: () => request<SessionDTO>("/api/session"),
  });
  const error = walletOnboarding.error || recoveryError || requestError;
  const readWalletBalances = useCallback(async () => (await request<{balances: WalletBalanceDTO[]}>("/api/wallet-balances")).balances, [request]);
  useEffect(() => {
    if (!userId) return;
    const changed = (event: StorageEvent) => {
      if (
        event.key === null ||
        event.key.startsWith(`nabungfi:wallet-step:v1:${userId}:`) ||
        event.key.startsWith(`nabungfi:api-request:v1:${userId}:`)
      )
        refreshRecovery();
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [userId, refreshRecovery]);
  const load = useCallback(async () => {
    if (!userId || !navigator.onLine) return;
    const identity = userId;
    const generation = ++readGeneration.current;
    setLoading(true);
    try {
      const [nextSession, portfolio, config] = await Promise.all([
        request<SessionDTO>("/api/session"),
        request<{ goals: GoalDTO[] }>("/api/goals"),
        request<{ goalModels?: string[];gasSponsorship?:string|null }>("/api/config"),
      ]);
      if (
        identityRef.current !== identity ||
        generation !== readGeneration.current
      )
        return;
      validateSessionIdentity(
        nextSession,
        identity,
        import.meta.env.VITE_PRIVY_APP_ID,
      );
      if (!hasOwnerWallets(nextSession.user.wallets))
        throw new Error("Your wallet ownership is still syncing. Retry verification to finish setup.");
      setSession(nextSession);
      setGasSponsorshipEnabled(config.gasSponsorship==='privy-testnet');
      const available = Array.isArray(config.goalModels) ? config.goalModels : ["car", "laptop", "house"];
      setGoalModels(GOAL_TEMPLATES.filter(template=>available.includes(template.id)).map(template=>template.id));
      setGoals(prior => retainGoalPresentation(portfolio.goals,prior));
      setError("");
      const snapshots = await readGoalSnapshots(portfolio.goals, async id =>
        (await request<{goal: GoalDTO}>(`/api/goals/${encodeURIComponent(id)}`)).goal,
        readAppRoute(location).goalId, {retryUnavailable: true});
      if (identityRef.current !== identity || generation !== readGeneration.current) return;
      setGoals(snapshots);
    } catch (failure) {
      if (
        identityRef.current === identity &&
        generation === readGeneration.current
      ) {
        // Keep metadata and original requests, but never present a failed read as a current balance.
        setGoals((prior) =>
          prior.map((goal) => ({
            ...goal,
            chainStatus: "unavailable",
            chainState: null,
          })),
        );
        setError(
          failure instanceof Error
            ? failure.message
            : "Your goals could not load.",
        );
      }
    } finally {
      if (
        identityRef.current === identity &&
        generation === readGeneration.current
      ) {
        setInitialReadSettled(true);
        setLoading(false);
      }
    }
  }, [request, userId]);

  useEffect(() => {
    setSession(null);
    setGasSponsorshipEnabled(false);
    setLoading(false);
    setError("");
    readGeneration.current++;
    setInitialReadSettled(false);
    setOpeningGoal(null);
    setGoals([]);
    setHistory([]);
    setWalletStep(null);
    setDepositing(false);
    setDepositDraft(null);
    setNotice("");
    refreshRecovery();
  }, [authenticated, userId, refreshRecovery]);
  useEffect(() => {
    if (authenticated && walletOnboarding.complete) void load();
  }, [authenticated, walletOnboarding.complete, walletMembership, load]);
  useEffect(() => {
    const update = () => {
      const route = readAppRoute(location);
      setDestination(route.destination);
      setSelectedId(route.goalId);
      setHistoryView(route.destination === "goals" && Boolean(route.goalId) && location.hash === "#goal-activity");
    };
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
    };
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (busy) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [busy]);
  useEffect(() => {
    if (!authenticated || !walletOnboarding.complete || busy || loading) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine)
        void load();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [authenticated, walletOnboarding.complete, busy, loading, load]);
  useEffect(() => {
    if (!authenticated || !selectedId || !userId) {
      setHistory([]);
      setHistoryLoading(false); setHistoryError("");
      return;
    }
    let active = true;
    setHistory([]);
    setHistoryLoading(true); setHistoryError("");
    void request<{ history: GoalHistoryEntry[] }>(
      `/api/goals/${encodeURIComponent(selectedId)}/history`,
    )
      .then((result) => {
        if (active) setHistory(result.history);
      })
      .catch(() => {
        if (active) { setHistory([]); setHistoryError("The goal’s activity couldn’t be read. Retry to load its recorded wallet steps."); }
      }).finally(() => {if (active) setHistoryLoading(false);});
    return () => {
      active = false;
    };
  }, [authenticated, selectedId, request, userId, loading, historyRevision]);

  const navigate = (next: Destination, goal?: string, activity = false) => {
    if (goalSetup.intent && (activity || next !== "goals" || goal !== goalSetup.intent.goalId)) goalSetup.pause();
    navigateApp(next, goal, activity);
    setDestination(next);
    setSelectedId(goal ?? null);
    setHistoryView(next === "goals" && Boolean(goal) && activity);
  };
  const report = (failure: unknown) =>
    setError(
      failure instanceof Error
        ? failure.message
        : "This request could not be completed.",
    );
  const createMissingWallet = async (family: "ethereum" | "solana") => {
    if (!userId || hasPending || !navigator.onLine) return;
    setBusy(true);
    setError("");
    try {
      if (family === "solana") await createSolanaWallet();
      else await createEthereumWallet();
      if (identityRef.current !== userId) return;
      setNotice(
        "Your wallet was created. Its ownership is being verified before it can be selected for a goal.",
      );
      await load();
    } catch (failure) {
      report(failure);
    } finally {
      setBusy(false);
    }
  };
  const saveStep = (step: GoalStepDTO, requestId: string, present = true) => {
    if (!userId) throw new Error("Sign in again before using your wallet.");
    if (step.status === "planning" || (!step.plan && !step.transactionHash))
      throw new Error(
        "The original transaction plan is still being prepared. Recover this same request again before using your wallet.",
      );
    const state =
      step.status === "confirmed"
        ? "confirmed"
        : step.status === "failed"
          ? "failed"
          : step.transactionHash
            ? "submitted"
            : step.status === "planned"
              ? "planned"
              : "awaiting-wallet";
    writeRecovery(localStorage, {
      userId,
      goalId: step.metadataGoalId,
      stepId: step.id,
      requestId,
      action: step.action,
      network: step.network,
      ...(step.amountRaw ? { amountRaw: step.amountRaw } : {}),
      state,
      ...(step.transactionHash
        ? { transactionHash: step.transactionHash }
        : {}),
      createdAt: step.createdAt,
    });
    refreshRecovery();
    if (state === "confirmed" || state === "failed") {
      setWalletStep(null);
      setNotice(
        `${actions[step.action]} was already ${state}. Refresh the goal to inspect its current state.`,
      );
    } else setWalletStep(present ? step : null);
  };
  const doApiRequest = async (record: PendingApiRequest, presentStep = () => true) => {
    if (pwa.offline || identityRef.current !== record.userId)
      throw new Error("Reconnect and sign in to the original account first.");
    if (record.path === "/api/goals") {
      const result = await request<{ goal: GoalDTO }>(record.path, {
        body: record.body,
        requestId: record.requestId,
      });
      if (identityRef.current !== record.userId)
        throw new Error(
          "The account changed. Recover this request from the original account.",
        );
      const expected = record.body as CreateGoalRequest;
      const goal = result.goal;
      const returnedChains = [
        "solana",
        ...goal.binding.participants.map((participant) => participant.network),
      ]
        .sort()
        .join(",");
      if (
        goal.name !== expected.name ||
        goal.model !== expected.model ||
        goal.targetRaw !== rawAmount(expected.targetAmount) ||
        goal.binding.targetRaw !== goal.targetRaw ||
        goal.goalId !== goal.binding.goalId ||
        goal.binding.owner.solana !== expected.solanaOwner ||
        goal.binding.owner.evm.toLowerCase() !==
          expected.evmOwner.toLowerCase() ||
        returnedChains !== [...expected.chains].sort().join(",")
      )
        throw new Error(
          "The saved goal does not match your original name, target, owners and selected chains.",
        );
      await validateCanonicalBinding(goal.binding);
      if (identityRef.current !== record.userId)
        throw new Error(
          "The account changed. Recover this request from the original account.",
        );
      clearApiRequest(localStorage, record);
      refreshRecovery();
      setOpeningGoal({id:goal.id,name:goal.name,userId:record.userId});
      setCreating(false);
      navigate("goals", result.goal.id);
      goalSetup.start(goal);
      try { await load(); }
      finally {
        if (identityRef.current === record.userId)
          setOpeningGoal(current=>current?.id===goal.id && current.userId===record.userId ? null : current);
      }
      return;
    }
    const result = await request<{ step: GoalStepDTO }>(record.path, {
      body: record.body,
      requestId: record.requestId,
    });
    if (identityRef.current !== record.userId)
      throw new Error(
        "The account changed. Recover this request from the original account.",
      );
    const expected = record.body as {
      action: GoalStepAction;
      network: AppNetwork;
      amountRaw?: string;
    };
    const metadataGoalId = decodeURIComponent(record.path.split("/")[3]);
    if (
      result.step.metadataGoalId !== metadataGoalId ||
      result.step.action !== expected.action ||
      result.step.network !== expected.network ||
      result.step.amountRaw !== expected.amountRaw
    )
      throw new Error(
        "The returned transaction step does not match your original request.",
      );
    saveStep(result.step, record.requestId, presentStep());
    clearApiRequest(localStorage, record);
    refreshRecovery();
    if (result.step.status === "confirmed") await load();
  };
  const createGoal = async (body: CreateGoalRequest) => {
    if (!userId || hasPending || goalSetup.running)
      throw new Error(
        "Reconcile the previous wallet request before creating another goal.",
      );
    const record: PendingApiRequest = {
      userId,
      requestId: crypto.randomUUID(),
      path: "/api/goals",
      body,
      createdAt: new Date().toISOString(),
    };
    setBusy(true);
    setError("");
    try {
      writeApiRequest(localStorage, record);
      refreshRecovery();
      await doApiRequest(record);
    } catch (failure) {
      if (
        failure instanceof ApiError &&
        failure.status >= 400 &&
        failure.status < 500
      ) {
        clearApiRequest(localStorage, record);
        refreshRecovery();
      }
      throw failure;
    } finally {
      setBusy(false);
    }
  };
  const planStep = async (
    goal: GoalDTO,
    action: GoalStepAction,
    network: AppNetwork,
    amountRaw?: string,
    setup = false,
  ) => {
    if (!userId || hasPending || loading || pwa.offline) {
      setError(
        loading ? "Wait for your goal to finish loading before starting a transaction."
          : "Reconnect and reconcile previous requests before starting a new transaction.",
      );
      return false;
    }
    if (setup) {
      const stage = goalSetupStage(goal);
      if (!goalSetup.running || goalSetup.intent?.goalId !== goal.id || stage.kind !== "wallet" || stage.action !== action || stage.network !== network)
        return false;
    } else if (goalSetup.running) return false;
    const requestId = crypto.randomUUID();
    const record: PendingApiRequest = {
      userId,
      requestId,
      path: `/api/goals/${encodeURIComponent(goal.id)}/steps`,
      body: { requestId, action, network, ...(amountRaw ? { amountRaw } : {}) },
      createdAt: new Date().toISOString(),
    };
    setBusy(true);
    setError("");
    setDepositing(false);
    try {
      writeApiRequest(localStorage, record);
      refreshRecovery();
      await doApiRequest(record, setup ? () => goalSetup.isActive(goal.id) : undefined);
      return true;
    } catch (failure) {
      if (
        failure instanceof ApiError &&
        failure.status >= 400 &&
        failure.status < 500
      ) {
        clearApiRequest(localStorage, record);
        refreshRecovery();
      }
      report(failure);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const reconcile = async (record: WalletRecovery, providedHash?: string) => {
    const originalHash = record.transactionHash ?? providedHash;
    const hash =
      record.network === "solana" ? originalHash : originalHash?.toLowerCase();
    if (!hash || !userId || record.userId !== userId || pwa.offline)
      throw new Error(
        "Provide the original transaction hash while connected to the original account.",
      );
    writeRecovery(localStorage, {
      ...record,
      transactionHash: hash,
      state: "submitted",
    });
    refreshRecovery();
    const result = await request<{ step: GoalStepDTO }>(
      `/api/goals/${encodeURIComponent(record.goalId)}/steps/${encodeURIComponent(record.stepId)}/reconcile`,
      { body: { transactionHash: hash } },
    );
    validateReceiptIdentity(record, result.step, hash);
    const status = result.step.status;
    if (status === "failed" && goalSetup.intent?.goalId === record.goalId) goalSetup.pause();
    writeRecovery(localStorage, {
      ...record,
      transactionHash: hash,
      state:
        status === "confirmed"
          ? "confirmed"
          : status === "failed"
            ? "failed"
            : "submitted",
    });
    refreshRecovery();
    await load();
    if (identityRef.current !== record.userId) return result.step;
    setNotice(
      status === "confirmed"
        ? `${actions[result.step.action]} confirmed on ${networks[result.step.network]}.`
        : status === "failed"
          ? "The original transaction failed onchain. Review your wallet before starting again."
          : "The original transaction is still being checked. No replacement has been sent.",
    );
    if (status === "confirmed" || status === "failed") setWalletStep(null);
    if (
      status === "confirmed" &&
      record.action === "approve" &&
      record.amountRaw
    ) {
      navigate("goals", record.goalId);
      setDepositDraft({
        goalId: record.goalId,
        network: record.network as AppNetwork,
        amountRaw: record.amountRaw,
      });
      setDepositing(true);
      setNotice(
        "Approval confirmed. Review your deposit next; your wallet will ask separately before any USDC is deposited.",
      );
    }
    return result.step;
  };
  const closeUnsent = async (record: WalletRecovery) => {
    if (record.transactionHash || record.state !== "awaiting-wallet") throw new Error("Reconcile the original attempted wallet transaction.");
    const original = await request<{step: GoalStepDTO}>(`/api/goals/${encodeURIComponent(record.goalId)}/steps/${encodeURIComponent(record.stepId)}`);
    validateRecoveryStep(record, original.step);
    if (!original.step.plan || original.step.transactionHash) throw new Error("The original signing marker cannot be closed as unsent.");
    const result = await request<{step: GoalStepDTO}>(`/api/goals/${encodeURIComponent(record.goalId)}/steps/${encodeURIComponent(record.stepId)}/wallet-not-invoked`, {body:{fingerprint:original.step.plan.fingerprint,attestation:"wallet-approval-never-invoked"}});
    validateRecoveryStep(record, result.step);
    if (result.step.status !== "rejected" || result.step.transactionHash || result.step.reasonCode !== "OWNER_ATTESTED_WALLET_NOT_INVOKED") throw new Error("The unsent request attestation could not be confirmed.");
    clearRejectedRecovery(localStorage, record);
    refreshRecovery();
    setWalletStep(null);
    setNotice("This original request was closed by your statement that no wallet approval or signing was attempted. It is an attestation, not an onchain receipt. Start another step explicitly when ready.");
  };
  const closeUnsentRequest = async (record: WalletRecovery) => {
    setBusy(true);
    try {await closeUnsent(record);setError("");await load();} catch (failure) {report(failure);} finally {setBusy(false);}
  };
  const cancelUnsignedRequest = async (record: WalletRecovery) => {
    if (walletFlight.current || record.userId !== identityRef.current) return;
    if (record.state !== "planned" || record.transactionHash) {
      setError("Wallet confirmation already started. Check the original transaction before continuing.");
      return;
    }
    walletFlight.current = true;
    goalSetup.pause();
    setBusy(true);
    try {
      const original = await request<{step: GoalStepDTO}>(`/api/goals/${encodeURIComponent(record.goalId)}/steps/${encodeURIComponent(record.stepId)}`);
      validateRecoveryStep(record, original.step);
      if (!original.step.plan || original.step.transactionHash) throw new Error("The original wallet outcome must be checked.");
      const result = await request<{step: GoalStepDTO}>(`/api/goals/${encodeURIComponent(record.goalId)}/steps/${encodeURIComponent(record.stepId)}/cancel-unsigned`, {body:{fingerprint:original.step.plan.fingerprint}});
      validateRecoveryStep(record, result.step);
      if (identityRef.current !== record.userId) return;
      if (result.step.status !== "rejected" || result.step.transactionHash || result.step.reasonCode !== "UNSIGNED_PLAN_CANCELLED") throw new Error("The unsigned plan cancellation could not be confirmed. Keep the original request.");
      clearRejectedRecovery(localStorage, record);
      refreshRecovery();
      setWalletStep(null);
      setError("");
      setNotice("Unsigned step cancelled. No wallet confirmation started. Your goal and confirmed vaults are saved; continue setup whenever you’re ready.");
      await load();
    } catch (failure) { report(failure); }
    finally { setBusy(false); walletFlight.current = false; }
  };
  const closeWalletReview = () => {
    goalSetup.pause();
    const record = recoveries.find(record => record.stepId === walletStep?.id);
    if (record?.state === "planned" && !record.transactionHash) void cancelUnsignedRequest(record);
    else setWalletStep(null);
  };
  const resolveExpiredRequest = async (record: WalletRecovery) => {
    setBusy(true);
    try {
      if(record.network!=="solana"||record.transactionHash||record.userId!==userId)throw new Error("Use the original transaction hash for this request.");
      const original=await request<{step:GoalStepDTO}>(`/api/goals/${encodeURIComponent(record.goalId)}/steps/${encodeURIComponent(record.stepId)}`);
      validateRecoveryStep(record,original.step);if(!original.step.plan)throw new Error("The original plan is unavailable.");
      const result=await request<{step:GoalStepDTO;transactionHash?:string}>(`/api/goals/${encodeURIComponent(record.goalId)}/steps/${encodeURIComponent(record.stepId)}/resolve-expired-solana`,{body:{fingerprint:original.step.plan.fingerprint}});
      validateRecoveryStep(record,result.step);
      if(identityRef.current!==userId)throw new Error("Reconnect to the original account before continuing.");
      if(result.transactionHash){await reconcile(record,result.transactionHash);return;}
      if(result.step.status!=="failed"||result.step.transactionHash||result.step.reasonCode!=="EXPIRED_SOLANA_MESSAGE_NOT_EXECUTED")throw new Error("The original outcome remains unresolved.");
      clearRejectedRecovery(localStorage,record);refreshRecovery();setWalletStep(null);setError("");
      setNotice("Finalized history confirms the expired original message was not executed. No replacement was sent. You can review a new step explicitly.");await load();
    }catch(failure){report(failure);}finally{setBusy(false);}
  };
  const sendWalletOnce = async (step: GoalStepDTO) => {
    const plan = step.plan;
    if (
      !plan ||
      !userId ||
      pwa.offline ||
      new Date(plan.expiresAt).getTime() <= Date.now()
    ) {
      setError(
        "This transaction plan expired. Do not sign it; refresh the original step first.",
      );
      return;
    }
    const record = readRecovery(localStorage, userId).find(
      (item) => item.stepId === step.id,
    );
    if (!record || record.state !== "planned" || record.transactionHash) {
      setError(
        "This wallet request already started. Reconcile its original transaction instead of sending a replacement.",
      );
      return;
    }
    const goal = goals.find(
      (candidate) => candidate.id === step.metadataGoalId,
    );
    try {
      if (!goal)
        throw new Error(
          "The original goal is not loaded. Refresh before signing.",
        );
      validateWalletPlan(goal, step);
      validateRecoveryStep(record, step);
      await verifyPlanFingerprint(plan);
      await validateTransactionSemantics(goal.binding, plan);
      if (identityRef.current !== userId)
        throw new Error(
          "The account changed before wallet confirmation. Reconnect to the original account.",
        );
    } catch (failure) {
      report(failure);
      return;
    }
    setBusy(true);
    setError("");
    let markerStarted = false;
    let sdkInvoked = false;
    try {
      let hash: string;
      if (plan.transaction.kind === "evm") {
        const transaction = plan.transaction;
        const wallet = evmWallets.find(
          (candidate) =>
            candidate.address.toLowerCase() === plan.owner.toLowerCase(),
        );
        if (!wallet)
          throw new Error(
            "Connect the EVM owner wallet shown in this goal before confirming.",
          );
        if (plan.gasPayment && wallet.walletClientType !== "privy")
          throw new Error("Use the original linked Privy wallet for this sponsored step.");
        const provider = await prepareEvmProvider(wallet, plan.owner, transaction.chainId);
        if (identityRef.current !== userId)
          throw new Error(
            "The signed-in account changed. Keep the original request and reconnect.",
          );
        writeRecovery(localStorage, { ...record, gasPayment:plan.gasPayment, state: "awaiting-wallet" });
        refreshRecovery();
        markerStarted = true;
        hash = await guardWalletStart(
          request,
          record.goalId,
          step.id,
          plan.fingerprint,
          async () => {
            if (identityRef.current !== userId || !navigator.onLine)
              throw new Error(
                "The original account or connection changed before wallet confirmation. Reconcile this request before continuing.",
              );
            await assertEvmProviderIdentity(provider, plan.owner, transaction.chainId);
            if (identityRef.current !== userId || !navigator.onLine)
              throw new Error(
                "The selected owner wallet or chain changed before signing. Inspect the original request before continuing.",
              );
            sdkInvoked = true;
            if (plan.gasPayment === "privy-testnet") {
              const result = await callWalletSdk(() => sendSponsoredEvmTransaction({
                to: transaction.to, data: transaction.data,
                value: BigInt(transaction.value), chainId: transaction.chainId,
              }, { address: plan.owner, sponsor: true, uiOptions: { showWalletUIs: true } }));
              return result.hash;
            }
            return (await callWalletSdk(() =>
              provider.request({
                method: "eth_sendTransaction",
                params: [
                  {
                    from: plan.owner,
                    to: transaction.to,
                    data: transaction.data,
                    value: `0x${BigInt(transaction.value).toString(16)}`,
                    chainId: `0x${transaction.chainId.toString(16)}`,
                  },
                ],
              }),
            )) as string;
          },
        );
      } else {
        const wallet = solanaWallets.find(
          (candidate) => candidate.address === plan.owner,
        );
        if (!wallet)
          throw new Error(
            "Connect the Solana owner wallet shown in this goal before confirming.",
          );
        const transaction = Uint8Array.from(
          atob(plan.transaction.base64),
          (character) => character.charCodeAt(0),
        );
        if (identityRef.current !== userId)
          throw new Error(
            "The signed-in account changed. Keep the original request and reconnect.",
          );
        writeRecovery(localStorage, { ...record, gasPayment:plan.gasPayment, state: "awaiting-wallet" });
        refreshRecovery();
        markerStarted = true;
        const result = await guardWalletStart(
          request,
          record.goalId,
          step.id,
          plan.fingerprint,
          () => {
            if (identityRef.current !== userId || !navigator.onLine)
              throw new Error(
                "The original account or connection changed before wallet confirmation. Reconcile this request before continuing.",
              );
            if (wallet.address !== plan.owner)
              throw new Error(
                "The selected Solana owner changed before signing. Inspect the original request before continuing.",
              );
            sdkInvoked = true;
            return callWalletSdk(() =>
              signAndSendTransaction({
                transaction,
                wallet,
                chain: "solana:devnet",
                options: { skipSimulation: false, ...(plan.gasPayment === "privy-testnet" ? { sponsor: true } : {}) },
              }),
            );
          },
        );
        hash = base58(result.signature);
      }
      const submitted = {
        ...record,
        gasPayment:plan.gasPayment,
        transactionHash: step.network === "solana" ? hash : hash.toLowerCase(),
        state: "submitted" as const,
      };
      writeRecovery(localStorage, submitted);
      refreshRecovery();
      if (identityRef.current !== userId) return;
      await reconcile(submitted);
    } catch (failure) {
      // Once the server marker starts, a client error alone cannot authorize a new plan.
      if (goalSetup.intent?.goalId === step.metadataGoalId) goalSetup.pause();
      if (!markerStarted) {
        writeRecovery(localStorage, record);
        refreshRecovery();
      }
      if (markerStarted && !sdkInvoked && identityRef.current === userId) {
        try { await closeUnsent({...record,state:"awaiting-wallet"}); }
        catch { /* An unconfirmed marker stays in recovery; never send a replacement. */ }
      }
      if (isWalletRejection(failure)) {
        try {
          const rejected = await request<{ step: GoalStepDTO }>(
            `/api/goals/${encodeURIComponent(record.goalId)}/steps/${encodeURIComponent(step.id)}/wallet-rejected`,
            { body: { fingerprint: plan.fingerprint, providerCode: 4001 } },
          );
          validateRecoveryStep(record, rejected.step);
          if (
            rejected.step.status !== "rejected" ||
            rejected.step.transactionHash
          )
            throw new Error("The wallet rejection could not be reconciled.");
          clearRejectedRecovery(localStorage, record);
          refreshRecovery();
          setWalletStep(null);
          setNotice(
            "You declined this wallet request. It is closed by your attestation; no new transaction was sent. Start a new step explicitly if you want to continue.",
          );
          return;
        } catch {
          setError(
            "You declined the wallet request, but its saved state could not be confirmed. Inspect the original step before starting another action.",
          );
          return;
        }
      }
      if (
        failure instanceof ApiError &&
        failure.status === 409 &&
        failure.code === "PLAN_EXPIRED"
      ) {
        try {
          const original = await request<{ step: GoalStepDTO }>(
            `/api/goals/${encodeURIComponent(record.goalId)}/steps/${encodeURIComponent(step.id)}`,
          );
          if (
            original.step.id === step.id &&
            original.step.status === "planned" &&
            !original.step.transactionHash
          ) {
            writeRecovery(localStorage, record);
            refreshRecovery();
            setWalletStep(null);
          }
        } catch {
          /* Without server proof of an unsigned step, the original request stays blocked. */
        }
      }
      report(failure);
    } finally {
      setBusy(false);
    }
  };

  const sendWallet = async (step: GoalStepDTO) => {
    // A React loading state alone cannot exclude two clicks before async validation.
    if (walletFlight.current) return;
    walletFlight.current = true;
    try {
      await sendWalletOnce(step);
    } catch (failure) {
      report(failure);
    } finally {
      walletFlight.current = false;
    }
  };

  const goalSetup = useGoalSetup({
    userId: authenticated ? userId : null, goals, initialReadSettled,
    blocked: hasPending || loading || pwa.offline || !walletOnboarding.complete || Boolean(walletStep),
    plan: (goal, action, network) => planStep(goal, action, network, undefined, true),
    refresh: load, error: report,
    ready: () => setNotice("All selected vaults are ready. Your goal setup is complete."),
  });
  const continueGoalSetup = (goal: GoalDTO) => {
    if (hasPending || loading || pwa.offline) return;
    setError(""); navigate("goals", goal.id); goalSetup.start(goal);
  };

  const total = useMemo(
    () =>
      goals
        .reduce(
          (sum, goal) =>
            sum +
            BigInt(
              goal.chainStatus === "available"
                ? (goal.chainState?.totalAssetsRaw ?? "0")
                : "0",
            ),
          0n,
        )
        .toString(),
    [goals],
  );
  const unavailableCount = goals.filter(
    (goal) => goal.chainStatus === "unavailable",
  ).length;

  const checkOriginal = async (record: WalletRecovery, hash?: string) => {
    setBusy(true);
    try {
      await reconcile(record, hash);
    } catch (failure) {
      report(failure);
    } finally {
      setBusy(false);
    }
  };
  const recoverRequest = async (record: PendingApiRequest) => {
    setBusy(true);
    try {
      await doApiRequest(record);
    } catch (failure) {
      report(failure);
    } finally {
      setBusy(false);
    }
  };
  const resumeOriginal = async (record: WalletRecovery) => {
    setBusy(true);
    try {
      let result = await request<{ step: GoalStepDTO }>(
        `/api/goals/${encodeURIComponent(record.goalId)}/steps/${encodeURIComponent(record.stepId)}`,
      );
      validateRecoveryStep(record, result.step);
      if (result.step.status === "rejected" && !result.step.transactionHash) {
        clearRejectedRecovery(localStorage, record);
        refreshRecovery();
        setWalletStep(null);
        setNotice(
          "Your previously declined wallet step is closed by owner attestation. You may start another step explicitly.",
        );
        return;
      }
      if (
        result.step.status !== "planned" ||
        result.step.transactionHash ||
        !result.step.plan
      )
        throw new Error(
          "The original wallet request already started. Inspect wallet history and reconcile the original transaction hash; a new transaction cannot be sent yet.",
        );
      if (new Date(result.step.plan.expiresAt).getTime() <= Date.now())
        result = await request<{ step: GoalStepDTO }>(
          `/api/goals/${encodeURIComponent(record.goalId)}/steps/${encodeURIComponent(record.stepId)}/refresh`,
          { body: { fingerprint: result.step.plan.fingerprint } },
        );
      writeRecovery(localStorage, { ...record, state: "planned" });
      refreshRecovery();
      setWalletStep(result.step);
    } catch (failure) {
      report(failure);
    } finally {
      setBusy(false);
    }
  };
  return {
    sponsoredNetworks:selected&&session?sponsoredGoalNetworks(selected.binding,session.user.wallets,gasSponsorshipEnabled):[],
    readWalletBalances,
    ready,
    authenticated,
    user,
    login,
    logout,
    linkWallet,
    connectWallet,
    pwa,
    destination,
    session,
    goals,
    goalModels,
    selected,
    historyView,
    history,
    historyLoading, historyError, refreshHistory: () => setHistoryRevision(value => value + 1),
    loading,
    initialReadSettled,
    walletOnboarding,
    openingGoal,
    busy,
    error,
    notice,
    creating,
    setCreating,
    depositing,
    depositDraft,
    setDepositing,
    walletStep,
    setWalletStep,
    recoveries,
    apiRequests,
    unresolved,
    hasPending: hasPending || goalSetup.running,
    goalSetup,
    continueGoalSetup,
    reducedMotion,
    setReducedMotion,
    total,
    unavailableCount,
    navigate,
    load,
    createGoal,
    planStep,
    sendWallet,
    checkOriginal,
    recoverRequest,
    resumeOriginal,
    closeUnsentRequest,
    cancelUnsignedRequest,
    closeWalletReview,
    resolveExpiredRequest,
    createMissingWallet,
  };
}
