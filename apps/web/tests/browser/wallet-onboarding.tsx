// Isolated onboarding fixture: example identities only; no Privy/API/keys/transactions.
import { StrictMode, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { SessionDTO } from "@nabungfi/shared/application";
import { useWalletOnboarding } from "../../src/useWalletOnboarding";
import { hasVerifiedSession } from "../../src/auth-gate";
import { AppSplash } from "../../src/LoadingState";
import { LoginPage } from "../../src/LoginPage";
import { WalletsPage } from "../../src/account-pages";
import { Shell } from "../../src/Shell";
import type { WalletProfile } from "../../src/wallet-onboarding";
import "@fontsource/outfit/latin-500.css";
import "@fontsource/work-sans/latin-400.css";
import "../../src/styles.css";
import "../../src/live.css";
import "../../src/app-refinement.css";

const exampleWallets = [
  { chainType: "ethereum" as const, address: "0x1111111111111111111111111111111111111111" },
  { chainType: "solana" as const, address: "11111111111111111111111111111111" },
];
function Fixture() {
  const query = new URLSearchParams(location.search);
  const [authenticated, setAuthenticated] = useState(!query.has("new"));
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [calls, setCalls] = useState({ ethereum: 0, solana: 0 });
  const [waiting, setWaiting] = useState<Record<string, { resolve: () => void; reject: (error: Error) => void }>>({});
  const backend = useRef(!query.has("backend-wait"));
  const profile = useRef<WalletProfile>({ id: "did:privy:example",
    linkedAccounts: query.has("existing") ? exampleWallets.map(wallet => ({ type: "wallet", ...wallet })) : [] });
  const create = (family: "ethereum" | "solana") => {
    setCalls(prior => ({ ...prior, [family]: prior[family] + 1 }));
    return new Promise<void>((resolve, reject) => {
      setWaiting(prior => ({ ...prior, [family]: {
        resolve: () => {
          const wallet = exampleWallets.find(wallet => wallet.chainType === family)!;
          profile.current.linkedAccounts = [...profile.current.linkedAccounts, { type: "wallet", ...wallet }];
          setWaiting(prior => { const next = { ...prior }; delete next[family]; return next; });
          resolve();
        }, reject: error => {
          setWaiting(prior => { const next = { ...prior }; delete next[family]; return next; });
          reject(error);
        },
      } }));
    });
  };
  const onboarding = useWalletOnboarding({ ready: true, authenticated, userId: profile.current.id,
    offline: query.has("offline"), appId: "fixture",
    refreshUser: async () => profile.current,
    createEthereumWallet: () => create("ethereum"), createSolanaWallet: () => create("solana"),
    readSession: async () => {
      const next: SessionDTO = { profile: "testnet", privyAppId: "fixture", chains: ["solana", "base"],
        user: { id: "db-example", privySubject: profile.current.id, wallets: backend.current
          ? profile.current.linkedAccounts.map(account => ({ chainType: account.chainType as "ethereum" | "solana", address: account.address! })) : [] } };
      setSession(next); return next;
    },
  });
  const verified = onboarding.complete && hasVerifiedSession({ ready: true, authenticated,
    userId: profile.current.id, appId: "fixture", session });
  return <>
    {verified ? <Shell destination="wallets" onNavigate={() => {}} account={<span>Example account</span>}>
      <WalletsPage wallets={session!.user.wallets} verified busy={false} blocked={false}
        connect={() => {}} link={() => {}} createWallet={() => {}} />
    </Shell> : onboarding.error ? <LoginPage status="verifying" error={onboarding.error} retry={onboarding.retry} />
      : <AppSplash preparingWallets={authenticated} />}
    <aside style={{ position: "fixed", bottom: 110, right: 12, zIndex: 100, background: "white", padding: 8 }} aria-label="Example fixture controls">
      <p data-testid="creation-count">{`ethereum=${calls.ethereum};solana=${calls.solana}`}</p>
      {!authenticated && <button onClick={() => setAuthenticated(true)}>Complete example sign-in</button>}
      {Object.entries(waiting).map(([family, callbacks]) => <div key={family}>
        <button onClick={callbacks.resolve}>Finish example {family} creation</button>
        <button onClick={() => callbacks.reject(new Error(`${family} creation unavailable`))}>Fail example {family} creation</button>
      </div>)}
      {query.has("backend-wait") && <button onClick={() => { backend.current = true; }}>Publish example backend ownership</button>}
    </aside>
  </>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><Fixture /></StrictMode>);
