// Deterministic snapshots of the original renderer, not synthetic financial data.
// node scripts/capture-progress-posters.mjs http://127.0.0.1:5190 [car,laptop,...]
import { chromium } from "@playwright/test";
import { mkdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { GOAL_TEMPLATES, isGoalModel } from "@nabungfi/shared/application";
const base = process.argv[2] ?? "http://127.0.0.1:5190";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw new Error("Use an isolated local Vite server.");
const output = new URL("../public/models/progress-v1/", import.meta.url);
const browser = await chromium.launch({ channel: process.env.PW_BROWSER_CHANNEL ?? "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 480, height: 700 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  for (const model of (process.argv[3]?.split(",") ?? [...GOAL_TEMPLATES.map(template => template.id), "custom"])) {
    if (!isGoalModel(model)) throw new Error("Unknown model");
    const directory = new URL(`${model}/`, output);
    await mkdir(directory, { recursive: true });
    await page.goto(`${base}/tests/browser/posters.html?model=${model}&progress=1`, { waitUntil: "networkidle" });
    await page.locator("canvas").waitFor();
    let bytes = 0;
    for (let pieces = 0; pieces < 100; pieces++) {
      await page.getByRole("spinbutton", { name: "Funded parts" }).fill(String(pieces));
      await page.locator(".car-stage").filter({ has: page.locator("canvas") }).waitFor();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
      const path = fileURLToPath(new URL(`${pieces}.jpg`, directory));
      await page.locator(".car-stage").screenshot({ path, type: "jpeg", quality: 85 });
      bytes += (await stat(path)).size;
    }
    process.stdout.write(`${model}: 100 exact progress snapshots, ${(bytes / 1024).toFixed(0)} KiB\n`);
  }
} finally { await browser.close(); }
