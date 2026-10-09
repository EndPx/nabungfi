import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("a fully collected goal keeps its build and offers no further deposit or claim", async ({page}) => {
  await page.goto("/tests/browser/harness.html?view=detail&phase=claimed");
  await expect(page.getByText("All savings have been collected. Your completed goal stays here. Assemble or replay its funded pieces anytime.")).toBeVisible();
  await expect(page.locator(".network-row-value")).toHaveText(["$0.00Cash USDC", "$0.00Cash USDC"]);
  await expect(page.getByRole("button", {name:"Claim", exact:true})).toHaveCount(0);
  await expect(page.getByRole("button", {name:"Add savings", exact:true})).toHaveCount(0);
  await expect(page.getByRole("button", {name:"Prepare completion", exact:true})).toHaveCount(0);
  await expect(page.locator(".goal-progress .is-filled")).toHaveCount(100);
});

test("an unknown Solana request offers a read-only expired-history check without another signature",async({page})=>{
  await page.goto("/tests/browser/harness.html?view=recovery&expired-solana=1");
  await page.getByRole("button",{name:"Check expired Solana request"}).click();
  await expect(page.getByLabel("Fixture requested action")).toHaveText("resolve-expired-original");
  await expect(page.getByRole("button",{name:"Confirm in wallet"})).toHaveCount(0);
});

test("the browser can encode and decode Solana transaction bytes for its wallet SDK", async ({page}) => {
  await page.goto("/tests/browser/harness.html");
  const bytes = await page.evaluate(() => {
    const buffer = (globalThis as any).Buffer;
    return {encoded:buffer.from(new Uint8Array([0,255,128,17])).toString("base64"),decoded:[...buffer.from("AP+AEQ==","base64")]};
  });
  expect(bytes).toEqual({encoded:"AP+AEQ==",decoded:[0,255,128,17]});
});

test("native review releases the top layer for the wallet confirmation portal", async ({page}) => {
  await page.goto("/tests/browser/harness.html?view=wallet&wallet-handoff=1");
  await page.getByRole("button", {name:"Confirm in wallet"}).click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(page.getByRole("dialog", {name:"Example wallet confirmation"})).toBeVisible();
  await page.getByRole("button", {name:"Example wallet approve"}).click();
  await expect(page.getByLabel("Fixture requested action")).toHaveText("wallet-portal-approved");
});

test("an unsent request requires explicit attestation and a submitted hash retains reconciliation", async ({page}) => {
  await page.goto("/tests/browser/harness.html?view=recovery");
  const close = page.getByRole("button",{name:"Close unsent request"});
  await expect(close).toHaveCount(1); await expect(close).toBeDisabled();
  await page.getByRole("checkbox",{name:/My wallet never reached approval/}).check();
  await expect(close).toBeEnabled();
  await page.getByRole("textbox",{name:"Original transaction hash"}).fill("0x"+"4".repeat(64));
  await expect(close).toBeDisabled();
  await page.getByRole("textbox",{name:"Original transaction hash"}).fill("");
  await close.click();
  await expect(page.getByLabel("Fixture requested action")).toHaveText("attest-wallet-not-invoked");
  await expect(page.getByRole("button",{name:"Check original transaction"}).last()).toBeEnabled();
});

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
    await page.locator(".car-stage").waitFor({ state: "visible", timeout: 30000 });
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
  await page.locator(".car-stage").waitFor({ state: "visible", timeout: 30000 });
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

test("an unavailable achieved snapshot withholds stale chain balances and claim controls", async ({ page }) => {
  await page.goto("/tests/browser/harness.html?view=detail&phase=achieved&read=unavailable");
  await expect(page.getByText("Read unavailable", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Claim", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add savings", exact: true })).toHaveCount(0);
  const values = page.locator(".network-row-value");
  await expect(values).toHaveCount(2);
  for (const value of await values.all()) await expect(value).toContainText("—");
  await expect(page.getByText("Unlocked", { exact: true })).toHaveCount(0);
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
