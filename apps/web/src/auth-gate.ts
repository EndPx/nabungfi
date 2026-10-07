import type { SessionDTO } from "@nabungfi/shared/application";

/** Loading presentation never grants workspace access or trusts a persisted session hint. */
export function appStartupPhase(input: {
  ready: boolean;
  authenticated: boolean;
  verified: boolean;
  initialReadSettled: boolean;
  offline: boolean;
  error: string;
}): "splash" | "login" | "workspace" {
  if (!input.ready) return input.offline ? "login" : "splash";
  if (!input.authenticated) return "login";
  if (!input.verified) return input.offline || input.error ? "login" : "splash";
  return !input.initialReadSettled && !input.offline ? "splash" : "workspace";
}

/** UI access also waits for the backend-verified Privy identity. */
export function hasVerifiedSession(input: {
  ready: boolean;
  authenticated: boolean;
  userId: string | null | undefined;
  appId: string | undefined;
  session: SessionDTO | null;
}) {
  const { ready, authenticated, userId, appId, session } = input;
  return Boolean(ready && authenticated && userId && appId && session &&
    session.profile === "testnet" && session.privyAppId === appId &&
    session.user?.privySubject === userId);
}
