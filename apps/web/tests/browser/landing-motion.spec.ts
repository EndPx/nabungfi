import { test, expect } from "@playwright/test";

test("app destinations use their own URLs and browser history", async ({
  page,
}) => {
  await page.goto("/app");
  await page.getByRole("button", { name: "Activity", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/activity$/);
  await expect(
    page.getByRole("button", { name: "Activity", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/settings$/);
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Activity", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.reload();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  await expect(page.locator(".chain-story")).toHaveCount(0);
});

test("landing motion follows scroll and can be paused without hiding content", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.locator(".landing")).toHaveAttribute("data-motion", "full");
  await page.locator(".chain-story").scrollIntoViewIfNeeded();
  await expect
    .poll(async () =>
      page
        .locator(".landing-reading-progress")
        .evaluate((element) => getComputedStyle(element).transform),
    )
    .not.toBe("none");
  await page.getByRole("button", { name: "Pause page motion" }).click();
  await expect(page.locator(".landing")).toHaveAttribute(
    "data-motion",
    "reduced",
  );
  await expect(
    page.getByRole("heading", {
      name: "Many chains. One thing you’re building.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Enable page motion" }).click();
  await expect(page.locator(".landing")).toHaveAttribute("data-motion", "full");
});

test("device reduced motion shows the completed brand and leaves FAQs usable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".landing")).toHaveAttribute(
    "data-motion",
    "reduced",
  );
  await expect(
    page.getByRole("button", { name: "Motion reduced by your device setting" }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Questions", exact: true }).click();
  await page
    .locator("summary")
    .filter({ hasText: "Can I withdraw before the target?" })
    .click();
  await expect(
    page.getByText("There is no time-based unlock.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.locator(".chain-story .building-mark rect").first(),
  ).toHaveCSS("opacity", "1");
});

test("requested 3D intro stays silent and preserves the account sound preference", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() =>
    localStorage.setItem("nabungfi:assembly-sound", "on"),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Try a build" }).click();
  await expect(
    page.getByRole("button", { name: "Enable assembly sound" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Try assembly" }),
  ).toBeEnabled();
  expect(
    await page.evaluate(() => localStorage.getItem("nabungfi:assembly-sound")),
  ).toBe("on");
});
