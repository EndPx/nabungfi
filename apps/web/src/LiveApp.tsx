import { PrivyProvider } from "@privy-io/react-auth";
import { useEffect, useRef } from "react";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import {
  Box,
  Check,
  ChevronRight,
  ExternalLink,
  History,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Plus,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { Button } from "./ui";
import { InstallPanel, Shell } from "./Shell";
import { formatUsdc } from "./live-api";
import { phases, supportedChains } from "./live-config";
import {
  Welcome,
  GoalCard,
  GoalDetail,
  CreateGoalModal,
  DepositModal,
  WalletStepModal,
  RecoveryPanel,
} from "./live-components";
import { useLiveController } from "./useLiveController";
import "./live.css";
const solanaConnectors = toSolanaWalletConnectors();
const solanaDevnet = {
  rpc: createSolanaRpc("https://api.devnet.solana.com"),
  rpcSubscriptions: createSolanaRpcSubscriptions("wss://api.devnet.solana.com"),
};
export default function LiveApp({
  loginRequested = false,
}: {
  loginRequested?: boolean;
}) {
  const appId = import.meta.env.VITE_PRIVY_APP_ID;
  if (!appId)
    return (
      <Shell
        destination="goals"
        onNavigate={() => undefined}
        pending={false}
        account={<a href="/?demo=1">Explore demo</a>}
      >
        <Welcome configured={false} />
      </Shell>
    );
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "wallet"],
        appearance: {
          theme: "light",
          accentColor: "#3e551e",
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
      <AuthenticatedApp loginRequested={loginRequested} />
    </PrivyProvider>
  );
}

