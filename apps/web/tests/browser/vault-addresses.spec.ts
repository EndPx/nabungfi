import {test,expect} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fixtures from "../fixtures/unsigned-plans.json" with {type:"json"};

test.use({permissions:["clipboard-read","clipboard-write"]});
for(const width of [320,375,1280]) test(`goal vault identities and copy controls work at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.goto("/tests/browser/harness.html?view=detail&phase=claimed");
  const cash=fixtures.binding.solanaCash,vault=fixtures.binding.participants[0].vault;
  const solLink=page.getByRole("link",{name:`View Solana Devnet vault ${cash}`,exact:true});
  const baseLink=page.getByRole("link",{name:`View Base Sepolia vault ${vault}`,exact:true});
  await expect(solLink).toHaveAttribute("href",`https://explorer.solana.com/address/${cash}?cluster=devnet`);
  await expect(baseLink).toHaveAttribute("href",`https://sepolia.basescan.org/address/${vault}`);
  await expect(baseLink).toHaveAttribute("title",vault);
  await expect(baseLink).toHaveAttribute("rel","noopener noreferrer");
  expect(cash).not.toBe(fixtures.binding.solanaGoal);
  expect(cash).not.toBe(fixtures.binding.owner.solana);
  expect(vault).not.toBe(fixtures.binding.owner.evm);
  expect(vault).not.toBe("0x3c981d151ec6060fd3f2307801d764fecb22c688");
  await page.getByRole("button",{name:"Copy Base Sepolia vault address",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toBe(vault);
  await page.getByRole("button",{name:"Copy Solana Devnet vault address",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toBe(cash);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);
});

test("uncreated vaults do not expose a predicted address as an existing account",async({page})=>{
  await page.goto("/tests/browser/harness.html?view=detail&amount=0&vaults=missing");
  await expect(page.getByText("Vault not created",{exact:true})).toHaveCount(2);
  await expect(page.locator(".vault-address-link")).toHaveCount(0);
  await expect(page.getByRole("button",{name:/Copy .* vault address/})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Initialize Solana goal",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Initialize Solana goal",exact:true})).toBeDisabled();
  await expect(page.getByText("Solana setup becomes available after the selected EVM vaults are created and verified.",{exact:true})).toBeVisible();
});

test("Solana setup requires both the actual EVM vault and its verified configuration",async({page})=>{
  await page.goto("/tests/browser/harness.html?view=detail&amount=0&vaults=ready&configuration=missing");
  await expect(page.getByRole("button",{name:"Initialize Solana goal",exact:true})).toBeDisabled();
  await page.goto("/tests/browser/harness.html?view=detail&amount=0&vaults=ready");
  await page.getByRole("button",{name:"Initialize Solana goal",exact:true}).click();
  await expect(page.getByLabel("Fixture requested action")).toHaveText("initialize:solana:");
});

test("known vault identities survive a failed balance read without exposing claim actions",async({page})=>{
  await page.goto("/tests/browser/harness.html?view=detail&phase=achieved&read=unavailable");
  await expect(page.locator(".vault-address-link")).toHaveCount(2);
  await expect(page.getByRole("button",{name:"Claim",exact:true})).toHaveCount(0);
  await expect(page.locator(".network-row-value")).toHaveText(["—Cash USDC","—Cash USDC"]);
});
