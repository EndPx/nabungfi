import { lazy, Suspense, useEffect, useState } from "react";
import { Shell, InstallPanel, type Destination } from "./Shell";
import { Welcome } from "./live-components";
import { Button, Logo } from "./ui";
import { usePwa } from "./pwa";
import "./live.css";

const LiveApp = lazy(() => import("./LiveApp"));
function returningAccount() {
  try {
    return localStorage.getItem("nabungfi:session-hint") === "1";
  } catch {
    return false;
  }
}
function destinationFromHash(): Destination {
  const value = location.hash.slice(1).split("?")[0];
  return value === "activity" || value === "wallets" || value === "settings"
    ? value
    : "goals";
}
export default function Entry() {
  // This non-sensitive hint only decides whether to load the auth SDK eagerly.
  // Privy + the API still verify the account; it grants no access or authority.
  const [openAccount, setOpenAccount] = useState(returningAccount);
  const [loginRequested, setLoginRequested] = useState(false);
  const [destination, setDestination] =
    useState<Destination>(destinationFromHash);
  const pwa = usePwa();
  useEffect(() => {
    const update = () => setDestination(destinationFromHash());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const login = () => {
    setLoginRequested(true);
    setOpenAccount(true);
  };
  if (openAccount)
    return (
      <Suspense
        fallback={
          <main className="live-main">
            <Logo />
            <p role="status">Opening your account…</p>
          </main>
        }
      >
        <LiveApp loginRequested={loginRequested} />
      </Suspense>
    );
  return (
    <Shell
      destination={destination}
      onNavigate={(value) => {
        location.hash = value;
        setDestination(value);
      }}
      pending={false}
      account={
        <Button
          variant="secondary"
          disabled={pwa.offline || !import.meta.env.VITE_PRIVY_APP_ID}
          onClick={login}
        >
          Sign in
        </Button>
      }
    >
      {destination === "settings" ? (
        <>
          <div className="page-heading">
            <h1>Your workshop, your way.</h1>
          </div>
          <InstallPanel />
        </>
      ) : destination === "goals" ? (
        <Welcome
          configured={Boolean(import.meta.env.VITE_PRIVY_APP_ID)}
          login={login}
          offline={pwa.offline}
        />
      ) : (
        <div className="empty-state">
          <h1>Open your workshop.</h1>
          <p>Sign in to view your wallets, goals and transaction history.</p>
          <Button
            variant="build"
            disabled={pwa.offline || !import.meta.env.VITE_PRIVY_APP_ID}
            onClick={login}
          >
            Sign in
          </Button>
        </div>
      )}
    </Shell>
  );
}
