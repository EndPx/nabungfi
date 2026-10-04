// Run against the isolated Vite test surface, never a personal browser session.
// Example: node scripts/capture-model-posters.mjs http://127.0.0.1:5190
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const base = process.argv[2] ?? "http://127.0.0.1:5190";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))
  throw new Error("Use an isolated local Vite server.");
const output = new URL("../public/models/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.PW_BROWSER_CHANNEL ?? "chrome",
  headless: true,
});
try {
  const page = await browser.newPage({
    viewport: { width: 640, height: 760 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  for (const model of ["car", "laptop", "house", "custom"]) {
    await page.goto(`${base}/tests/browser/posters.html?model=${model}`, {
      waitUntil: "networkidle",
    });
    await page.locator("canvas").waitFor();
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await page
      .locator(".car-stage")
      .screenshot({
        path: fileURLToPath(new URL(`${model}.jpg`, output)),
        type: "jpeg",
        quality: 90,
      });
    process.stdout.write(`Captured current ${model} model\n`);
  }
} finally {
  await browser.close();
}
