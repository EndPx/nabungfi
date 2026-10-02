import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("wallet review expires visibly and only requests a refresh of its unsigned original", async ({
  page,
}) => {
  await page.goto("/tests/browser/harness.html?view=wallet");
  await expect(
    page.getByRole("button", { name: "Confirm in wallet" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Confirm in wallet" }),
  ).toBeDisabled({ timeout: 6000 });
  await page.getByRole("button", { name: "Refresh unsigned plan" }).click();
  await expect(page.getByLabel("Fixture requested action")).toHaveText(
    "refresh-original",
  );
});

for (const width of [320, 390, 768, 1280]) {
  test(`goals and savings detail reflow without horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/tests/browser/harness.html");
    await expect(page.getByRole("heading", { name: "My house" })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: /My car/ }).click();
    await expect(
      page.getByText("Your next piece is taking shape"),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "50",
    );
  });
}
test("goal creation preserves target, owners, multiple chains and lock consent", async ({
  page,
}) => {
  await page.goto("/tests/browser/harness.html");
  await page.getByRole("button", { name: "New goal" }).click();
  await page.getByLabel("Goal name").fill("Laptop for work");
  await page.getByLabel("Target in USDC").fill("1250.000001");
  await page.getByLabel("Build model").selectOption("laptop");
  await page.getByLabel("Arbitrum Sepolia", { exact: true }).check();
  await expect(
    page.getByRole("button", { name: "Create goal" }),
  ).toBeDisabled();
  await page.getByRole("checkbox", { name: /I understand deposits/ }).check();
  await page.getByRole("button", { name: "Create goal" }).click();
  await expect(page.getByLabel("Fixture requested action")).toContainText(
    '"targetAmount":"1250.000001"',
  );
  await expect(page.getByLabel("Fixture requested action")).toContainText(
    '"model":"laptop"',
  );
  await expect(page.getByLabel("Fixture requested action")).toContainText(
    '"arbitrum"',
  );
});
test("deposit checks balance and exact approval before requesting a wallet plan", async ({
  page,
}) => {
  await page.goto("/tests/browser/harness.html?view=detail");
  await page.getByRole("button", { name: "Add savings" }).click();
  await page.getByLabel("From chain").selectOption("base");
  await page.getByLabel("Amount in USDC").fill("11");
  await page.getByRole("checkbox", { name: /This deposit belongs/ }).check();
  await page.getByRole("button", { name: "1. Review exact approval" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "exceeds your USDC balance",
  );
  await page.getByLabel("Amount in USDC").fill("0.000001");
  await page.getByRole("button", { name: "1. Review exact approval" }).click();
  await expect(page.getByLabel("Fixture requested action")).toHaveText(
    "approve:base:1",
  );
});
test("funded target waits for completion and claim stays isolated to achieved state", async ({
  page,
}) => {
  await page.goto("/tests/browser/harness.html?view=detail&amount=10000000");
  await expect(page.getByText("Your target is funded")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Claim", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Prepare completion" }),
  ).toBeEnabled();
  await page.goto("/tests/browser/harness.html?view=detail&phase=achieved");
  await expect(
    page.getByRole("button", { name: "Claim", exact: true }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Claim", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("Fixture requested action")).toHaveText(
    "claim:solana:5000000",
  );
});
test("unavailable chain reads block financial controls; modal supports Escape and focus return", async ({
  page,
}) => {
  await page.goto("/tests/browser/harness.html?view=detail&phase=unavailable");
  await expect(page.getByRole("button", { name: "Add savings" })).toHaveCount(
    0,
  );
  await expect(
    page.getByText("Read unavailable", { exact: true }).first(),
  ).toBeVisible();
  await page.goto("/tests/browser/harness.html");
  await page.getByRole("button", { name: "New goal" }).click();
  await page.getByRole("dialog").press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "New goal" })).toBeFocused();
});
test("goal overview and creation dialog pass automated WCAG AA checks", async ({
  page,
}) => {
  await page.goto("/tests/browser/harness.html");
  await expect(page.getByRole("heading", { name: "My house" })).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "New goal" }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
