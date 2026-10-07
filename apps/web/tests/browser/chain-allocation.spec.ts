import {test,expect} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("allocation details respond to hover, keyboard and explicit taps",async({page})=>{
  await page.goto("/tests/browser/harness.html?view=allocation");
  const baseSegment=page.getByRole("button",{name:"Base Sepolia: 62%, 62 USDC",exact:true});
  await baseSegment.hover();
  await expect(page.getByRole("tooltip")).toContainText("Base Sepolia");
  await expect(page.getByRole("tooltip")).toContainText("62% · 62 USDC");
  await page.getByRole("tooltip").hover();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.mouse.move(0,0);
  const solana=page.getByRole("button",{name:"Solana Devnet allocation details",exact:true});
  await solana.focus();
  await expect(page.getByRole("tooltip")).toContainText("25% · 25 USDC");
  await page.getByRole("button",{name:"Arbitrum Sepolia allocation details",exact:true}).click();
  await expect(page.getByRole("tooltip")).toContainText("8% · 8 USDC");
});

for(const width of [320,375,1280]) test(`collected allocation is readable and accessible at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.goto("/tests/browser/harness.html?view=allocation&collected=1");
  await expect(page.getByText("Includes collected savings",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Base Sepolia allocation details",exact:true}).click();
  await expect(page.getByRole("tooltip")).toContainText("62% · 62 USDC");
  await expect(page.getByRole("tooltip")).toContainText("Remaining 0 · Collected 62 USDC");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);
  const box=(await page.getByRole("button",{name:"Base Sepolia allocation details",exact:true}).boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
});

test("unavailable snapshots withhold allocation while an empty goal has no invented percentage",async({page})=>{
  await page.goto("/tests/browser/harness.html?view=detail&phase=achieved&read=unavailable");
  await expect(page.locator(".chain-allocation")).toHaveCount(0);
  await page.goto("/tests/browser/harness.html?view=detail&amount=0");
  await expect(page.getByText("Your allocation appears after the first deposit.",{exact:true})).toBeVisible();
  await expect(page.locator(".chain-allocation-segment")).toHaveCount(0);
});
