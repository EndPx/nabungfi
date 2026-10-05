import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, LockKeyhole, Wallet } from "./icons";
import { Button, Logo } from "./ui";
import { GoalIllustration } from "./GoalIllustration";
import "./login.css";

export interface LoginPageProps {
  status?: "initializing" | "ready" | "verifying" | "unavailable";
  offline?: boolean;
  error?: string;
  sendCode?: (email: string) => Promise<void>;
  verifyCode?: (code: string) => Promise<void>;
  walletLogin?: () => void;
  googleLogin?: () => Promise<void>;
  googleBusy?: boolean;
  googleError?: string;
  retry?: () => void;
  signOut?: () => void;
  captcha?: ReactNode;
}

export function LoginPage({ status = "initializing", offline = false, error, retry, signOut, captcha, ...methods }: LoginPageProps) {
  return (
    <main className="login-page">
      <section className="login-story" aria-label="NabungFi">
        <a className="login-brand" href="/" aria-label="NabungFi home"><Logo /></a>
        <div className="login-story-content">
          <div className="login-art"><GoalIllustration model="car" priority /></div>
          <h2>Little by little.<br />Something worth building.</h2>
          <p>Your goals, taking shape with every deposit.</p>
        </div>
      </section>
      <section className="login-side" aria-label="Account sign-in">
        <a className="login-back" href="/"><ArrowLeft size={16} />Back to NabungFi</a>
        <div className="login-card">
          <span className="login-symbol"><LockKeyhole size={24} /></span>
          <h1>{status === "verifying" ? "Verifying your account" : "Sign in to your workshop"}</h1>
          <p className="login-intro">{status === "verifying"
            ? "Your login is complete. We’re checking your account before opening your goals."
            : "Use Google, your email or a wallet to continue to NabungFi."}</p>
          {status === "verifying" ? (
            <div className="login-verification">
              {error ? <p className="login-error" role="alert">{error}</p> : <p role="status">Checking your account…</p>}
              {retry && <Button variant="build" disabled={offline} onClick={retry}>Retry verification</Button>}
              {signOut && <Button variant="quiet" onClick={signOut}>Use another account</Button>}
            </div>
          ) : (
            <EmailLoginForm disabled={status !== "ready" || offline} {...methods} />
          )}
          {captcha}
          {offline && <p className="login-error" role="status">You’re offline. Reconnect to sign in.</p>}
          {status === "initializing" && !offline && <p className="login-help" role="status">Preparing secure sign-in…</p>}
          {status === "unavailable" && <p className="login-error" role="alert">Sign-in is unavailable for this deployment.</p>}
          <p className="login-privy"><LockKeyhole size={14} />Authentication by Privy</p>
        </div>
      </section>
    </main>
  );
}

function EmailLoginForm({ disabled, sendCode, verifyCode, walletLogin, googleLogin, googleBusy = false, googleError }: Pick<LoginPageProps, "sendCode" | "verifyCode" | "walletLogin" | "googleLogin" | "googleBusy" | "googleError"> & { disabled: boolean }) {
  const [email, setEmail] = useState("");
  const [recipient, setRecipient] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const emailStage = !recipient;
  const blocked = disabled || googleBusy;
  const act = async (operation: () => Promise<void>) => {
    if (blocked || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try { await operation(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Sign-in could not continue. Please try again."); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (emailStage && sendCode) {
      const original = email.trim();
      void act(async () => { await sendCode(original); setRecipient(original); setCode(""); });
    } else if (verifyCode && /^\d{6}$/.test(code)) {
      void act(() => verifyCode(code));
    }
  };
  return (
    <>
      <div className="login-methods" role="group" aria-label="Sign-in options">
        <Button variant="secondary" className="login-google" busy={googleBusy}
          disabled={blocked || busy || !googleLogin} onClick={() => googleLogin && void act(googleLogin)}>
          <img src="/providers/google.png" width="20" height="20" alt="" aria-hidden="true" />
          {googleBusy ? "Connecting to Google…" : "Continue with Google"}
        </Button>
        <Button variant="secondary" className="login-wallet" disabled={blocked || busy || !walletLogin} onClick={walletLogin}>
          <Wallet size={20} />Continue with a wallet
        </Button>
      </div>
      <div className="login-divider"><span>or use email</span></div>
      <form className="login-form" onSubmit={submit}>
        {emailStage ? (
          <label className="login-field">Email address
            <input type="email" autoComplete="email" placeholder="you@example.com" value={email} required disabled={blocked || busy}
              onChange={event => setEmail(event.target.value)} />
          </label>
        ) : (
          <>
            <p className="login-code-context">Enter the code sent to <strong>{recipient}</strong>.</p>
            <label className="login-field">Verification code
              <input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required
                className="login-code" value={code} disabled={blocked || busy} placeholder="000000"
                onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
            </label>
          </>
        )}
        {(error || googleError) && <p className="login-error" role="alert">{error || googleError}</p>}
        <Button type="submit" variant="build" busy={busy && !googleBusy} disabled={blocked || busy || (emailStage ? !email.trim() || !sendCode : code.length !== 6 || !verifyCode)}>
          {emailStage ? "Send code" : "Verify and continue"}<ArrowRight size={18} />
        </Button>
        {!emailStage && (
          <div className="login-code-actions">
            <Button variant="quiet" disabled={blocked || busy} onClick={() => { setRecipient(""); setCode(""); setError(""); }}>Change email</Button>
            <Button variant="quiet" disabled={blocked || busy || !sendCode} onClick={() => void act(async () => { await sendCode?.(recipient); setCode(""); })}>Send another code</Button>
          </div>
        )}
      </form>
    </>
  );
}
