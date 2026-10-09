import {test,expect} from '@playwright/test';

for(const width of [320,390,768,1280]) test(`original hash is available for copy, explorer and full disclosure at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async(hash:string)=>{document.documentElement.dataset.copiedHash=hash;}}}));
 await page.goto('/tests/browser/harness.html?view=recovery');
 const hash='0x'+'3'.repeat(64);
 const link=page.getByRole('link',{name:'View original transaction on Base Sepolia'});
 await expect(link).toHaveAttribute('href','https://sepolia.basescan.org/tx/'+hash);
 await page.getByRole('button',{name:'Copy transaction hash',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-copied-hash',hash);
 await page.getByText('Full transaction hash',{exact:true}).click();
 await expect(page.locator('details code.address')).toHaveText(hash);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('already-started wallet request has recovery action and no expiry or re-sign instruction',async({page})=>{
 await page.goto('/tests/browser/harness.html?view=wallet&wallet-handoff=1&attempted=1&sponsored=1');
 const dialog=page.getByRole('dialog');
 await expect(dialog.getByText(/Wallet confirmation already started/)).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Confirm in wallet'})).toHaveCount(0);
 await expect(dialog.getByRole('button',{name:'Refresh unsigned plan'})).toHaveCount(0);
 await dialog.getByRole('button',{name:'View recovery options'}).click();
 await expect(dialog).toHaveCount(0);
});

test('expired unsigned plan retains explicit refresh and cannot open wallet',async({page})=>{
 await page.goto('/tests/browser/harness.html?view=wallet');
 const dialog=page.getByRole('dialog');
 await expect(dialog.getByText(/This unsigned plan expired/)).toBeVisible({timeout:10000});
 await expect(dialog.getByRole('button',{name:'Confirm in wallet'})).toBeDisabled();
 await expect(dialog.getByRole('button',{name:'Refresh unsigned plan'})).toBeEnabled();
});
