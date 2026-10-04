import { test, expect } from "@playwright/test";

test("the app's public build preview works without authentication or application API traffic", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const apiCalls: string[] = [];
  page.on("request", request => {
    const url = new URL(request.url());
    const publicPrivyConfiguration = request.method() === "GET" && url.origin === "https://auth.privy.io" && /^\/api\/v1\/apps\/[^/]+$/.test(url.pathname);
    if (url.pathname.startsWith("/api/") && !publicPrivyConfiguration) apiCalls.push(request.url());
  });
  await page.goto("/app");
  await page.getByRole("link", { name: "Try the build without signing in", exact: false }).click();
  await expect(page.locator(".landing")).toBeVisible();
  await expect(page.locator(".car-stage")).toHaveAttribute("aria-label", /100 of 100/);
  await expect(page.getByRole("button", { name: "Try assembly", exact: true })).toBeEnabled();
  await expect(page.getByText("Model preview · no funds", { exact: true })).toBeVisible();
  expect(apiCalls).toEqual([]);
  await page.getByRole("link", { name: "NabungFi home", exact: true }).click();
  await expect(page.getByRole("button", { name: "Explore 360°", exact: true })).toBeVisible();
});

test("the first desktop viewport states the asset and testnet context; FAQs explain claim eligibility", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  const release = page.getByText("Multichain USDC savings · Available on testnet", { exact: true });
  const box = await release.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThan(720);
  const guestAction = await page.getByRole("link", { name: "Try the build", exact: true }).boundingBox();
  expect(guestAction).not.toBeNull();
  expect(guestAction!.y + guestAction!.height).toBeLessThan(720);
  await expect(page.getByText("No wallet needed", { exact: true })).toBeVisible();
  await page.locator("summary").filter({ hasText: "Does building the model unlock my savings?" }).click();
  await expect(page.getByText(/Playing or replaying the assembly never changes/)).toBeVisible();
  await page.locator("summary").filter({ hasText: "What happens when I reach the target?" }).click();
  await expect(page.getByText(/A delayed chain stays pending/)).toBeVisible();
});
