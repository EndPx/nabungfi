// Actual production entry, separate from the component fixture lifecycle test.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "@playwright/test";
const web = fileURLToPath(new URL("../", import.meta.url));
const root = path.join(web, "dist");
assert.ok((await stat(path.join(root, "index.html"))).mtimeMs >= (await stat(path.join(web, "src/Entry.tsx"))).mtimeMs, "Run pnpm --filter @nabungfi/web build before release shell acceptance");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff" };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://local.invalid").pathname);
    let file = path.resolve(root, "." + pathname);
    if (!file.startsWith(root + path.sep)) file = path.join(root, "index.html");
    try { if (!(await stat(file)).isFile()) file = path.join(root, "index.html"); } catch { file = path.join(root, "index.html"); }
    response.writeHead(200, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store", "Service-Worker-Allowed": "/" });
    response.end(await readFile(file));
  } catch { response.writeHead(500); response.end("Release test server error"); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const out = path.resolve(web, "../../.local/pwa-release-shell");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PW_BROWSER_CHANNEL || "msedge", headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  const errors = [], accountRequests = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/")) accountRequests.push(request.url()); });
  await page.goto(origin + "/");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  const manifest = await page.evaluate(async () => (await fetch("/manifest.webmanifest")).json());
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/app?source=pwa");
  assert.equal(manifest.shortcuts.length, 3);
  assert.deepEqual(manifest.screenshots.map(item => item.form_factor).sort(), ["narrow", "wide"]);
  await context.setOffline(true);
  await page.goto(origin + "/app/goals?goal=offline-goal");
  await page.getByRole("heading", { name: "Sign in to your workshop" }).waitFor();
  await page.getByText("You’re offline. Reconnect to sign in.", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Continue with Google", exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole("navigation", { name: "Main navigation" }).count(), 0);
  assert.ok(page.url().endsWith("/app/goals?goal=offline-goal"));
  assert.equal(errors.length, 0);
  assert.equal(accountRequests.length, 0);
  await page.screenshot({ path: path.join(out, "cold-offline-app.png") });
  const result = { actualProductionEntry: true, checks: ["Manifest has standalone mobile/desktop icons, screenshots and scoped shortcuts", "Cold offline app launch remains readable without loading the uncached authentication SDK", "Offline Google/signing controls are disabled and the intended goal URL is preserved", "No private account API requests, page errors or financial transactions"], accountRequests, errors, financialTransactions: 0 };
  await writeFile(path.join(out, "result.json"), JSON.stringify(result, null, 2));
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