function AuthenticatedApp({ loginRequested }: { loginRequested: boolean }) {
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
  const attemptedLogin = useRef(false);
  useEffect(() => {
    if (!ready) return;
    try {
      if (authenticated) localStorage.setItem("nabungfi:session-hint", "1");
      else localStorage.removeItem("nabungfi:session-hint");
    } catch {
      /* Optional startup hint only. Authentication never uses it. */
    }
    if (
      loginRequested &&
      !authenticated &&
      !attemptedLogin.current &&
      !pwa.offline
    ) {
      attemptedLogin.current = true;
      login();
    }
  }, [ready, authenticated, loginRequested, login, pwa.offline]);
  const account = authenticated ? (
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
  ) : (
    <Button
      variant="secondary"
      disabled={!ready || pwa.offline}
      onClick={login}
    >
      Sign in
    </Button>
  );
  return (
    <Shell
      destination={destination}
      onNavigate={navigate}
      pending={hasPending}
      account={account}
    >
      {!authenticated ? (
        destination === "settings" ? (
          <>
            <div className="page-heading">
              <div>
                <h1>Your workshop, your way.</h1>
                <p>Install NabungFi or sign in to personalize your goals.</p>
              </div>
            </div>
            <InstallPanel />
          </>
        ) : destination !== "goals" ? (
          <div className="empty-state">
            <Wallet size={32} />
            <h2>Sign in to your workshop.</h2>
            <p>
              Your wallets, goals and activity stay tied to your verified
              account.
            </p>
            <Button
              variant="build"
              disabled={!ready || pwa.offline}
              onClick={login}
            >
              Sign in
            </Button>
          </div>
        ) : (
          <Welcome login={login} ready={ready} offline={pwa.offline} />
        )
      ) : (
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
                    <h1>Your next big things.</h1>
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
                <section className="overview-banner">
                  <div>
                    <h2>Every little piece counts.</h2>
                    <p>
                      Your savings stay assigned to their own goal. Finishing
                      one build never unlocks another.
                    </p>
                  </div>
                  <div className="banner-summary">
                    <strong>
                      {goals.length > 0 && unavailableCount === goals.length
                        ? "—"
                        : `$${formatUsdc(total)}`}
                    </strong>
                    <span>
                      {unavailableCount
                        ? `Verified balances · ${unavailableCount} unavailable`
                        : `Across ${goals.length} goal${goals.length === 1 ? "" : "s"}`}
                    </span>
                  </div>
                </section>
                {goals.length ? (
                  <div className="goal-grid">
                    {goals.map((goal) => (
                      <GoalCard
                        key={goal.id}
                        goal={goal}
                        onOpen={() => navigate("goals", goal.id)}
                      />
                    ))}
                    <button
                      type="button"
                      className="goal-card goal-card-add"
                      disabled={hasPending || pwa.offline}
                      onClick={() => setCreating(true)}
                    >
                      <span className="section-icon">
                        <Plus />
                      </span>
                      <strong>Make room for a new goal</strong>
                      <span className="live-help">
                        What are you building toward?
                      </span>
                    </button>
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
            <>
              <div className="page-heading">
                <div>
                  <h1>Your wallets.</h1>
                  <p>
                    Only verified owner wallets can create, deposit into, or
                    claim your goals.
                  </p>
                </div>
                <div className="live-actions">
                  {session &&
                    !session.user.wallets.some(
                      (wallet) => wallet.chainType === "ethereum",
                    ) && (
                      <Button
                        variant="build"
                        busy={busy}
                        disabled={hasPending || pwa.offline}
                        onClick={() => void createMissingWallet("ethereum")}
                      >
                        Create EVM wallet
                      </Button>
                    )}
                  {session &&
                    !session.user.wallets.some(
                      (wallet) => wallet.chainType === "solana",
                    ) && (
                      <Button
                        variant="build"
                        busy={busy}
                        disabled={hasPending || pwa.offline}
                        onClick={() => void createMissingWallet("solana")}
                      >
                        Create Solana wallet
                      </Button>
                    )}
                  <Button variant="secondary" onClick={() => connectWallet()}>
                    Connect wallet
                  </Button>
                  <Button variant="build" onClick={() => linkWallet()}>
                    Link owner wallet
                  </Button>
                </div>
              </div>
              <div className="wallet-list">
                {session?.user.wallets.map((wallet) => (
                  <section
                    className="live-panel"
                    key={`${wallet.chainType}:${wallet.address}`}
                  >
                    <div className="wallet-identity">
                      <span className="section-icon">
                        <Wallet size={22} />
                      </span>
                      <div>
                        <h2>
                          {wallet.chainType === "solana"
                            ? "Solana wallet"
                            : "EVM wallet"}
                        </h2>
                        <span className="live-help">Verified by Privy</span>
                      </div>
                    </div>
                    <p className="live-address">{wallet.address}</p>
                    <p className="live-help">
                      {wallet.chainType === "solana"
                        ? "Solana Devnet"
                        : "Base, Arbitrum and Ethereum Sepolia"}
                    </p>
                  </section>
                ))}
              </div>
              <div className="live-notice">
                <ShieldCheck size={20} />
                <div>
                  <strong>Your wallet confirms every financial action</strong>
                  <p>
                    NabungFi does not ask for your seed phrase. Signing and
                    transaction fees stay in your wallet.
                  </p>
                </div>
              </div>
            </>
          ) : destination === "activity" ? (
            <>
              <div className="page-heading">
                <div>
                  <h1>What’s been built.</h1>
                  <p>
                    Inspect confirmed and pending steps independently for each
                    goal.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => void load()}
                  disabled={loading || pwa.offline}
                >
                  <RefreshCw size={18} />
                  Refresh
                </Button>
              </div>
              {goals.length ? (
                <div className="live-panel live-timeline">
                  {goals.map((goal) => (
                    <div className="live-timeline-row" key={goal.id}>
                      <div>
                        <strong>{goal.name}</strong>
                        <p>
                          {phases[goal.chainState?.phase ?? "unprovisioned"]} ·{" "}
                          {goal.chainStatus === "unavailable"
                            ? "Read unavailable"
                            : "Testnet"}
                        </p>
                      </div>
                      <Button
                        variant="quiet"
                        onClick={() => navigate("goals", goal.id)}
                      >
                        View history
                        <ChevronRight size={18} />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <History size={32} />
                  <h2>Nothing recorded yet.</h2>
                  <p>
                    Your transaction history appears here after you create a
                    goal.
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <h1>Your workshop, your way.</h1>
                  <p>
                    A quieter build, an app on your home screen, and clear rules
                    for your savings.
                  </p>
                </div>
              </div>
              <div className="settings-stack">
                <InstallPanel />
                <section className="settings-panel">
                  <span className="section-icon">
                    <Box size={22} />
                  </span>
                  <div>
                    <h2>Less motion</h2>
                    <p>
                      Build pieces without flying animations. Sound stays under
                      the control in each workshop.
                    </p>
                  </div>
                  <label className="live-check">
                    <input
                      type="checkbox"
                      checked={reducedMotion}
                      onChange={(event) =>
                        setReducedMotion(event.target.checked)
                      }
                    />
                    Reduce motion
                  </label>
                </section>
                <section className="settings-panel">
                  <span className="section-icon">
                    <LockKeyhole size={22} />
                  </span>
                  <div>
                    <h2>The savings commitment</h2>
                    <p>
                      Each goal unlocks only after its own target is reached and
                      completion is delivered to its vaults. If the target is
                      never reached, funds remain locked. Strategy yield is not
                      active in this release.
                    </p>
                  </div>
                </section>
                <section className="settings-panel">
                  <span className="section-icon">
                    <ShieldCheck size={22} />
                  </span>
                  <div>
                    <h2>Testnet environment</h2>
                    <p>
                      Use faucet USDC and gas tokens. This application connects
                      to the deployed testnet contracts; it is not a mainnet
                      launch.
                    </p>
                  </div>
                  <a
                    className="button button--secondary"
                    href="https://github.com/EndPx/nabungfi"
                    target="_blank"
                    rel="noreferrer"
                  >
                    View source
                    <ExternalLink size={16} />
                  </a>
                </section>
              </div>
            </>
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
            />
          )}
        </>
      )}
    </Shell>
  );
}
