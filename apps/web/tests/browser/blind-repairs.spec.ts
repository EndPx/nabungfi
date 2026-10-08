import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for(const width of [320,390,768,1280]) test(`dashboard vocabulary, heading reflow and draft navigation at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.goto('/tests/browser/harness.html?refreshing=1');
 await expect(page.getByRole('heading',{name:'Current savings'})).toBeVisible();
 await expect(page.getByText('TESTNET WORKSHOP · CASH USDC')).toBeVisible();
 await expect(page.getByText(/Funds still in your goal vaults/)).toBeVisible();
 await expect(page.getByRole('button',{name:/My car/})).toContainText('funded pieces');
 const heading=page.getByRole('heading',{name:'Dashboard',exact:true});
 const box=(await heading.boundingBox())!;
 const lineHeight=await heading.evaluate(el=>parseFloat(getComputedStyle(el).lineHeight));
 expect(box.height).toBeLessThan(lineHeight*1.5);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'New goal',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.getByText(/This workshop uses testnet USDC/)).toBeVisible();
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
});

test('pending request permits reading a draft but explains why final creation is blocked',async({page})=>{
 await page.goto('/tests/browser/harness.html?pending-draft=1');
 await page.getByRole('button',{name:'New goal',exact:true}).click();
 await expect(page.getByText('Finish or cancel the saved step before creating another goal.')).toBeVisible();
 await expect(page.getByRole('button',{name:'Create goal',exact:true})).toBeDisabled();
});

test('history navigation focuses and reveals activity rather than the model',async({page})=>{
 await page.goto('/tests/browser/harness.html?page=activity&history=1');
 await page.getByRole('button',{name:'View history'}).click();
 await expect(page.locator('#goal-activity')).toBeFocused();
 await expect(page.locator('#goal-activity time').first()).toBeInViewport();
 await expect(page.locator('.car-stage')).toHaveCount(0);
 await page.getByRole('button',{name:'Back to activity'}).click();
 await expect(page.getByRole('button',{name:'View history'})).toBeVisible();
});

test('visual assembly count is distinct from funded completion',async({page})=>{
 await page.goto('/tests/browser/harness.html?view=detail&phase=claimed');
 await expect(page.locator('.piece-counter')).toContainText('assembled',{timeout:30000});
 await expect(page.getByText(/100 \/ 100 pieces funded by this goal/)).toBeVisible();
 await expect(page.getByText(/Assembly is visual/)).toBeVisible();
 await expect(page.getByText(/Total collected · Target/)).toBeVisible();
 await expect(page.getByText(/Your completed goal stays here/)).toBeVisible();
 await page.getByText('How your savings unlock',{exact:true}).click();
 await expect(page.getByText(/Choose Prepare completion/)).toBeVisible();
 await expect(page.getByText(/Claim savings on each chain/)).toBeVisible();
});

test('history for an unavailable goal remains readable and history errors have a read-only retry',async({page})=>{
 await page.goto('/tests/browser/harness.html?page=activity&history-error=1&history=1&available=0');
 await page.getByRole('button',{name:'View history'}).click();
 await expect(page.getByRole('alert')).toContainText('activity couldn’t be read');
 await page.getByRole('button',{name:'Retry history'}).click();
 await expect(page.locator('output[aria-label="Fixture requested action"]')).toHaveText('refresh-history');
 await expect(page.locator('.car-stage')).toHaveCount(0);
});

test('unsigned review exposes cancellation while attempted transactions retain original-hash recovery',async({page})=>{
 await page.goto('/tests/browser/harness.html?view=recovery&unsigned=1');
 await expect(page.getByRole('heading',{name:'A saved step is waiting for your review'})).toBeVisible();
 await page.getByRole('button',{name:'Cancel unsigned step'}).click();
 await expect(page.locator('output[aria-label="Fixture requested action"]')).toHaveText('cancel-unsigned-plan');
 await page.goto('/tests/browser/harness.html?view=recovery');
 await expect(page.getByRole('button',{name:'Cancel unsigned step'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Check original transaction'})).toHaveCount(2);
});
