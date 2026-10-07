import {
  Box,
  History,
  Wallet,
  Settings2,
  Faucet,
  ChevronRight,
  Download,
  WifiOff,
  RefreshCw,
} from "./icons";
import { useEffect, type ReactNode } from "react";
import { Button, Logo } from "./ui";
import { usePwa } from "./pwa";

export type { Destination } from "./app-routes";
import type { Destination } from "./app-routes";
const destinations = [
  { id: "goals", label: "Goals", Icon: Box },
  { id: "activity", label: "Activity", Icon: History },
  { id: "wallets", label: "Wallets", Icon: Wallet },
  { id: "faucets", label: "Faucets", Icon: Faucet },
  { id: "settings", label: "Settings", Icon: Settings2 },
] as const;

export function Shell({
  destination,
  onNavigate,
  children,
  account,
  pending,
}: {
  destination: Destination;
  onNavigate: (value: Destination) => void;
  children: ReactNode;
  account: ReactNode;
  pending: boolean;
}) {
  const pwa = usePwa();
  useEffect(() => {
    document.title = `${destinations.find((item) => item.id === destination)?.label ?? "Goals"} · NabungFi`;
  }, [destination]);
  return (
    <div className="live-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="live-sidebar">
        <a href="/" className="brand-link" aria-label="NabungFi home">
          <Logo />
        </a>
        <nav className="live-navigation" aria-label="Main navigation">
          {destinations.map(({ id, label, Icon }) => (
            <button
              type="button"
              key={id}
              onClick={() => onNavigate(id)}
              aria-current={destination === id ? "page" : undefined}
              className={destination === id ? "is-active" : ""}
            >
              <Icon size={21} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="sidebar-mini-blocks" aria-hidden="true">
            <Box size={44} />
          </div>
          <strong>Your workshop</strong>
          <p>Independent USDC goals.</p>
        </div>
      </aside>
      <div className="live-content">
        <header className="live-header">
          <a href="/" className="mobile-brand" aria-label="NabungFi home">
            <Logo />
          </a>
          <span className="live-location">
            Your workshop <ChevronRight size={14} />
            <strong>{destinations.find((item) => item.id === destination)?.label}</strong>
          </span>
          <div className="live-header-tools">
            {pwa.canInstall && <Button className="live-header-install" variant="secondary" busy={pwa.installing} disabled={pending} onClick={() => void pwa.install()}><Download size={18} />Install app</Button>}
            <div className="live-account">{account}</div>
          </div>
        </header>
        <main id="main-content" className="live-main" tabIndex={-1}>
          {pwa.installError && <p className="live-notice" role="alert">{pwa.installError}</p>}
          {pwa.offline && (
            <div className="live-notice" role="status">
              <WifiOff size={20} />
              <div>
                <strong>You’re offline</strong>
                <p>
                  Reconnect to refresh savings or use your wallet. No
                  transactions will be sent offline.
                </p>
              </div>
            </div>
          )}
          {pwa.updateAvailable && (
            <div className="live-notice">
              <RefreshCw size={20} />
              <div>
                <strong>A new version is ready</strong>
                <p>
                  {pending
                    ? "Reconcile the pending wallet request before updating."
                    : "Update when you are ready. Your savings stay onchain."}
                </p>
              </div>
              <Button
                variant="secondary"
                disabled={pending}
                onClick={pwa.update}
              >
                Update
              </Button>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

export function InstallPanel() {
  const pwa = usePwa();
  return (
    <section className="settings-panel">
      <div className="section-icon">
        <Download size={22} />
      </div>
      <div>
        <h2>Install NabungFi</h2>
        <p>
          {pwa.standalone
            ? "NabungFi is running as an installed app."
            : pwa.installed
              ? "NabungFi is installed. Open it from your apps to use its own window."
            : pwa.ios
              ? "In Safari, tap Share, then Add to Home Screen. Your wallet opens when you confirm a transaction."
              : "Keep your goals a tap away, in their own app window on your phone or desktop."}
        </p>
      </div>
      {pwa.canInstall && (
        <Button variant="build" busy={pwa.installing} onClick={() => void pwa.install()}>
          Install app
        </Button>
      )}
      {pwa.installError && <p role="alert">{pwa.installError}</p>}
      {pwa.installOutcome === "dismissed" && <p className="install-feedback" role="status">No problem. Keep using NabungFi here, or install it later from your browser menu.</p>}
      {pwa.installOutcome === "accepted" && !pwa.standalone && <p className="install-feedback" role="status">Installation requested. Your browser will finish setting up the app.</p>}
      {!pwa.standalone && !pwa.installed && <details className="settings-install-details"><summary>How to add the app</summary><p>{pwa.ios ? "Open NabungFi in Safari, tap Share, choose Add to Home Screen, then tap Add." : "In Chrome or Edge, use the install icon in the address bar or the browser menu’s install option. In Safari on a Mac, choose File, then Add to Dock."}</p><p>Open the NabungFi icon to return to your goals. Wallet confirmations still open when you make a financial action.</p></details>}
    </section>
  );
}

export { GoalIllustration } from "./GoalIllustration";
