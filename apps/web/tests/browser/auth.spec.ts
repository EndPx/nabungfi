import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("login artwork animates the approved N, pauses and continues during verification", async ({page}) => {
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.setViewportSize({width:1280,height:900});
  await page.goto("/tests/browser/auth.html");
  const artwork=page.locator(".login-art"),scene=page.locator(".login-art-scene");
  await expect(artwork).toHaveAttribute("data-running","true");
  await expect(page.locator('.login-art img[src*="/models/"]')).toHaveCount(0);
  const assembling=await scene.screenshot();
  await page.waitForTimeout(450);
  expect((await scene.screenshot()).equals(assembling)).toBe(false);
  await page.getByRole("button",{name:"Pause artwork",exact:true}).click();
  await expect(artwork).toHaveAttribute("data-running","false");
  const paused=await page.locator(".login-emblem").screenshot();
  const pausedTransform=await page.locator(".login-emblem").evaluate(element=>getComputedStyle(element).transform);
  await page.waitForTimeout(450);
  expect((await page.locator(".login-emblem").screenshot()).equals(paused)).toBe(true);
  expect(await page.locator(".login-emblem").evaluate(element=>getComputedStyle(element).transform)).toBe(pausedTransform);
  await page.getByRole("button",{name:"Resume artwork",exact:true}).click();
  await expect(artwork).toHaveAttribute("data-running","true");
  await page.getByRole("button",{name:"Continue with Google",exact:true}).click();
  await page.getByRole("button",{name:"Complete example Google sign-in"}).click();
  await expect(page.getByRole("heading",{name:"Verifying your account"})).toBeVisible();
  await expect(artwork).toHaveAttribute("data-running","true");
  await expect(page.getByRole("navigation",{name:"Main navigation"})).toHaveCount(0);
});

test("reduced motion shows a static N and the hidden mobile artwork does not animate", async ({page}) => {
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.setViewportSize({width:1280,height:900});
  await page.goto("/tests/browser/auth.html");
  await expect(page.locator(".login-art")).toHaveAttribute("data-running","false");
  await page.evaluate(()=>document.fonts.ready);
  const emblem=page.locator(".login-emblem"),before=await emblem.screenshot();
  await page.waitForTimeout(450);
  expect((await emblem.screenshot()).equals(before)).toBe(true);
  await expect(page.getByRole("button",{name:"Pause artwork",exact:true})).toBeHidden();
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator(".login-art")).toBeHidden();
  await expect(page.locator(".login-art")).toHaveAttribute("data-running","false");
});

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

test("Google failure restores login choices without opening the workspace", async ({ page }) => {
  await page.goto("/tests/browser/auth.html");
  await page.getByRole("button", { name: "Continue with Google", exact: true }).click();
  await expect(page.getByRole("button", { name: "Connecting to Google…", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Continue with a wallet", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Email address", { exact: true })).toBeDisabled();
  await expect(page.getByTestId("google-login-requests")).toHaveText("1");
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel example Google sign-in" }).click();
  await expect(page.getByRole("alert")).toContainText("cancelled");
  await expect(page.getByRole("button", { name: "Continue with Google", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Continue with a wallet", exact: true })).toBeEnabled();
  await page.getByLabel("Email address", { exact: true }).fill("visitor@example.test");
  await page.getByRole("button", { name: "Send code", exact: true }).click();
  await expect(page.getByLabel("Verification code", { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
});

test("Google authentication still requires a matching backend identity and retains the goal", async ({ page }) => {
  await page.goto("/tests/browser/auth.html?next=%2Fapp%2Fgoals%3Fgoal%3Dcar");
  await page.getByRole("button", { name: "Continue with Google", exact: true }).click();
  await page.getByRole("button", { name: "Complete example Google sign-in" }).click();
  await expect(page.getByRole("heading", { name: "Verifying your account" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
  await page.getByRole("button", { name: "Return mismatched example session" }).click();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
  await page.getByRole("button", { name: "Verify matching example session" }).click();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await expect(page.getByTestId("return-target")).toHaveText("/app/goals?goal=car");
});

test("Google sign-in remains disabled when offline or unconfigured", async ({ page }) => {
  for (const query of ["offline", "unavailable"]) {
    await page.goto("/tests/browser/auth.html?" + query);
    await expect(page.getByRole("button", { name: "Continue with Google", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Continue with a wallet", exact: true })).toBeDisabled();
    await expect(page.getByTestId("google-login-requests")).toHaveText("0");
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
  }
});
