import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("email OTP and backend identity verification precede any workspace", async ({ page }) => {
  await page.goto("/tests/browser/auth.html?next=%2Fapp%2Fgoals%3Fgoal%3Dcar");
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send code" })).toBeDisabled();
  await page.getByLabel("Email address", { exact: true }).fill("visitor@example.test");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByLabel("Verification code", { exact: true })).toBeVisible();
  await expect(page.getByTestId("codes-sent")).toHaveText("1");
  await page.getByLabel("Verification code", { exact: true }).fill("111111");
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page.getByRole("alert")).toContainText("incorrect");
  await page.getByLabel("Verification code", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page.getByRole("heading", { name: "Verifying your account" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
  await page.getByRole("button", { name: "Return mismatched example session" }).click();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
  await page.getByRole("button", { name: "Verify matching example session" }).click();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await expect(page.getByTestId("return-target")).toHaveText("/app/goals?goal=car");
});

test("code resend, change email and wallet choice preserve explicit user actions", async ({ page }) => {
  await page.goto("/tests/browser/auth.html");
  await page.getByRole("button", { name: "Continue with a wallet" }).click();
  await expect(page.getByText("Example wallet login requested.")).toBeVisible();
  await page.getByLabel("Email address", { exact: true }).fill("visitor@example.test");
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByRole("button", { name: "Send another code" }).click();
  await expect(page.getByTestId("codes-sent")).toHaveText("2");
  await page.getByRole("button", { name: "Change email" }).click();
  await expect(page.getByLabel("Email address", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Verification code", { exact: true })).toHaveCount(0);
});

test("sign-in layout reflows and retains labelled keyboard controls", async ({ page }) => {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/tests/browser/auth.html");
    await expect(page.getByRole("heading", { name: "Sign in to your workshop" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  }
});
