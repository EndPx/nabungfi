import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
const origin = "https://nabungfi.example";
function worker(offline = false) {
  const listeners = new Map<string, (event: Record<string, unknown>) => void>();
  const cached: string[] = [];
  const puts: string[] = [];
  const deleted: string[] = [];
  const source = readFileSync(
    new URL("../public/sw.js", import.meta.url),
    "utf8",
  )
    .replace('"__BUILD_VERSION__"', '"unit"')
    .replace(
      "__PRECACHE_ASSETS__",
      JSON.stringify(["/index.html", "/assets/app.js"]),
    )
    .replace(
      "__PUBLIC_ASSETS__",
      JSON.stringify(["/index.html", "/assets/app.js", "/assets/wallet.js"]),
    );
  runInNewContext(source, {
    URL,
    self: {
      location: { origin },
      addEventListener: (
        name: string,
        listener: (event: Record<string, unknown>) => void,
      ) => listeners.set(name, listener),
      clients: { claim: async () => undefined },
      skipWaiting: () => undefined,
    },
    fetch: async () => {
      if (offline) throw new Error("offline");
      return new Response("public asset");
    },
    caches: {
      open: async () => ({
        addAll: async (values: string[]) => cached.push(...values),
        put: async (request: { url: string }) => puts.push(request.url),
      }),
      keys: async () => ["nabungfi-shell-old", "another-app-cache"],
      delete: async (key: string) => deleted.push(key),
      match: async (request: string | { url: string }) =>
        typeof request === "string" && request === "/index.html"
          ? new Response("cached public shell")
          : undefined,
    },
  });
  return { listeners, cached, puts, deleted };
}
test("service worker bypasses authenticated, API, non-GET and other-origin traffic", () => {
  const state = worker();
  for (const request of [
    {
      url: origin + "/api/goals",
      method: "GET",
      headers: new Headers(),
      mode: "cors",
    },
    {
      url: origin + "/assets/app.js",
      method: "GET",
      headers: new Headers({ Authorization: "Bearer test" }),
      mode: "cors",
    },
    {
      url: origin + "/api/goals",
      method: "POST",
      headers: new Headers(),
      mode: "cors",
    },
    {
      url: "https://auth.privy.io/api/v1/apps",
      method: "GET",
      headers: new Headers(),
      mode: "cors",
    },
  ]) {
    let handled = false;
    state.listeners.get("fetch")!({
      request,
      respondWith: () => {
        handled = true;
      },
      waitUntil: () => undefined,
    });
    assert.equal(handled, false, request.url);
  }
  assert.deepEqual(state.puts, []);
});
test("only public shell is precached and only NabungFi old versions are removed", async () => {
  const state = worker();
  let operation: Promise<unknown> = Promise.resolve();
  state.listeners.get("install")!({
    waitUntil: (promise: Promise<unknown>) => {
      operation = promise;
    },
  });
  await operation;
  assert.deepEqual(state.cached, ["/index.html", "/assets/app.js"]);
  state.listeners.get("activate")!({
    waitUntil: (promise: Promise<unknown>) => {
      operation = promise;
    },
  });
  await operation;
  assert.deepEqual(state.deleted, ["nabungfi-shell-old"]);
});
test("offline navigation falls back to the static shell and never replays a mutation", async () => {
  const state = worker(true);
  let response: Promise<Response> | undefined;
  state.listeners.get("fetch")!({
    request: {
      url: origin + "/",
      method: "GET",
      headers: new Headers(),
      mode: "navigate",
    },
    respondWith: (value: Promise<Response>) => {
      response = value;
    },
  });
  assert.equal(await (await response!).text(), "cached public shell");
  let replayed = false;
  state.listeners.get("fetch")!({
    request: {
      url: origin + "/api/goals/car/steps",
      method: "POST",
      headers: new Headers(),
      mode: "cors",
    },
    respondWith: () => {
      replayed = true;
    },
  });
  assert.equal(replayed, false);
});
