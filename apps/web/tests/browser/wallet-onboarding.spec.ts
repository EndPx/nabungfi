import { test, expect } from "@playwright/test";

test("mobile custom sign-in prepares both wallets before showing the workspace", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tests/browser/wallet-onboarding.html?new&backend-wait");
  await expect(page.getByTestId("creation-count")).toHaveText("ethereum=0;solana=0");
  await page.getByRole("button", { name: "Complete example sign-in" }).click();
  await expect(page.getByRole("heading", { name: "Preparing your wallets…" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
  await page.getByRole("button", { name: "Finish example ethereum creation" }).click();
  await expect(page.getByTestId("creation-count")).toHaveText("ethereum=1;solana=1");
  await page.getByRole("button", { name: "Finish example solana creation" }).click();
  await expect(page.getByRole("heading", { name: "Preparing your wallets…" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Wallets", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Publish example backend ownership" }).click();
  await expect(page.getByRole("heading", { name: "Wallets", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "EVM wallet", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Solana wallet", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Create (EVM|Solana) wallet/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("a restored walletless account bootstraps and failure retry does not recreate its EVM wallet", async ({ page }) => {
  await page.goto("/tests/browser/wallet-onboarding.html");
  await page.getByRole("button", { name: "Finish example ethereum creation" }).click();
  await page.getByRole("button", { name: "Fail example solana creation" }).click();
  await expect(page.getByRole("alert")).toContainText("solana creation unavailable");
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
  await page.getByRole("button", { name: "Retry verification" }).click();
  await expect(page.getByTestId("creation-count")).toHaveText("ethereum=1;solana=2");
  await page.getByRole("button", { name: "Finish example solana creation" }).click();
  await expect(page.getByRole("heading", { name: "Wallets", exact: true })).toBeVisible();
});

test("existing owner wallets survive login without creation and offline startup creates none", async ({ page }) => {
  await page.goto("/tests/browser/wallet-onboarding.html?existing");
  await expect(page.getByRole("heading", { name: "Wallets", exact: true })).toBeVisible();
  await expect(page.getByTestId("creation-count")).toHaveText("ethereum=0;solana=0");
  await page.goto("/tests/browser/wallet-onboarding.html?offline");
  await expect(page.getByTestId("creation-count")).toHaveText("ethereum=0;solana=0");
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
});
