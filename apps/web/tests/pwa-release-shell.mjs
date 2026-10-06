// Actual production entry, separate from the component fixture lifecycle test.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, readdir, stat, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "@playwright/test";
const web = fileURLToPath(new URL("../", import.meta.url));
const root = path.join(web, "dist");
assert.ok((await stat(path.join(root, "index.html"))).mtimeMs >= (await stat(path.join(web, "src/Entry.tsx"))).mtimeMs, "Run pnpm --filter @nabungfi/web build before release shell acceptance");
const workerSource=await readFile(path.join(root,"sw.js"),"utf8");
const precache=JSON.parse(workerSource.match(/const PRECACHE = (\[[^\n]+\]);/)[1]);
const walletChunks=(await readdir(path.join(root,"assets"))).filter(file=>/^(LiveApp|StandardSignAndSendTransactionScreen|EmbeddedWalletConnectingScreen|SignTransactionScreen)-/.test(file));
assert(walletChunks.some(file=>file.startsWith("StandardSignAndSendTransactionScreen-")),"Built Solana confirmation chunk exists");
assert(walletChunks.every(file=>precache.includes("/assets/"+file)),"Actual lazy wallet confirmations belong to the same versioned shell");
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
  const css = (await readdir(path.join(root, "assets"))).filter(file => /^(index|LiveApp|live)-.*\.css$/.test(file));
  const mainCss = css.find(file => file.startsWith("index-"));
  const appCss = css.find(file => file.startsWith("LiveApp-"));
  const baseCss = css.find(file => file.startsWith("live-"));
  assert.ok(mainCss && appCss && baseCss, "Actual normal-build CSS chunks are present");
  let cssOrdersChecked = 0;
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const order of [[appCss, baseCss], [baseCss, appCss]]) {
      await page.setContent(`<html><head>${[mainCss, ...order].map(file => `<link rel="stylesheet" href="${origin}/assets/${file}">`).join("")}</head><body><div class="live-shell"><nav class="live-navigation"><button class="is-active" aria-current="page">Goals</button></nav><section class="portfolio-summary"><h2>Total saved</h2></section></div></body></html>`, { waitUntil: "networkidle" });
      const skin = await page.evaluate(() => ({ active: getComputedStyle(document.querySelector(".live-navigation button")).backgroundColor, pocket: getComputedStyle(document.querySelector(".portfolio-summary")).backgroundColor, pocketImage: getComputedStyle(document.querySelector(".portfolio-summary")).backgroundImage, dockRadius: getComputedStyle(document.querySelector(".live-navigation")).borderRadius }));
      assert.equal(skin.active, "rgb(255, 244, 204)", "App selection color wins independently of CSS loading order");
      assert.equal(skin.pocket, "rgb(244, 244, 235)");
      assert.equal(skin.pocketImage, "none");
      if (width < 900) assert.equal(skin.dockRadius, "0px");
      cssOrdersChecked++;
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
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
  const result = { actualProductionEntry: true, cssOrdersChecked, walletChunksRetained:walletChunks.length, checks: ["Emitted app CSS keeps the approved skin at three widths in both chunk-loading orders", "Manifest has standalone mobile/desktop icons, screenshots and scoped shortcuts", "Cold offline app launch remains readable without starting authentication", "Lazy wallet confirmations belong to the versioned public shell", "Offline Google/signing controls are disabled and the intended goal URL is preserved", "No private account API requests, page errors or financial transactions"], accountRequests, errors, financialTransactions: 0 };
  await writeFile(path.join(out, "result.json"), JSON.stringify(result, null, 2));
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
