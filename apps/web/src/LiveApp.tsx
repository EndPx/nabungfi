import "./wallet-compat";
import { Captcha, PrivyProvider, useLoginWithEmail, useLoginWithOAuth, useModalStatus } from "@privy-io/react-auth";
import { useEffect } from "react";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import {
  Box,
  Check,
  LoaderCircle,
  LogOut,
  TriangleAlert,
} from "./icons";
import { Button } from "./ui";
import { Shell } from "./Shell";
import { LoginPage } from "./LoginPage";
import { appStartupPhase, hasVerifiedSession } from "./auth-gate";
import { AppSplash, LoadingState } from "./LoadingState";
import { appHref, loginHref, loginReturnTarget, readAppRoute, replaceAppLocation } from "./app-routes";
import { formatUsdc } from "./live-api";
import { supportedChains } from "./live-config";
import {
  GoalDetail,
  CreateGoalModal,
  DepositModal,
  WalletStepModal,
  RecoveryPanel,
} from "./live-components";
import { useLiveController } from "./useLiveController";
import { ActivityPage, GoalHistoryPage, WalletsPage, SettingsPage } from "./account-pages";
import { GoalsOverview } from "./GoalsOverview";
import { FaucetsPage } from "./FaucetsPage";
import { GoalSetupPanel } from "./GoalSetupPanel";
import "./live.css";
import "./app-refinement.css";
const solanaConnectors = toSolanaWalletConnectors();
const solanaDevnet = {
  rpc: createSolanaRpc("https://api.devnet.solana.com"),
  rpcSubscriptions: createSolanaRpcSubscriptions("wss://api.devnet.solana.com"),
};
export default function LiveApp() {
  const appId = import.meta.env.VITE_PRIVY_APP_ID;
  if (!appId)
    return <LoginPage status="unavailable" />;
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["google", "email", "wallet"],
        appearance: {
          theme: "light",
          accentColor: "#215a92",
          walletChainType: "ethereum-and-solana",
        },
        supportedChains,
        defaultChain: supportedChains[0],
        embeddedWallets: {
          // Custom Google/OTP login provisions missing wallets in useWalletOnboarding.
          ethereum: { createOnLogin: "off" },
          solana: { createOnLogin: "off" },
        },
        solana: { rpcs: { "solana:devnet": solanaDevnet } },
        externalWallets: { solana: { connectors: solanaConnectors } },
      }}
    >
      <AuthenticatedApp />
    </PrivyProvider>
  );
}

