import {
  Box,
  History,
  Wallet,
  Settings2,
  ChevronRight,
  Download,
  WifiOff,
  RefreshCw,
} from "./icons";
import { useEffect, type ReactNode } from "react";
import { Button, Logo } from "./ui";
import { usePwa } from "./pwa";

export type Destination = "goals" | "activity" | "wallets" | "settings";
const destinations = [
  { id: "goals", label: "Goals", Icon: Box },
  { id: "activity", label: "Activity", Icon: History },
  { id: "wallets", label: "Wallets", Icon: Wallet },
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
          <strong>
            Little deposits.
            <br />
            Something big.
          </strong>
          <p>Build a goal one piece at a time.</p>
        </div>
        <a className="sidebar-demo" href="/?demo=1">
          Explore the demo <ChevronRight size={16} />
        </a>
      </aside>
      <div className="live-content">
        <header className="live-header">
          <a href="/" className="mobile-brand" aria-label="NabungFi home">
            <Logo />
          </a>
          <span className="environment-badge">
            <span />
            Testnet savings
          </span>
          <div className="live-account">{account}</div>
        </header>
        <main id="main-content" className="live-main" tabIndex={-1}>
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
          <footer className="live-footer">
            <span>Built for the things you’re building toward.</span>
            <span>Test tokens only · Yield is not active</span>
          </footer>
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
        <h2>Keep your workshop close</h2>
        <p>
          {pwa.standalone
            ? "NabungFi is running as an installed app."
            : pwa.ios
              ? "In Safari, tap Share, then Add to Home Screen. Your wallet opens when you confirm a transaction."
              : "Install NabungFi for a focused app experience. You can also keep using this browser."}
        </p>
      </div>
      {pwa.canInstall && (
        <Button variant="build" onClick={() => void pwa.install()}>
          Install app
        </Button>
      )}
      {pwa.installError && <p role="alert">{pwa.installError}</p>}
    </section>
  );
}

export { GoalIllustration } from "./GoalIllustration";
