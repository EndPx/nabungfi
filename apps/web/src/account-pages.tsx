import type { GoalDTO, GoalHistoryEntry, SessionDTO, WalletBalanceDTO } from "@nabungfi/shared/application";
import { useEffect, useId, useRef, useState } from "react";
import {
  Box,
  ArrowLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  History,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
} from "./icons";
import { Button, NetworkMark, PageHeading } from "./ui";
import { InstallPanel } from "./Shell";
import { phases } from "./live-config";
import { WalletAddress } from "./WalletAddress";
import { HistoryList } from "./live-components";
import { walletNetworks, validateWalletBalances, walletGasLabel } from "./wallet-balances";
import { formatExactUsdc } from "./savings-progress";
import { networks } from "./live-config";

export function GoalHistoryPage({goal,history,loading,error,offline,refresh,back,openGoal}: {
  goal: GoalDTO; history: GoalHistoryEntry[]; loading: boolean; error: string; offline: boolean;
  refresh: () => void; back: () => void; openGoal: () => void;
}) {
  const section = useRef<HTMLElement>(null);
  useEffect(() => {section.current?.focus({preventScroll:true});section.current?.scrollIntoView({block:"start",behavior:"instant"});},[goal.id]);
  return <>
    <button type="button" className="live-back" onClick={back}><ArrowLeft size={18} />Back to activity</button>
    <PageHeading title={goal.name} description="Goal activity · Recorded wallet steps, with their dates and outcomes.">
      <Button variant="secondary" onClick={openGoal}>View goal<ChevronRight size={18} /></Button>
    </PageHeading>
    <section ref={section} tabIndex={-1} id="goal-activity" className="live-panel goal-history-panel" aria-label="Goal activity">
      <h2>Goal activity</h2>
      {loading ? <p className="live-help" role="status">Loading recorded wallet steps…</p> : error ? <p className="live-error" role="alert">{error}</p> : <HistoryList history={history} />}
      <Button variant="quiet" disabled={loading || offline} busy={loading} onClick={refresh}><RefreshCw size={18} />{error ? "Retry history" : "Refresh history"}</Button>
      {offline && <p className="live-help">Reconnect to read the latest activity.</p>}
    </section>
  </>;
}

