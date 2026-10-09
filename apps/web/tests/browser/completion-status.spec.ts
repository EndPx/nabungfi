import { test, expect } from "@playwright/test";

test("a funded goal makes preparation primary and waiting for verification is explicit", async ({ page }) => {
  await page.goto("/tests/browser/harness.html?view=detail&amount=11000000");
  const prepare = page.getByRole("button", { name: "Prepare completion", exact: true });
  await expect(prepare).toBeEnabled();
  await expect(prepare).toHaveClass(/button--build/);
  await prepare.click();
  await expect(page.getByLabel("Fixture requested action")).toHaveText("prepare:solana:");
  await page.goto("/tests/browser/harness.html?view=detail&amount=11000000&phase=preparing");
  const status = page.locator(".completion-status");
  await expect(status).toContainText("Your request is confirmed");
  await expect(status).toContainText("Even a chain with a zero balance must confirm");
  await expect(status).toContainText("The final build piece appears after completion is verified");
  await expect(page.getByRole("button", { name: "Claim", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add savings", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Fixture requested action")).toBeEmpty();
});

test("cancellation is a deliberate separate option, not the next completion action", async ({ page }) => {
  await page.goto("/tests/browser/harness.html?view=detail&amount=11000000&phase=preparing");
  const cancel = page.getByRole("button", { name: "Cancel completion", exact: true });
  await expect(cancel).not.toBeVisible();
  await page.getByText("Completion options", { exact: true }).click();
  await expect(page.getByText(/Cancel only if you want to stop this completion round/)).toBeVisible();
  await expect(cancel).toBeVisible();
  await cancel.click();
  await expect(page.getByLabel("Fixture requested action")).toHaveText("abort:solana:");
});

test("aborting preserves funded amounts and explains the wait before another prepare", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tests/browser/harness.html?view=detail&amount=11000000&phase=aborting");
  const summary = page.locator(".goal-financial-summary");
  await expect(summary).toContainText("$11.00");
  await expect(summary).toContainText("100%");
  await expect(summary.locator(".completion-status")).toContainText("Your funds stay in your vaults");
  await expect(summary.locator(".completion-status")).toContainText("acknowledge the cancellation");
  await expect(page.getByRole("button", { name: "Prepare completion", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add savings", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Claim", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Fixture requested action")).toBeEmpty();
  await summary.screenshot({ path: "../../.local/completion-debug/cancelling-mobile.png" });
  await page.goto("/tests/browser/harness.html?view=detail&amount=11000000");
  await expect(page.getByRole("button", { name: "Prepare completion", exact: true })).toBeEnabled();
});

test("a target funded before reports are ready has an explanatory syncing state", async ({ page }) => {
  await page.goto("/tests/browser/harness.html?view=detail&amount=11000000&syncing=1");
  await expect(page.locator(".completion-status")).toContainText("Syncing vault balances");
  await expect(page.getByRole("button", { name: "Prepare completion", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
});
