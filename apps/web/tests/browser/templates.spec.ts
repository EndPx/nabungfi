import { test, expect } from "@playwright/test";
import { GOAL_TEMPLATES } from "@nabungfi/shared/application";

for (const width of [320, 390, 1280]) test(`nine goal templates and renderer posters are available at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/tests/browser/harness.html");
  await page.getByRole("button", { name: /Create.*goal|New goal|Add.*goal/i }).first().click();
  const selector = page.getByLabel("Build model", { exact: true });
  await expect(selector.locator("option")).toHaveCount(9);
  await expect(selector.locator('option[value="custom"]')).toHaveCount(0);
  for (const template of GOAL_TEMPLATES) {
    await selector.selectOption(template.id);
    const poster = page.locator('.live-model-preview img');
    await expect(poster).toHaveAttribute('src', new RegExp(`/models/${template.id}\\.jpg`));
    await expect.poll(() => poster.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByText(`${template.label} · 100 pieces`, { exact: true })).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