function AuthenticatedApp() {
  const {
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
    historyLoading, historyError, refreshHistory,
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
    recoveries,
    apiRequests,
    unresolved,
    hasPending,
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
    goalSetup,
    continueGoalSetup,
  } = useLiveController();
  const emailLogin = useLoginWithEmail();
  const googleLogin = useLoginWithOAuth();
  const { isOpen } = useModalStatus();
  const verified = walletOnboarding.complete && hasVerifiedSession({ ready, authenticated, userId: user?.id,
    appId: import.meta.env.VITE_PRIVY_APP_ID, session });
  useEffect(() => {
    if (!ready) return;
    try {
      if (authenticated) localStorage.setItem("nabungfi:session-hint", "1");
      else localStorage.removeItem("nabungfi:session-hint");
    } catch {
      /* Optional startup hint only. Authentication never uses it. */
    }
    if (!authenticated && location.pathname.replace(/\/$/, "") !== "/login") {
      const route = readAppRoute(location);
      replaceAppLocation(loginHref(appHref(route.destination, route.goalId ?? undefined)));
    } else if (verified && location.pathname.replace(/\/$/, "") === "/login") {
      replaceAppLocation(loginReturnTarget(location.search));
    }
  }, [ready, authenticated, verified, destination]);
  const startup=appStartupPhase({ready,authenticated,verified,initialReadSettled,offline:pwa.offline,error});
  if (startup === "splash") return <AppSplash preparingWallets={walletOnboarding.pending} />;
  if (!verified) {
    return <LoginPage
      status={!ready ? "initializing" : authenticated ? "verifying" : "ready"}
      offline={pwa.offline}
      error={authenticated ? error : undefined}
      retry={authenticated && error ? () => walletOnboarding.complete ? void load() : walletOnboarding.retry() : undefined}
      signOut={authenticated ? () => void logout() : undefined}
      sendCode={email => emailLogin.sendCode({ email })}
      verifyCode={code => emailLogin.loginWithCode({ code })}
      walletLogin={() => login({ loginMethods: ["wallet"] })}
      googleLogin={async () => {
        try { await googleLogin.initOAuth({ provider: "google" }); }
        catch { throw new Error("Google sign-in could not finish. Try again or use email."); }
      }}
      googleBusy={googleLogin.state.status === "loading"}
      googleError={googleLogin.state.status === "error" ? "Google sign-in could not finish. Try again or use email." : undefined}
      captcha={!authenticated && !isOpen ? <Captcha /> : undefined}
    />;
  }
  const account = (
    <>
      <span className="live-account-name">
        {user?.email?.address ?? "Your workshop"}
      </span>
      <Button
        variant="secondary"
        disabled={busy}
        onClick={() => void logout()}
        aria-label="Sign out"
      >
        <LogOut size={16} />
        <span>Sign out</span>
      </Button>
    </>
  );
  return (
    <Shell
      destination={destination === "goals" && selected && historyView ? "activity" : destination}
      onNavigate={navigate}
      pending={hasPending}
      account={account}
    >
      {(
        <>
          {error && (
            <div className="live-notice live-notice--error" role="alert">
              <TriangleAlert size={20} />
              <div>
                <strong>Something needs your attention</strong>
                <p>{error}</p>
              </div>
              <Button
                variant="secondary"
                onClick={() => void load()}
                disabled={busy || pwa.offline}
              >
                Refresh
              </Button>
            </div>
          )}
          {notice && (
            <div className="live-notice live-notice--success" role="status">
              <Check size={20} />
              <div>
                <p>{notice}</p>
              </div>
            </div>
          )}
          {(unresolved.length > 0 || apiRequests.length > 0) && (
            <RecoveryPanel
              recoveries={unresolved}
              requests={apiRequests}
              busy={busy}
              offline={pwa.offline}
              reconcile={checkOriginal}
              retry={recoverRequest}
              resume={resumeOriginal}
              closeUnsent={closeUnsentRequest}
              cancelUnsigned={cancelUnsignedRequest}
              resolveExpired={resolveExpiredRequest}
            />
          )}
          {pwa.offline && !session ? (
            <div className="empty-state">
              <Box size={32} />
              <h2>Your workshop is offline.</h2>
              <p>
                The app shell is available. Reconnect to read current savings
                and verify your account.
              </p>
            </div>
          ) : loading && !session ? (
            <div className="live-loading" role="status">
              <LoaderCircle className="spin" size={22} />
              Verifying your session and reading your goals…
            </div>
          ) : destination === "goals" ? (
            selected && historyView ? (
              <GoalHistoryPage goal={selected} history={history} loading={historyLoading} error={historyError}
                offline={pwa.offline} refresh={refreshHistory} back={() => navigate("activity")} openGoal={() => navigate("goals", selected.id)} />
            ) : goalSetup.intent && goalSetup.intent.goalId===readAppRoute(location).goalId ? (
              <GoalSetupPanel name={goalSetup.intent.name} goal={goals.find(goal=>goal.id===goalSetup.intent?.goalId)}
                paused={goalSetup.intent.paused} blocked={busy || loading || pwa.offline || unresolved.length>0 || apiRequests.length>0}
                requestPending={unresolved.length>0 || apiRequests.length>0}
                refreshing={loading} offline={pwa.offline}
                resume={() => { const goal=goals.find(goal=>goal.id===goalSetup.intent?.goalId); if(goal)continueGoalSetup(goal); }}
                pause={goalSetup.pause} refresh={() => void load()} />
            ) : openingGoal && openingGoal.userId===user?.id && openingGoal.id===readAppRoute(location).goalId ? (
              <LoadingState message="Creating your goal…" description={`Getting ${openingGoal.name} ready for you.`} />
            ) : selected ? (
              <GoalDetail
                goal={selected}
                history={history}
                reducedMotion={reducedMotion}
                back={() => navigate("goals")}
                refresh={() => void load()}
                busy={hasPending || pwa.offline || loading}
                refreshing={loading}
                deposit={() => setDepositing(true)}
                step={(action, network, amountRaw) =>
                  void planStep(selected, action, network, amountRaw)
                }
                setup={() => continueGoalSetup(selected)}
                focusHistory={historyView}
              />
            ) : (
                <GoalsOverview
                  goals={goals}
                  balance={unavailableCount > 0
                    ? "—" : `$${formatUsdc(total)}`}
                  scope={unavailableCount
                    ? `Verified balances · ${unavailableCount} unavailable`
                    : `Across ${goals.length} goal${goals.length === 1 ? "" : "s"}`}
                  blocked={busy || pwa.offline || !session}
                  refreshing={loading} offline={pwa.offline} refresh={() => void load()}
                  create={() => setCreating(true)}
                  open={id => navigate("goals", id)}
                  activity={() => navigate("activity")}
                  wallets={() => navigate("wallets")}
                />
            )
          ) : destination === "wallets" ? (
            <WalletsPage
              wallets={session?.user.wallets ?? []}
              verified={Boolean(session)}
              busy={busy}
              blocked={hasPending || pwa.offline}
              createWallet={(chain) => void createMissingWallet(chain)}
              connect={() => connectWallet()}
              link={() => linkWallet()}
            />
          ) : destination === "faucets" ? (
            <FaucetsPage wallets={session?.user.wallets ?? []} openWallets={() => navigate("wallets")} />
          ) : destination === "activity" ? (
            <ActivityPage
              goals={goals}
              loading={loading}
              offline={pwa.offline}
              refresh={() => void load()}
              openGoal={(id) => navigate("goals", id, true)}
            />
          ) : (
            <SettingsPage
              reducedMotion={reducedMotion}
              setReducedMotion={setReducedMotion}
            />
          )}
          {creating && session && (
            <CreateGoalModal
              wallets={session.user.wallets}
              availableModels={goalModels}
              busy={busy}
              blockedReason={pwa.offline ? "Reconnect before creating your goal." : hasPending ? "Finish or cancel the saved step in the recovery panel before creating another goal. Your draft can stay open." : undefined}
              onClose={() => setCreating(false)}
              create={createGoal}
            />
          )}
          {depositing && selected && (
            <DepositModal
              goal={selected}
              initial={
                depositDraft?.goalId === selected.id ? depositDraft : undefined
              }
              onClose={() => setDepositing(false)}
              plan={(network, amount, approve) =>
                void planStep(
                  selected,
                  approve ? "approve" : "deposit",
                  network,
                  amount,
                )
              }
            />
          )}
          {walletStep && (
            <WalletStepModal
              step={walletStep}
              busy={busy}
              offline={pwa.offline}
              recovery={recoveries.find(
                (record) => record.stepId === walletStep.id,
              )}
              onClose={closeWalletReview}
              setupName={goalSetup.intent?.goalId===walletStep.metadataGoalId ? goalSetup.intent.name : undefined}
              confirm={() => void sendWallet(walletStep)}
              refreshPlan={() => {
                const original = recoveries.find(
                  (record) => record.stepId === walletStep.id,
                );
                if (original) void resumeOriginal(original);
              }}
            />
          )}
        </>
      )}
    </Shell>
  );
}
