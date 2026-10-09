import {test,expect} from '@playwright/test';
test('eligible sponsored wallet can review a deposit with zero native gas',async({page})=>{
 await page.goto('/tests/browser/harness.html?view=detail&zero-native=1&sponsored=1');
 await page.getByRole('button',{name:'Add savings',exact:true}).click();
 await page.getByRole('textbox',{name:'Amount in USDC'}).fill('0.01');
 await page.getByRole('checkbox',{name:/This deposit belongs only/}).check();
 await page.getByRole('button',{name:'Review deposit',exact:true}).click();
 await expect(page.locator('output[aria-label="Fixture requested action"]')).toHaveText('deposit:solana:10000');
});
test('direct zero-gas wallet remains blocked with a visible reason',async({page})=>{
 await page.goto('/tests/browser/harness.html?view=detail&zero-native=1');
 await page.getByRole('button',{name:'Add savings',exact:true}).click();
 await page.getByRole('textbox',{name:'Amount in USDC'}).fill('0.01');
 await page.getByRole('checkbox',{name:/This deposit belongs only/}).check();
 await page.getByRole('button',{name:'Review deposit',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Add testnet SOL');
});
test('deposit draft keeps its value while final planning waits for a background read',async({page})=>{
 await page.goto('/tests/browser/harness.html?view=detail&deposit-refreshing=1');
 await page.getByRole('button',{name:'Add savings',exact:true}).click();
 await page.getByRole('textbox',{name:'Amount in USDC'}).fill('0.01');
 await page.getByRole('checkbox',{name:/This deposit belongs only/}).check();
 await expect(page.getByRole('button',{name:'Review deposit',exact:true})).toBeDisabled();
 await expect(page.getByRole('textbox',{name:'Amount in USDC'})).toHaveValue('0.01');
 await expect(page.getByText(/Checking your wallet balances or original request/)).toBeVisible();
});
