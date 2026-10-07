import {test,expect} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({timezoneId:"Asia/Jakarta"});

for (const width of [375,768]) test(`goal activity is below every goal section at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.goto("/tests/browser/harness.html?view=detail&history=1");
  await page.locator(".car-stage").waitFor({state:"visible",timeout:30000});
  const sections=[".goal-workshop-column",".goal-financial-summary",".goal-chain-panel",".goal-commitment-panel",".goal-history-panel"];
  for(let i=0;i<sections.length-1;i++) {
    const before=(await page.locator(sections[i]).boundingBox())!;
    const after=(await page.locator(sections[i+1]).boundingBox())!;
    expect(before.y+before.height).toBeLessThanOrEqual(after.y);
  }
  await expect(page.locator(".live-detail-grid > :last-child")).toHaveClass(/goal-history-panel/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);
});

test("activity dates preserve backend creation times and convert a UTC midnight boundary",async({page})=>{
  await page.goto("/tests/browser/harness.html?view=detail&history=1");
  const dates=page.locator(".goal-history-panel time");
  await expect(dates).toHaveCount(2);
  await expect(dates.nth(0)).toHaveAttribute("datetime","2026-10-06T23:15:00.000Z");
  await expect(dates.nth(0)).toContainText("7 Oct 2026");
  await expect(dates.nth(0)).toContainText("06:15");
  await expect(dates.nth(0)).toContainText("GMT+7");
  await expect(dates.nth(1)).toContainText("6 Oct 2026");
  await expect(dates.nth(1)).toContainText("23:30");
});

test("desktop keeps activity beneath the build and beside the financial rail",async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto("/tests/browser/harness.html?view=detail&history=1");
  await page.locator(".car-stage").waitFor({state:"visible",timeout:30000});
  const model=(await page.locator(".goal-workshop-column").boundingBox())!;
  const activity=(await page.locator(".goal-history-panel").boundingBox())!;
  const rail=(await page.locator(".live-financial-rail").boundingBox())!;
  expect(activity.x).toBeCloseTo(model.x,0);
  expect(activity.y).toBeGreaterThanOrEqual(model.y+model.height);
  expect(rail.x).toBeGreaterThan(activity.x+activity.width);
});
