import { test } from "node:test";
import assert from "node:assert/strict";
import { validateVercelBuild } from "../src/deployment-config";

test("Vercel cannot silently ship the same-origin demo proxy or a credential-bearing API URL", () => {
  assert.doesNotThrow(() => validateVercelBuild({}));
  assert.doesNotThrow(() =>
    validateVercelBuild({
      vercel: "1",
      appId: "public-app",
      apiOrigin: "https://nabungfi-api.endpx.cloud",
    }),
  );
  assert.throws(() =>
    validateVercelBuild({
      vercel: "1",
      apiOrigin: "https://nabungfi-api.endpx.cloud",
    }),
  );
  for (const apiOrigin of [
    undefined,
    "",
    "http://127.0.0.1:3001",
    "https://user:secret@example.org",
    "https://example.org/api",
    "https://example.org?token=test",
    "https://example.org#test",
  ])
    assert.throws(() =>
      validateVercelBuild({ vercel: "1", appId: "public-app", apiOrigin }),
    );
});
