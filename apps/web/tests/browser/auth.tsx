// Isolated state fixture. No Privy, API, wallet, credentials or transactions.
import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { SessionDTO } from "@nabungfi/shared/application";
import { LoginPage } from "../../src/LoginPage";
import { appStartupPhase, hasVerifiedSession } from "../../src/auth-gate";
import { AppSplash } from "../../src/LoadingState";
import { loginReturnTarget } from "../../src/app-routes";
import { Shell } from "../../src/Shell";
import "@fontsource/outfit/latin-500.css";
import "@fontsource/work-sans/latin-400.css";
import "../../src/styles.css";
import "../../src/live.css";

function AuthFixture() {
  const parameters=new URLSearchParams(location.search);
  const [sdkReady,setSdkReady]=useState(!parameters.has("boot"));
  const [initialReadSettled,setInitialReadSettled]=useState(!parameters.has("slow-goals"));
  const [authenticated, setAuthenticated] = useState(false);
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [wallet, setWallet] = useState(false);
  const [sent, setSent] = useState(0);
  const [googlePending, setGooglePending] = useState(false);
  const [googleCalls, setGoogleCalls] = useState(0);
  const googleResult = useRef<{ resolve: () => void; reject: (error: Error) => void } | null>(null);
  const unavailable = new URLSearchParams(location.search).has("unavailable");
  const offline = new URLSearchParams(location.search).has("offline");
  const returnTo = loginReturnTarget(location.search);
  const grant = (subject: string) => setSession({ user: { id: "db-example", privySubject: subject, wallets: [
    { chainType: "ethereum", address: "0x1111111111111111111111111111111111111111" },
    { chainType: "solana", address: "11111111111111111111111111111111" },
  ] }, privyAppId: "fixture", profile: "testnet", chains: ["solana", "base"] });
  const verified = hasVerifiedSession({ ready: sdkReady, authenticated, userId: "did:privy:example", appId: "fixture", session });
  const startup=appStartupPhase({ready:sdkReady,authenticated,verified,initialReadSettled,offline,error:""});
  return (
    <>
      <p className="fixture-note" role="status">Authentication state fixture. All codes and sessions are synthetic; no external sign-in occurs.</p>
      {startup==="splash" ? <AppSplash /> : !verified ? <LoginPage
        status={unavailable ? "unavailable" : authenticated ? "verifying" : "ready"}
        offline={offline}
        sendCode={async () => { await new Promise(resolve => setTimeout(resolve, 150)); setSent(value => value + 1); }}
        verifyCode={async code => { if (code !== "123456") throw new Error("The example code is incorrect."); setAuthenticated(true); }}
        walletLogin={() => setWallet(true)}
        googleLogin={() => {
          setGoogleCalls(value => value + 1);
          setGooglePending(true);
          return new Promise<void>((resolve, reject) => { googleResult.current = { resolve, reject }; });
        }}
        googleBusy={googlePending}
      /> : <Shell destination="goals" onNavigate={() => undefined} pending={false} account="Example account"><h1>Example verified workspace</h1><p data-testid="return-target">{returnTo}</p></Shell>}
      <div className="fixture-controls">
        {!sdkReady && <button onClick={()=>setSdkReady(true)}>Finish example app initialization</button>}
        {verified && !initialReadSettled && <button onClick={()=>setInitialReadSettled(true)}>Finish example goal reading</button>}
        <span data-testid="codes-sent">{sent}</span>
        <span data-testid="google-login-requests">{googleCalls}</span>
        {googlePending && <>
          <button onClick={() => { setGooglePending(false); googleResult.current?.reject(new Error("Google sign-in was cancelled. Try again or use email.")); }}>Cancel example Google sign-in</button>
          <button onClick={() => { setGooglePending(false); setAuthenticated(true); googleResult.current?.resolve(); }}>Complete example Google sign-in</button>
        </>}
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
