import { test, expect } from "@playwright/test";

test("pausing an in-flight original plan does not reopen its wallet review", async ({ page }) => {
  await page.goto("/tests/browser/goal-setup.html?delayed-plan");
  await page.getByRole("button", { name: "Create example selected-chain goal" }).click();
  await expect(page.getByRole("button", { name: "Return example original plan" })).toBeVisible();
  await page.getByRole("button", { name: "Pause setup", exact: true }).click();
  await page.getByRole("button", { name: "Return example original plan" }).click();
  await expect(page.getByRole("heading", { name: "Goal setup paused" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Confirm example/ })).toHaveCount(0);
  await expect(page.getByTestId("setup-requests")).toHaveText("base");
});

for (const width of [320, 390]) test(`mobile ${width}px Create advances selected vaults and waits for confirmed registration`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await page.goto("/tests/browser/goal-setup.html");
  await page.getByRole("button", { name: "Create example selected-chain goal" }).click();
  await expect(page.getByRole("heading", { name: "Getting your goal ready" })).toBeVisible();
  await expect(page.getByText("Arbitrum Sepolia", { exact: true })).toHaveCount(0);
  for (const network of ["base", "ethereum", "solana"]) {
    await page.getByRole("button", { name: `Confirm example ${network} transaction` }).click();
  }
  await expect(page.getByTestId("setup-requests")).toHaveText("base,ethereum,solana");
  await expect(page.getByRole("heading", { name: "Connecting your vaults…" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Example goal ready" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Deliver example registration" }).click();
  await expect(page.getByRole("heading", { name: "Example goal ready" })).toBeVisible();
});

test("rejection pauses setup and resume skips already confirmed vaults", async ({ page }) => {
  await page.goto("/tests/browser/goal-setup.html");
  await page.getByRole("button", { name: "Create example selected-chain goal" }).click();
  await page.getByRole("button", { name: "Confirm example base transaction" }).click();
  await page.getByRole("button", { name: "Reject example transaction" }).click();
  await expect(page.getByRole("heading", { name: "Goal setup paused" })).toBeVisible();
  await expect(page.getByTestId("setup-requests")).toHaveText("base,ethereum");
  await page.getByRole("button", { name: "Continue setup", exact: true }).click();
  await expect(page.getByRole("button", { name: "Confirm example ethereum transaction" })).toBeVisible();
  await expect(page.getByTestId("setup-requests")).toHaveText("base,ethereum,ethereum");
});

test("reload restores a paused original goal without repeating its confirmed Base vault", async ({ page }) => {
  await page.goto("/tests/browser/goal-setup.html");
  await page.getByRole("button", { name: "Create example selected-chain goal" }).click();
  await page.getByRole("button", { name: "Confirm example base transaction" }).click();
  await expect(page.getByRole("button", { name: "Confirm example ethereum transaction" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Goal setup paused" })).toBeVisible();
  await expect(page.getByTestId("setup-requests")).toHaveText("");
  await page.getByRole("button", { name: "Continue setup", exact: true }).click();
  await expect(page.getByTestId("setup-requests")).toHaveText("ethereum");
});

test("unknown signing outcomes block any replacement setup request", async ({ page }) => {
  await page.goto("/tests/browser/goal-setup.html");
  await page.getByRole("button", { name: "Create example selected-chain goal" }).click();
  await page.getByRole("button", { name: "Lose example receipt response" }).click();
  await expect(page.getByRole("button", { name: "Continue setup", exact: true })).toBeDisabled();
  await expect(page.getByTestId("setup-requests")).toHaveText("base");
  await expect(page.getByRole("button", { name: /Confirm example/ })).toHaveCount(0);
});
