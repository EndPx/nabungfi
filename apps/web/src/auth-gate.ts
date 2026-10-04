import type { SessionDTO } from "@nabungfi/shared/application";

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
