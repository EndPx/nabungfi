import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("goal search and phase filters preserve the verified portfolio and selected identity", async ({ page }) => {
  await page.goto("/tests/browser/harness.html?mixed=1");
  const summary = page.getByRole("region", { name: "Savings across goals" });
  const total = (await summary.textContent())!;
  await page.getByLabel("Search goals").fill("laptop");
  await expect(page.locator(".goal-card")).toHaveCount(1);
  await expect(summary).toHaveText(total);
  await page.getByRole("button", { name: "Clear goal search" }).click();
  await page.getByRole("button", { name: "Reached", exact: true }).click();
  await expect(page.getByRole("button", { name: /My house/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /My car/ })).toHaveCount(0);
  await expect(summary).toHaveText(total);
  await page.getByRole("button", { name: /My house/ }).click();
  await expect(page.getByRole("heading", { name: "My house", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Claim", exact: true })).toHaveCount(0);
});

test("balance privacy hides and restores only the portfolio presentation", async ({ page }) => {
  await page.goto("/tests/browser/harness.html");
  const amount = page.locator(".portfolio-balance > strong");
  await expect(amount).toContainText("$0.75");
  await page.getByRole("button", { name: "Hide total saved" }).click();
  await expect(amount).toHaveAttribute("aria-label", "Balance hidden");
  await expect(page.getByRole("button", { name: /My car/ })).toContainText("$0.25");
  await page.getByRole("button", { name: "Show total saved" }).click();
  await expect(amount).toContainText("$0.75");
});

test("an empty search resets and an empty account opens the real goal consent form", async ({ page }) => {
  await page.goto("/tests/browser/harness.html");
  await page.getByLabel("Search goals").fill("missing goal");
  await expect(page.getByRole("heading", { name: "No goals found." })).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(page.getByRole("heading", { name: "My car" })).toBeVisible();
  await page.goto("/tests/browser/harness.html?empty=1");
  await page.getByRole("button", { name: "Create your first goal" }).click();
  await expect(page.getByRole("checkbox", { name: /I understand deposits/ })).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Create goal", exact: true })).toBeDisabled();
});

test("mobile savings action follows the 3D model and navigation does not obscure it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tests/browser/harness.html?view=detail");
  const action = page.getByRole("button", { name: "Add savings", exact: true });
  const model = page.locator(".goal-workshop-column");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  expect((await action.boundingBox())!.y).toBeGreaterThan((await model.boundingBox())!.y + (await model.boundingBox())!.height);
  await action.focus();
  expect((await action.boundingBox())!.y + (await action.boundingBox())!.height).toBeLessThanOrEqual((await nav.boundingBox())!.y);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
});

test("install prompt is single-use and dismissal preserves the app", async ({ page }) => {
  await page.goto("/tests/browser/harness.html?page=settings");
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, { prompt: async () => { document.documentElement.dataset.promptCount = String(Number(document.documentElement.dataset.promptCount ?? "0") + 1); }, userChoice: Promise.resolve({ outcome: "dismissed" }) });
    window.dispatchEvent(event);
  });
  await page.locator(".settings-panel").getByRole("button", { name: "Install app", exact: true }).click();
  await expect(page.getByText("No problem. Keep using NabungFi here", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Install app", exact: true })).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-prompt-count", "1");
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
});

test("completed installation removes installation actions without mislabelling the browser as standalone", async ({ page }) => {
  await page.goto("/tests/browser/harness.html?page=settings");
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await expect(page.getByText("NabungFi is installed. Open it from your apps to use its own window.")).toBeVisible();
  await expect(page.getByText("NabungFi is running as an installed app.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Install app", exact: true })).toHaveCount(0);
  await page.getByLabel("Reduce motion").uncheck();
  await expect(page.getByLabel("Reduce motion")).not.toBeChecked();
});

test("standalone display is recognized separately from installation completion", async ({ page }) => {
  await page.addInitScript(() => {
    const nativeMatch = window.matchMedia.bind(window);
    window.matchMedia = query => {
      const result = nativeMatch(query);
      if (query === "(display-mode: standalone)") Object.defineProperty(result, "matches", { value: true });
      return result;
    };
  });
  await page.goto("/tests/browser/harness.html?page=settings");
  await expect(page.getByText("NabungFi is running as an installed app.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Install app", exact: true })).toHaveCount(0);
});

for (const width of [375, 768, 1280]) test(`goal validation error receives focus and remains unobscured at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/tests/browser/harness.html");
  await page.getByRole("button", { name: "New goal", exact: true }).click();
  await page.getByLabel("Goal name").fill("My laptop");
  await page.getByLabel("Target in USDC").fill("1.0000001");
  await page.getByRole("checkbox", { name: /I understand deposits/ }).check();
  await page.getByRole("button", { name: "Create goal", exact: true }).click();
  const error = page.getByRole("alert");
  await expect(error).toContainText("six decimal places");
  await expect(error).toBeFocused();
  const visible = await error.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return hit === element || element.contains(hit);
  });
  expect(visible).toBe(true);
});
