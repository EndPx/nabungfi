import { Captcha, PrivyProvider, useLoginWithEmail, useModalStatus } from "@privy-io/react-auth";
import { useEffect } from "react";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import {
  Box,
  Check,
  LoaderCircle,
  LogOut,
  Plus,
  TriangleAlert,
} from "./icons";
import { Button } from "./ui";
import { Shell } from "./Shell";
import { LoginPage } from "./LoginPage";
import { hasVerifiedSession } from "./auth-gate";
import { appHref, loginHref, loginReturnTarget, readAppRoute, replaceAppLocation } from "./app-routes";
import { formatUsdc } from "./live-api";
import { supportedChains } from "./live-config";
import {
  GoalCard,
  PortfolioSummary,
  GoalDetail,
  CreateGoalModal,
  DepositModal,
  WalletStepModal,
  RecoveryPanel,
} from "./live-components";
import { useLiveController } from "./useLiveController";
import { ActivityPage, WalletsPage, SettingsPage } from "./account-pages";
import "./live.css";
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
        loginMethods: ["email", "wallet"],
        appearance: {
          theme: "light",
          accentColor: "#215a92",
          walletChainType: "ethereum-and-solana",
        },
        supportedChains,
        defaultChain: supportedChains[0],
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
          solana: { createOnLogin: "users-without-wallets" },
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
    selected,
    history,
    loading,
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
    createMissingWallet,
  } = useLiveController();
  const emailLogin = useLoginWithEmail();
  const { isOpen } = useModalStatus();
  const verified = hasVerifiedSession({ ready, authenticated, userId: user?.id,
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
  if (!verified) {
    return <LoginPage
      status={!ready ? "initializing" : authenticated ? "verifying" : "ready"}
      offline={pwa.offline}
      error={authenticated ? error : undefined}
      retry={authenticated && error ? () => void load() : undefined}
      signOut={authenticated ? () => void logout() : undefined}
      sendCode={email => emailLogin.sendCode({ email })}
      verifyCode={code => emailLogin.loginWithCode({ code })}
      walletLogin={() => login({ loginMethods: ["wallet"] })}
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
      destination={destination}
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
            selected ? (
              <GoalDetail
                goal={selected}
                history={history}
                reducedMotion={reducedMotion}
                back={() => navigate("goals")}
                refresh={() => void load()}
                busy={hasPending || pwa.offline}
                deposit={() => setDepositing(true)}
                step={(action, network, amountRaw) =>
                  void planStep(selected, action, network, amountRaw)
                }
              />
            ) : (
              <>
                <div className="page-heading">
                  <div>
                    <h1>Your goals</h1>
                    <p>Separate goals. Separate vaults. One workshop.</p>
                  </div>
                  <Button
                    variant="build"
                    onClick={() => setCreating(true)}
                    disabled={hasPending || pwa.offline || !session}
                  >
                    <Plus size={18} />
                    New goal
                  </Button>
                </div>
                <PortfolioSummary
                  balance={goals.length > 0 && unavailableCount === goals.length
                    ? "—" : `$${formatUsdc(total)}`}
                  scope={unavailableCount
                    ? `Verified balances · ${unavailableCount} unavailable`
                    : `Across ${goals.length} goal${goals.length === 1 ? "" : "s"}`}
                />
                {goals.length ? (
                  <div className="goal-grid">
                    {goals.map((goal) => (
                      <GoalCard
                        key={goal.id}
                        goal={goal}
                        onOpen={() => navigate("goals", goal.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <span className="section-icon">
                      <Box />
                    </span>
                    <h2>Your first build starts here.</h2>
                    <p>
                      Choose a goal and its target. Set up your vaults, then add
                      testnet USDC at your own pace.
                    </p>
                    <Button
                      variant="build"
                      onClick={() => setCreating(true)}
                      disabled={hasPending || pwa.offline || !session}
                    >
                      <Plus size={18} />
                      Create your first goal
                    </Button>
                  </div>
                )}
              </>
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
          ) : destination === "activity" ? (
            <ActivityPage
              goals={goals}
              loading={loading}
              offline={pwa.offline}
              refresh={() => void load()}
              openGoal={(id) => navigate("goals", id)}
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
              busy={busy}
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
              onClose={() => setWalletStep(null)}
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
