// Isolated state fixture. No Privy, API, wallet, credentials or transactions.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import type { SessionDTO } from "@nabungfi/shared/application";
import { LoginPage } from "../../src/LoginPage";
import { hasVerifiedSession } from "../../src/auth-gate";
import { loginReturnTarget } from "../../src/app-routes";
import { Shell } from "../../src/Shell";
import "@fontsource/outfit/latin-500.css";
import "@fontsource/work-sans/latin-400.css";
import "../../src/styles.css";
import "../../src/live.css";

function AuthFixture() {
  const [authenticated, setAuthenticated] = useState(false);
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [wallet, setWallet] = useState(false);
  const [sent, setSent] = useState(0);
  const unavailable = new URLSearchParams(location.search).has("unavailable");
  const returnTo = loginReturnTarget(location.search);
  const grant = (subject: string) => setSession({ user: { id: "db-example", privySubject: subject, wallets: [] }, privyAppId: "fixture", profile: "testnet", chains: ["solana", "base"] });
  const verified = hasVerifiedSession({ ready: true, authenticated, userId: "did:privy:example", appId: "fixture", session });
  return (
    <>
      <p className="fixture-note" role="status">Authentication state fixture. All codes and sessions are synthetic; no external sign-in occurs.</p>
      {!verified ? <LoginPage
        status={unavailable ? "unavailable" : authenticated ? "verifying" : "ready"}
        sendCode={async () => { await new Promise(resolve => setTimeout(resolve, 150)); setSent(value => value + 1); }}
        verifyCode={async code => { if (code !== "123456") throw new Error("The example code is incorrect."); setAuthenticated(true); }}
        walletLogin={() => setWallet(true)}
      /> : <Shell destination="goals" onNavigate={() => undefined} pending={false} account="Example account"><h1>Example verified workspace</h1><p data-testid="return-target">{returnTo}</p></Shell>}
      <div className="fixture-controls">
        <span data-testid="codes-sent">{sent}</span>
        {wallet && <p role="status">Example wallet login requested.</p>}
        {authenticated && !verified && <>
          <button onClick={() => grant("did:privy:another")}>Return mismatched example session</button>
          <button onClick={() => grant("did:privy:example")}>Verify matching example session</button>
        </>}
      </div>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<AuthFixture />);
