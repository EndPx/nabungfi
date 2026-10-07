import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const width of [320, 375, 1280]) test(`wallet account explorers remain readable at ${width}px`, async ({page}) => {
  await page.setViewportSize({width,height:900});
  await page.goto("/tests/browser/harness.html?page=wallets");
  await expect(page.getByRole("button",{name:"Connect external wallet",exact:true})).toBeHidden();
  await expect(page.getByRole("button",{name:"Link external wallet",exact:true})).toBeHidden();
  const cards=page.locator(".wallet-list .live-panel");
  const solana=cards.filter({has:page.getByRole("heading",{name:"Solana wallet",exact:true})});
  const solanaAddress=await solana.locator(".live-address").innerText();
  const solanaLink=page.getByRole("link",{name:"View wallet on Solana Devnet",exact:true});
  await expect(solanaLink).toHaveAttribute("href",`https://explorer.solana.com/address/${solanaAddress}?cluster=devnet`);
  await expect(solanaLink).toHaveAttribute("target","_blank");
  const evm=cards.filter({has:page.getByRole("heading",{name:"EVM wallet",exact:true})});
  const address=await evm.locator(".live-address").innerText();
  await page.getByLabel("Choose explorer for EVM wallet",{exact:true}).click();
  for(const [name,origin] of [["Base Sepolia","https://sepolia.basescan.org"],["Arbitrum Sepolia","https://sepolia.arbiscan.io"],["Ethereum Sepolia","https://sepolia.etherscan.io"]]) {
    const link=page.getByRole("link",{name:`View wallet on ${name}`,exact:true});
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href",`${origin}/address/${address}`);
    await expect(link).toHaveAttribute("rel","noopener noreferrer");
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);
});

test("external-wallet connection and linking remain optional and callable",async({page})=>{
  await page.goto("/tests/browser/harness.html?page=wallets");
  await page.getByText("External wallet options",{exact:true}).click();
  await page.getByRole("button",{name:"Connect external wallet",exact:true}).click();
  await expect(page.getByLabel("Fixture requested action")).toHaveText("connect");
  await page.getByRole("button",{name:"Link external wallet",exact:true}).click();
  await expect(page.getByLabel("Fixture requested action")).toHaveText("link");
});
