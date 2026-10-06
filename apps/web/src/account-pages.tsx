import type { GoalDTO, SessionDTO } from "@nabungfi/shared/application";
import { useId, useState } from "react";
import {
  Box,
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
}: {
  wallets: SessionDTO["user"]["wallets"];
  busy: boolean;
  blocked: boolean;
  verified?: boolean;
  createWallet: (chain: "ethereum" | "solana") => void;
  connect: () => void;
  link: () => void;
}) {
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
          <Button variant="secondary" onClick={connect}>
            Connect wallet
          </Button>
          <Button variant="build" onClick={link}>
            Link owner wallet
          </Button>
        </div>
      </PageHeading>
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
            <p className="live-address">{wallet.address}</p>
            <p className="live-help">
              {wallet.chainType === "solana"
                ? "Solana Devnet"
                : "Base, Arbitrum and Ethereum Sepolia"}
            </p>
            <div className="wallet-network-marks" role="img" aria-label={wallet.chainType === "solana" ? "Solana" : "Base, Arbitrum and Ethereum"}>
              {wallet.chainType === "solana" ? <NetworkMark network="solana" /> : <><NetworkMark network="base" /><NetworkMark network="arbitrum" /><NetworkMark network="ethereum" /></>}
            </div>
            <Button className="wallet-copy" variant="secondary" onClick={() => void copyAddress(wallet.address)} aria-label={`Copy ${wallet.chainType === "solana" ? "Solana" : "EVM"} wallet address`}><Copy size={18} />{copied === wallet.address ? "Copied" : "Copy address"}</Button>
          </section>
        ))}
      </div>
      <div className="live-notice">
        <ShieldCheck size={24} />
        <div>
          <strong>Your wallet confirms every financial action</strong>
          <p>
            NabungFi does not ask for your seed phrase. Signing and transaction
            fees stay in your wallet.
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
