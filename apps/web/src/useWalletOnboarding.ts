import { useEffect, useRef, useState } from "react";
import { createWalletOnboarding, type WalletOnboardingOptions } from "./wallet-onboarding";

interface Options extends Omit<WalletOnboardingOptions, "isCurrent" | "isOnline" | "userId"> {
  userId: string | null;
  ready: boolean;
  authenticated: boolean;
  offline: boolean;
}

export function useWalletOnboarding(options: Options) {
  const current = useRef(options);
  current.current = options;
  const [ensure] = useState(createWalletOnboarding);
  const [attempt, retry] = useState(0);
  const [result, setResult] = useState<{ userId: string; status: "pending" | "ready" | "error"; error: string } | null>(null);
  const { userId, ready, authenticated, offline } = options;
  useEffect(() => {
    if (!ready || !authenticated || !userId || offline) return;
    let mounted = true;
    const input = current.current;
    const isCurrent = () => current.current.authenticated && current.current.userId === userId;
    setResult({ userId, status: "pending", error: "" });
    void ensure({ ...input, userId, isCurrent, isOnline: () => !current.current.offline })
      .then(() => {
        if (mounted && isCurrent()) setResult({ userId, status: "ready", error: "" });
      })
      .catch(failure => {
        if (mounted && isCurrent()) setResult({ userId, status: "error", error: failure instanceof Error
          ? failure.message : "Your wallets could not be prepared. Retry verification." });
      });
    return () => { mounted = false; };
  }, [userId, ready, authenticated, offline, attempt, ensure]);
  const ownResult = authenticated && result?.userId === userId ? result : null;
  return {
    complete: ready && ownResult?.status === "ready",
    error: ownResult?.status === "error" ? ownResult.error : "",
    pending: authenticated && Boolean(userId) && ownResult?.status !== "ready" && ownResult?.status !== "error",
    retry: () => retry(value => value + 1),
  };
}
