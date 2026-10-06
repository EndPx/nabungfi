import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const width of [320, 375, 768, 1280]) test(`faucets and five-destination navigation are readable at ${width}px`, async ({page}) => {
  await page.setViewportSize({width,height:900});
  await page.goto("/tests/browser/harness.html?page=faucets");
  await expect(page.getByRole("heading",{name:"Faucets",exact:true})).toBeVisible();
  await expect(page.getByRole("navigation",{name:"Main navigation"}).getByRole("button")).toHaveCount(5);
  for(const name of ["Solana Devnet","Base Sepolia","Arbitrum Sepolia","Ethereum Sepolia"]) {
    await expect(page.getByRole("link",{name:`Get USDC for ${name}`,exact:true})).toHaveAttribute("href","https://faucet.circle.com/");
    await expect(page.getByRole("heading",{name,exact:true})).toBeVisible();
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);
});
test("faucet destinations keep native gas networks separate and show eligibility", async ({page}) => {
  await page.goto("/tests/browser/harness.html?page=faucets");
  await expect(page.getByRole("link",{name:"Get SOL for Solana Devnet",exact:true})).toHaveAttribute("href","https://faucet.solana.com/");
  await expect(page.getByRole("link",{name:"Get ETH for Base Sepolia",exact:true})).toHaveAttribute("href","https://portal.cdp.coinbase.com/products/faucet");
  await expect(page.getByRole("link",{name:"Get ETH for Arbitrum Sepolia",exact:true})).toHaveAttribute("href","https://www.alchemy.com/faucets/arbitrum-sepolia");
  await expect(page.getByText("Alchemy requires mainnet balance",{exact:false})).toBeVisible();
  await expect(page.getByRole("link",{name:"Get ETH for Ethereum Sepolia",exact:true})).toHaveAttribute("href","https://cloud.google.com/application/web3/faucet/ethereum/sepolia");
});
test("missing faucet wallet leads to verified wallet setup", async ({page}) => {
  await page.goto("/tests/browser/harness.html?page=faucets&missing-wallets=1");
  await expect(page.getByRole("button",{name:/Copy .* wallet address/})).toHaveCount(0);
  await page.getByRole("button",{name:"Open Wallets",exact:true}).first().click();
  await expect(page.getByRole("heading",{name:"Wallets",exact:true})).toBeVisible();
});
