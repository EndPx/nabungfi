import {test,expect} from '@playwright/test';

for(const width of [320,1280]) test(`sponsored review keeps owner confirmation and exact amount at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.goto('/tests/browser/harness.html?view=wallet&wallet-handoff=1&sponsored=1');
 const dialog=page.getByRole('dialog');
 await expect(dialog.getByText('Sponsored by NabungFi',{exact:true})).toBeVisible();
 await expect(dialog.getByText('1.00 USDC',{exact:true})).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Confirm in wallet'})).toBeEnabled();
 await expect(dialog.getByText(/your wallet still asks for confirmation/)).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
