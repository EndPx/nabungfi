import { test } from "node:test";
import assert from "node:assert/strict";
import type { SessionDTO } from "@nabungfi/shared/application";
import { hasVerifiedSession } from "../src/auth-gate";
import { appHref, isAppRoute, loginHref, loginReturnTarget, readAppRoute, safeAppReturnTarget } from "../src/app-routes";

const session: SessionDTO = { user: { id: "database-user", privySubject: "did:privy:alice", wallets: [] }, profile: "testnet", privyAppId: "test-app", chains: ["solana", "base"] };
const valid = { ready: true, authenticated: true, userId: "did:privy:alice", appId: "test-app", session };

test("workspace access requires SDK readiness, real authentication and a matching backend session", () => {
  assert.equal(hasVerifiedSession(valid), true);
  for (const invalid of [
    { ready: false }, { authenticated: false }, { userId: null }, { appId: undefined }, { session: null },
    { userId: "did:privy:bob" }, { appId: "another-app" },
    { session: { ...session, profile: "mainnet" } as unknown as SessionDTO },
  ]) assert.equal(hasVerifiedSession({ ...valid, ...invalid }), false);
});

test("login preserves internal destinations and goal identity without retaining tokens or external redirects", () => {
  const target = appHref("goals", "car / & laptop");
  const login = new URL(loginHref(target), "https://app.test");
  assert.equal(isAppRoute(login), true);
  assert.equal(loginReturnTarget(login.search), target);
  assert.deepEqual(readAppRoute(login), { destination: "goals", goalId: "car / & laptop" });
  assert.equal(safeAppReturnTarget("/app/wallets?access_token=secret&goal=car"), "/app/wallets");
  for (const value of ["https://evil.test/app", "//evil.test/app", "/\\evil.test/app", "/login?next=/login", "/app/unknown", "/app%2Fwallets", "javascript:alert(1)"])
    assert.equal(safeAppReturnTarget(value), "/app/goals");
});
