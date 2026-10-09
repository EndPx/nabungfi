// Builds the real app components and generated worker in a private, isolated fixture.
// No Privy login, account API, wallet SDK or chain transaction is used.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, copyFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "vite";
import { chromium } from "@playwright/test";

const webRoot = fileURLToPath(new URL("../", import.meta.url));
const repoRoot = path.resolve(webRoot, "../..");
const evidenceRoot = path.join(repoRoot, ".local", "pwa-lifecycle");
const output = path.join(evidenceRoot, "build");
assert.ok(output.startsWith(path.join(repoRoot, ".local") + path.sep), "Build cleanup stays in this task's private evidence folder");
await mkdir(evidenceRoot, { recursive: true });
await build({ root: webRoot, configFile: path.join(webRoot, "vite.config.ts"), logLevel: "warn", build: { outDir: output, emptyOutDir: true, rollupOptions: { input: path.join(webRoot, "tests/browser/harness.html") } } });
await copyFile(path.join(output, "tests/browser/harness.html"), path.join(output, "index.html"));

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff" };
let writes = 0;
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://local.invalid").pathname);
    if (pathname.startsWith("/api/")) {
      if (request.method !== "GET") writes++;
      response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(JSON.stringify({ fixture: true }));
      return;
    }
    let target = path.resolve(output, "." + pathname);
    if (!target.startsWith(output + path.sep)) target = path.join(output, "index.html");
    try { if (!(await stat(target)).isFile()) target = path.join(output, "index.html"); }
    catch { target = path.join(output, "index.html"); }
    const type = types[path.extname(target)] ?? "application/octet-stream";
    response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store", "Service-Worker-Allowed": "/" });
    response.end(await readFile(target));
  } catch { response.writeHead(500); response.end("Fixture server error"); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: process.env.PW_BROWSER_CHANNEL || "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
const page = await context.newPage();
const checks = [];
try {
  await page.goto(origin + "/tests/browser/harness.html?page=settings&pending=1");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  checks.push("Generated service worker installs and controls the production fixture");
  const cachedPosters = () => page.evaluate(async () => {
    const keys = await Promise.all((await caches.keys()).map(async key => (await (await caches.open(key)).keys()).map(request => new URL(request.url).pathname)));
    return keys.flat().filter(path => path.startsWith("/models/progress-v1/"));
  });
  assert.deepEqual(await cachedPosters(), [], "Installing the PWA does not download the progress catalog");
  const snapshot = "/models/progress-v1/car/25.jpg";
  await page.evaluate(async path => { const response = await fetch(path); if (!response.ok || !response.headers.get("content-type")?.includes("image/jpeg")) throw new Error("Progress image missing"); await response.arrayBuffer(); }, snapshot);
  await page.waitForFunction(async path => Boolean(await caches.match(path)), snapshot);
  assert.deepEqual(await cachedPosters(), [snapshot], "Only the requested progress snapshot is cached");
  await context.setOffline(true);
  assert.equal(await page.evaluate(async path => (await fetch(path)).ok, snapshot), true, "A previously viewed progress snapshot stays available offline");
  await context.setOffline(false);
  checks.push("Progress posters cache on demand and remain readable offline without precaching the catalog");
  await page.evaluate(async () => {
    await fetch("/api/private", { headers: { authorization: "Bearer fixture-only" } });
    await fetch("/api/mutation", { method: "POST", body: "fixture" });
  });
  assert.equal(writes, 1);
  const cached = await page.evaluate(async () => {
    const urls = [];
    for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
    return urls;
  });
  assert.ok(cached.length > 10);
  assert.ok(cached.every(url => !new URL(url).pathname.startsWith("/api/")));
  checks.push("Personalized API responses and financial mutations are absent from the worker cache");
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("heading", { name: "Settings", exact: true }).waitFor();
  await page.getByText("You’re offline", { exact: true }).waitFor();
  const offlineMutation = await page.evaluate(async () => {
    try { await fetch("/api/mutation", { method: "POST", body: "offline-fixture" }); return "sent"; }
    catch { return "offline"; }
  });
  assert.equal(offlineMutation, "offline");
  await context.setOffline(false);
  assert.equal(writes, 1);
  checks.push("Offline shell remains readable; an offline mutation is neither sent nor replayed");
  const workerPath = path.join(output, "sw.js");
  const source = await readFile(workerPath, "utf8");
  await writeFile(workerPath, source.replace(/const VERSION = "([^"]+)";/, 'const VERSION = "$1-acceptance-update";'));
  await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
  await page.getByText("A new version is ready", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Update", exact: true }).isDisabled(), true);
  assert.equal(await page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting)), true);
  checks.push("An update waits and is disabled while the original wallet lifecycle is pending");
  await page.goto(origin + "/tests/browser/harness.html?page=settings");
  await page.getByText("A new version is ready", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Update", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("h1")?.textContent === "Settings");
  await page.waitForFunction(async () => (await caches.keys()).some(key => key.endsWith("-acceptance-update")));
  const versions = await page.evaluate(() => caches.keys());
  assert.equal(versions.filter(key => key.startsWith("nabungfi-shell-")).length, 1);
  assert.equal(writes, 1);
  checks.push("Explicit update activates the waiting worker, reloads safely and retires the old public cache");
  await page.screenshot({ path: path.join(evidenceRoot, "worker-shell.png"), fullPage: true });
  const result = { fixture: true, checks, writes, cacheEntries: cached.length, financialTransactions: 0 };
  await writeFile(path.join(evidenceRoot, "result.json"), JSON.stringify(result, null, 2));
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
} catch (error) {
  const state = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return { text: document.body.innerText, controller: navigator.serviceWorker.controller?.state, installing: registration?.installing?.state, waiting: registration?.waiting?.state, active: registration?.active?.state, caches: await caches.keys() };
  }).catch(() => null);
  await writeFile(path.join(evidenceRoot, "failure.json"), JSON.stringify({ error: String(error), state }, null, 2));
  await page.screenshot({ path: path.join(evidenceRoot, "failure.png"), fullPage: true }).catch(() => {});
  throw error;
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
