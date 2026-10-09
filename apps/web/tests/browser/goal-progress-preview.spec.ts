import { test, expect } from "@playwright/test";

test("dashboard previews reflect each goal's verified funded parts, including empty and collected builds", async ({ page }) => {
  const cases = [
    { amount: "0", phase: "saving", pieces: 0 },
    { amount: "2500000", phase: "saving", pieces: 25 },
    { amount: "5000000", phase: "saving", pieces: 50 },
    // Reaching the target alone does not replace verified completion.
    { amount: "10000000", phase: "saving", pieces: 99 },
    { amount: "10000000", phase: "achieved", pieces: 100 },
    { amount: "0", phase: "claimed", pieces: 100 },
  ];
  for (const { amount, phase, pieces } of cases) {
    await page.goto(`/tests/browser/harness.html?amount=${amount}&phase=${phase}`);
    await page.getByLabel("Search goals").fill("My car");
    const card = page.locator(".goal-card");
    await expect(card).toContainText(`${pieces} / 100 funded pieces`);
    await expect(card.locator(".goal-illustration")).toHaveAttribute("data-funded", String(pieces));
    const image = card.locator("img");
    await expect(image).toHaveAttribute("src", pieces < 100 ? `/models/progress-v1/car/${pieces}.jpg` : /\/models\/car\.jpg\?revision=/);
    await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    await expect(page.locator("canvas")).toHaveCount(0);
  }
  // A complete template is useful while choosing, but never substitutes for progress.
  await page.getByRole("button", { name: "New goal", exact: true }).click();
  await expect(page.locator(".live-model-preview img")).toHaveAttribute("src", /\/models\/car\.jpg\?revision=/);
});

test("unavailable reads and failed images never show a misleading finished model", async ({ page }) => {
  await page.goto("/tests/browser/harness.html?read=unavailable&amount=5000000");
  await page.getByLabel("Search goals").fill("My car");
  const card = page.locator(".goal-card");
  await expect(card).toContainText("Progress unavailable");
  await expect(card.locator(".goal-illustration")).toHaveAttribute("data-funded", "unavailable");
  await expect(card.locator("img")).toHaveCount(0);
  await page.route("**/models/progress-v1/car/25.jpg", route => route.abort());
  await page.goto("/tests/browser/harness.html?amount=2500000");
  await page.getByLabel("Search goals").fill("My car");
  await expect(card).toContainText("Preview couldn’t load");
  await expect(card).toContainText("25 / 100 funded pieces");
  await expect(card.locator("img")).toHaveCount(0);
  await card.click();
  await expect(page.getByRole("heading", { name: "My car", exact: true })).toBeVisible();
});

test("progress snapshots retain card proportions without dashboard WebGL at mobile and desktop widths", async ({ page }) => {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/tests/browser/harness.html?amount=0&presentation=1");
    await page.getByLabel("Search goals").fill("My car");
    const image = page.locator(".goal-card img");
    await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth === 480)).toBe(true);
    const bounds = (await image.boundingBox())!;
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page.locator("canvas")).toHaveCount(0);
    if (width === 390) await page.locator(".goal-card").screenshot({ path: "../../.local/goal-preview-zero-mobile.png" });
  }
});
