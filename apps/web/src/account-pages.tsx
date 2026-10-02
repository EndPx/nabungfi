import type { GoalDTO, SessionDTO } from "@nabungfi/shared/application";
import {
  Box,
  ChevronRight,
  ExternalLink,
  History,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "./icons";
import { Button, PageHeading } from "./ui";
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
  return (
    <>
      <PageHeading
        title="Activity"
        description="Confirmed and pending steps, kept separate for every goal."
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
              <Button variant="quiet" onClick={() => openGoal(goal.id)}>
                View history
                <ChevronRight size={18} />
              </Button>
            </div>
          ))}
        </div>
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
      </div>
    </>
  );
}
