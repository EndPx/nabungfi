import {
  Box,
  History,
  Wallet,
  Settings2,
  ChevronRight,
  Download,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import type { ReactNode } from "react";
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
            <i />
            <i />
            <i />
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

export function GoalIllustration({
  model,
  compact = false,
}: {
  model: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`goal-illustration ${compact ? "goal-illustration--compact" : ""}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 260 160" fill="none">
        <ellipse
          cx="130"
          cy="133"
          rx="92"
          ry="13"
          fill="var(--line)"
          opacity=".55"
        />
        {model === "house" ? (
          <>
            <path d="m64 88 66-46 65 45v49H64Z" fill="var(--lime)" />
            <path
              d="m53 91 77-58 77 58-12 6-65-47-65 47Z"
              fill="var(--lime-dark)"
            />
            <path d="M112 96h34v40h-34z" fill="var(--paper)" />
            <path
              d="M78 91h23v22H78zm83 0h21v22h-21z"
              fill="var(--studio-light)"
            />
            <path d="M181 42h14v29h-14z" fill="var(--coral)" />
          </>
        ) : model === "laptop" ? (
          <>
            <path d="M68 43h128l-9 78H58Z" fill="var(--ink)" />
            <path d="M78 54h106l-7 55H70Z" fill="var(--lime)" />
            <path d="m58 121 129 0 29 13-151 4-25-9Z" fill="var(--muted)" />
            <path d="m106 123 43 0 9 7-49 2Z" fill="var(--paper)" />
            <path
              d="M94 85h58m-34-18v37"
              stroke="var(--lime-dark)"
              strokeWidth="6"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <path
              d="m46 108 22-24h48l14 12h59l27 18-11 14H55Z"
              fill="var(--lime)"
            />
            <path
              d="m83 84 17-27h61l28 39h-59l-14-12Z"
              fill="var(--lime-dark)"
            />
            <path
              d="m105 63-10 20h29l-6-20Zm22 0 9 25h35l-18-25Z"
              fill="var(--studio-light)"
            />
            <circle cx="83" cy="126" r="18" fill="var(--ink)" />
            <circle cx="83" cy="126" r="8" fill="var(--paper)" />
            <circle cx="178" cy="126" r="18" fill="var(--ink)" />
            <circle cx="178" cy="126" r="8" fill="var(--paper)" />
            <path d="M199 105h12v9h-12z" fill="var(--paper)" />
            <path d="M52 102h13v8H52z" fill="var(--coral)" />
            <path d="M72 77h15v6H72Zm69-27h15v6h-15Z" fill="var(--lime)" />
          </>
        )}
      </svg>
    </div>
  );
}