export function ActivityPage({
  goals,
  loading,
  offline,
  refresh,
  openGoal,
}: {
  goals: GoalDTO[];
  loading: boolean;
  offline: boolean;
  refresh: () => void;
  openGoal: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const searchId = useId();
  const visible = goals.filter(goal => goal.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return (
    <>
      <PageHeading
        title="Activity"
        description="Open a goal to see its confirmed, pending and failed wallet steps."
      >
        <Button
          variant="secondary"
          onClick={refresh}
          disabled={loading || offline}
        >
          <RefreshCw size={18} />
          Refresh
        </Button>
      </PageHeading>
      {goals.length > 0 && <label className="app-search activity-search" htmlFor={searchId}><Search size={19} /><span className="sr-only">Search goal histories</span><input id={searchId} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a goal’s history" /></label>}
      {goals.length ? (
        <section className="live-panel live-timeline" aria-label="Goal histories">
          {visible.map((goal) => (
            <div className="live-timeline-row" key={goal.id}>
              <div className="activity-goal-identity">
                <span className="section-icon"><History size={24} /></span><div>
                <strong>{goal.name}</strong>
                <p>
                  {phases[goal.chainState?.phase ?? "unprovisioned"]} ·{" "}
                  {goal.chainStatus === "unavailable"
                    ? "Read unavailable"
                    : `${goal.binding.participants.length + 1} chains`}
                </p>
                </div>
              </div>
              <Button variant="quiet" onClick={() => openGoal(goal.id)}>
                View history
                <ChevronRight size={18} />
              </Button>
            </div>
          ))}
          {visible.length === 0 && <p className="live-help" role="status">No goal histories match that name.</p>}
        </section>
      ) : (
        <div className="empty-state">
          <History size={40} />
          <h2>Nothing recorded yet.</h2>
          <p>Your transaction history appears here after you create a goal.</p>
        </div>
      )}
    </>
  );
}

export function WalletsPage({
  wallets,
  busy,
  blocked,
  verified = true,
  createWallet,
  connect,
  link,
  readBalances,
  offline = false,
}: {
  wallets: SessionDTO["user"]["wallets"];
  busy: boolean;
  blocked: boolean;
  verified?: boolean;
  createWallet: (chain: "ethereum" | "solana") => void;
  connect: () => void;
  link: () => void;
  readBalances?: () => Promise<WalletBalanceDTO[]>;
  offline?: boolean;
}) {
  const walletKey = wallets.map(wallet => `${wallet.chainType}:${wallet.address}`).sort().join("|");
  const [revision, setRevision] = useState(0);
  const [balanceRead, setBalanceRead] = useState<{key: string; rows: WalletBalanceDTO[]; loading: boolean; error: string}>({key: "", rows: [], loading: false, error: ""});
  useEffect(() => {
    if (!readBalances || !verified || offline || !walletKey) return;
    let active = true, inFlight = false;
    const loadBalances = async () => {
      if (inFlight) return;
      inFlight = true;
      setBalanceRead(prior => ({key: walletKey, rows: prior.key === walletKey ? prior.rows : [], loading: true, error: ""}));
      try {
        const rows = validateWalletBalances(await readBalances(), wallets);
        if (active) setBalanceRead({key: walletKey, rows, loading: false, error: ""});
      } catch {
        if (active) setBalanceRead({key: walletKey, rows: [], loading: false, error: "Wallet balances couldn’t be verified. Refresh to try again."});
      } finally { inFlight = false; }
    };
    void loadBalances();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible" && navigator.onLine) void loadBalances(); }, 30000);
    return () => { active = false; window.clearInterval(timer); };
    // Membership changes only when authoritative wallet identities change.
  }, [walletKey, readBalances, verified, offline, revision]);
  const balances = balanceRead.key === walletKey ? balanceRead.rows : [];
  const balancesLoading = !offline && Boolean(readBalances) && (balanceRead.key !== walletKey || balanceRead.loading);
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState("");
  const copyAddress = async (address: string) => {
    setCopyError(""); setCopied("");
    try { await navigator.clipboard.writeText(address); setCopied(address); }
    catch { setCopyError("Your browser could not copy the address. Select the address above to copy it manually."); }
  };
  return (
    <>
      <PageHeading
        title="Wallets"
        description="Verified owners of your savings goals. Your wallet confirms each financial action."
      >
        <div className="live-actions">
          {wallets.length > 0 && readBalances && <Button variant="secondary" busy={balancesLoading} disabled={balancesLoading || offline} onClick={() => setRevision(value => value + 1)}><RefreshCw size={18} />Refresh balances</Button>}
          {verified &&
            !wallets.some((wallet) => wallet.chainType === "ethereum") && (
              <Button
                variant="build"
                busy={busy}
                disabled={blocked}
                onClick={() => createWallet("ethereum")}
              >
                Create EVM wallet
              </Button>
            )}
          {verified &&
            !wallets.some((wallet) => wallet.chainType === "solana") && (
              <Button
                variant="build"
                busy={busy}
                disabled={blocked}
                onClick={() => createWallet("solana")}
              >
                Create Solana wallet
              </Button>
            )}
        </div>
      </PageHeading>
      {wallets.length > 0 && <p className="live-help" role="status">{offline ? "You’re offline. Displayed balances are from the last verified read." : balancesLoading ? balances.length ? "Updating wallet balances. Showing the last verified read." : "Loading wallet balances…" : balanceRead.key === walletKey && balanceRead.error ? balanceRead.error : "Wallet balances are separate from savings held in your goal vaults."}</p>}
      <div className="wallet-list">
        {wallets.map((wallet) => (
          <section
            className="live-panel"
            key={`${wallet.chainType}:${wallet.address}`}
          >
            <div className="wallet-identity">
              <span className="section-icon">
                <Wallet size={28} />
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
            <WalletAddress address={wallet.address} chains={wallet.chainType === "solana" ? ["solana"] : ["base", "arbitrum", "ethereum"]} />
            <p className="live-help">
              {wallet.chainType === "solana"
                ? "Solana Devnet"
                : "Base, Arbitrum and Ethereum Sepolia"}
            </p>
            <div className="wallet-balances" aria-label={`${wallet.chainType === "solana" ? "Solana" : "EVM"} token balances`}>
              {walletNetworks(wallet.chainType).map(network => {
                const balance = balances.find(row => row.address === wallet.address && row.network === network);
                const known = balance?.status === "available";
                const gas = known ? walletGasLabel(balance.nativeRaw!, network) : null;
                return <div key={network} className="wallet-balance-network">
                  <div className="wallet-balance-heading"><NetworkMark network={network} /><strong>{networks[network]}</strong></div>
                  <dl className="wallet-token-values">
                    <div><dt>USDC</dt><dd>{known ? `${formatExactUsdc(balance.usdcRaw!)} USDC` : "—"}</dd></div>
                    <div><dt>{network === "solana" ? "SOL" : "ETH"} · Gas</dt><dd>{gas ? <span title={gas.exact} aria-label={gas.exact}>{gas.display}</span> : "—"}</dd></div>
                  </dl>
                  {known ? <small className="live-help">Last verified <time dateTime={balance.observedAt}>{new Date(balance.observedAt).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}</time></small> : <small className="live-help">{balancesLoading ? "Loading balances…" : offline ? "Reconnect to verify balances" : "Balances unavailable"}</small>}
                </div>;
              })}
            </div>
            <Button className="wallet-copy" variant="secondary" onClick={() => void copyAddress(wallet.address)} aria-label={`Copy ${wallet.chainType === "solana" ? "Solana" : "EVM"} wallet address`}><Copy size={18} />{copied === wallet.address ? "Copied" : "Copy address"}</Button>
          </section>
        ))}
      </div>
      <details className="wallet-extra-actions">
        <summary>External wallet options</summary>
        <p className="live-help">Connect a wallet for this session, or link it to your account for future sign-ins. Neither changes the owner wallets of existing goals.</p>
        <div className="live-actions">
          <Button variant="secondary" onClick={connect} disabled={busy || blocked}>Connect external wallet</Button>
          <Button variant="secondary" onClick={link} disabled={busy || blocked}>Link external wallet</Button>
        </div>
      </details>
      <div className="live-notice">
        <ShieldCheck size={24} />
        <div>
          <strong>Your wallet confirms every financial action</strong>
          <p>
            NabungFi does not ask for your seed phrase. You review and approve
            every transaction in your wallet.
          </p>
        </div>
      </div>
      <p className="sr-only" role="status">{copied ? "Wallet address copied" : ""}</p>
      {copyError && <p className="live-error" role="alert">{copyError}</p>}
    </>
  );
}

export function SettingsPage({
  reducedMotion,
  setReducedMotion,
}: {
  reducedMotion: boolean;
  setReducedMotion: (value: boolean) => void;
}) {
  return (
    <>
      <PageHeading
        title="Settings"
        description="Make the workshop your own, and keep the savings rules close."
      />
      <div className="settings-stack">
        <section className="settings-group" aria-labelledby="settings-app"><h2 id="settings-app">APP & WORKSHOP</h2>
        <InstallPanel />
        <section className="settings-panel">
          <span className="section-icon">
            <Box size={28} />
          </span>
          <div>
            <h2>Less motion</h2>
            <p>
              Build pieces without flying animations. Sound stays under the
              control in each workshop.
            </p>
          </div>
          <label className="live-check">
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(event) => setReducedMotion(event.target.checked)}
            />
            Reduce motion
          </label>
        </section>
        </section>
        <section className="settings-group" aria-labelledby="settings-savings"><h2 id="settings-savings">YOUR SAVINGS</h2>
        <section className="settings-panel">
          <span className="section-icon">
            <LockKeyhole size={24} />
          </span>
          <div>
            <h2>The savings commitment</h2>
            <p>
              Each goal unlocks only after its own target is reached and
              completion is delivered to its vaults. If the target is never
              reached, funds remain locked. Strategy yield is not active in this
              release.
            </p>
          </div>
        </section>
        <section className="settings-panel">
          <span className="section-icon">
            <ShieldCheck size={24} />
          </span>
          <div>
            <h2>Testnet environment</h2>
            <p>
              Use faucet USDC and gas tokens. This application connects to the
              deployed testnet contracts; it is not a mainnet launch.
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
        </section>
      </div>
    </>
  );
}
