import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("the brand remains visible in marketing and app layouts at narrow widths", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  for (const path of ["/", "/app", "/?showcase=1"]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    await expect(
      page.locator(
        path === "/app"
          ? ".login-brand .brand"
          : path === "/"
            ? ".landing-header .brand"
            : ".system-header .brand",
      ),
    ).toBeVisible();
  }
});

test("landing stays separate from a returning account and opens the task app", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (location.pathname === "/")
      localStorage.setItem("nabungfi:session-hint", "1");
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Build what you’re saving for." }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.evaluate(() => localStorage.removeItem("nabungfi:session-hint"));
  await page.getByRole("link", { name: "Start a goal" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Sign in to your workshop" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toHaveCount(0);
});

test("landing model choices and native FAQ disclose the actual commitment", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "A better laptop" }).click();
  await expect(
    page.getByRole("button", { name: "A better laptop" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".landing-poster .goal-art--laptop")).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: "Can I withdraw before the target?" })
    .click();
  await expect(
    page.getByText("There is no time-based unlock.", { exact: false }),
  ).toBeVisible();
});

for (const destination of ["activity", "wallets", "settings"]) {
  test(`${destination} uses the shared page with readable mobile navigation`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(`/tests/browser/harness.html?page=${destination}`);
    await expect(
      page.getByRole("heading", {
        name: destination[0].toUpperCase() + destination.slice(1),
        exact: true,
      }),
    ).toBeVisible();
    const active = page.getByRole("button", {
      name: destination[0].toUpperCase() + destination.slice(1),
      exact: true,
    });
    await expect(active).toHaveAttribute("aria-current", "page");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    if (destination === "settings") {
      await page.getByLabel("Reduce motion").uncheck();
      await expect(page.getByLabel("Reduce motion")).not.toBeChecked();
    }
    if (destination === "activity") {
      await page.getByRole("button", { name: "View history" }).click();
      await expect(
        page.getByRole("heading", { name: "My next car", exact: true }),
      ).toBeVisible();
    }
  });
}

test("landing, sign-in gate and design showcase pass automated contrast and semantics checks", async ({
  page,
}) => {
  for (const path of ["/", "/app", "/?showcase=1"]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
});
