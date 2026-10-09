import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('wallet balances show independent USDC and gas balances and refresh without a goal',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/tests/browser/harness.html?page=wallets&empty=1&wallet-delay=1');
  await expect(page.getByText('Loading wallet balances…',{exact:true})).toBeVisible();
  await expect(page.locator('.wallet-token-values')).toHaveCount(4);
  await expect(page.getByText('2.000001 USDC',{exact:true})).toBeVisible();
  await expect(page.getByText('0.1809512 SOL',{exact:true})).toBeVisible();
  await expect(page.getByText('5.25 USDC',{exact:true})).toBeVisible();
  await expect(page.getByText('<0.00000001 ETH',{exact:true})).toBeVisible();
  await expect(page.getByText('<0.00000001 ETH',{exact:true})).toHaveAttribute('title','0.000000000000000001 ETH');
  const before=await page.locator('.wallet-balances time').first().getAttribute('datetime');
  await page.getByRole('button',{name:'Refresh balances',exact:true}).click();
  await expect(page.getByText('Updating wallet balances. Showing the last verified read.',{exact:true})).toBeVisible();
  await expect(page.locator('.wallet-balances time').first()).not.toHaveAttribute('datetime',before!);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await page.locator('.wallet-list').screenshot({path:'../../.local/wallet-balances-mobile.png'});
});

test('partial and failed reads show unavailable rather than fabricated zero',async({page})=>{
  await page.goto('/tests/browser/harness.html?page=wallets&wallet-partial=1');
  const base=page.locator('.wallet-balance-network').filter({hasText:'Base Sepolia'});
  await expect(base).toContainText('Balances unavailable');
  await expect(base.locator('dd')).toHaveText(['—','—']);
  await expect(page.getByText('7.5 USDC',{exact:true})).toBeVisible();
  await page.goto('/tests/browser/harness.html?page=wallets&wallet-error=1');
  await expect(page.getByText('Wallet balances couldn’t be verified. Refresh to try again.',{exact:true})).toBeVisible();
  await expect(page.locator('.wallet-token-values dd')).toHaveText(Array(8).fill('—'));
  await expect(page.getByRole('button',{name:'Refresh balances',exact:true})).toBeEnabled();
});

test('claim is yellow when eligible and explicitly waits when another vault has not confirmed',async({page})=>{
  await page.goto('/tests/browser/harness.html?view=detail&phase=achieved');
  const claim=page.getByRole('button',{name:'Claim',exact:true}).first();
  await expect(claim).toBeEnabled();
  await expect(claim).toHaveClass(/button--build/);
  await expect(claim).toHaveCSS('background-color','rgb(255, 217, 78)');
  await page.locator('.goal-chain-panel').screenshot({path:'../../.local/claim-ready-yellow.png'});
  await claim.click();
  await expect(page.getByLabel('Fixture requested action')).toHaveText('claim:solana:5000000');
  await page.goto('/tests/browser/harness.html?view=detail&phase=achieved&delivery-pending=1');
  await expect(page.getByRole('button',{name:'Waiting for chains'}).first()).toBeDisabled();
  await expect(page.getByRole('button',{name:'Claim',exact:true})).toHaveCount(0);
  await expect(page.getByText('Every selected vault must confirm completion before you can claim.').first()).toBeVisible();
  await expect(page.getByLabel('Fixture requested action')).toBeEmpty();
});

test('wallet balances reflow at 320, 768 and 1280px and offline reads never invent zero',async({page})=>{
  for(const width of [320,768,1280]) {
    await page.setViewportSize({width,height:900});
    await page.goto('/tests/browser/harness.html?page=wallets');
    await expect(page.getByText('2.000001 USDC',{exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page.getByText('<0.00000001 ETH',{exact:true})).toHaveAttribute('title','0.000000000000000001 ETH');
  }
  await page.goto('/tests/browser/harness.html?page=wallets&wallet-offline=1');
  await expect(page.getByText('You’re offline. Displayed balances are from the last verified read.',{exact:true})).toBeVisible();
  await expect(page.locator('.wallet-token-values dd')).toHaveText(Array(8).fill('—'));
  await expect(page.getByRole('button',{name:'Refresh balances',exact:true})).toBeDisabled();
});
