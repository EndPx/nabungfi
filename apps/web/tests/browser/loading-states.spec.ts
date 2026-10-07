import {test,expect} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("the app module shows a splash until ready, then opens sign-in with the goal return target",async({page})=>{
  let release!:()=>void;
  const hold=new Promise<void>(resolve=>{release=resolve;});
  await page.route("**/src/LiveApp.tsx",async route=>{await hold;await route.continue();});
  await page.goto("/app/goals?goal=car",{waitUntil:"domcontentloaded"});
  await expect(page.locator(".app-splash")).toBeVisible();
  await expect(page.getByRole("heading",{name:"Opening NabungFi…"})).toBeVisible();
  await expect(page.getByRole("navigation",{name:"Main navigation"})).toHaveCount(0);
  release();
  await expect(page.getByRole("heading",{name:"Sign in to your workshop"})).toBeVisible({timeout:20000});
  await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fgoals%3Fgoal%3Dcar$/);
});

test("authenticated startup waits for backend identity and first goal reads before the workspace",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/tests/browser/auth.html?boot&slow-goals&next=%2Fapp%2Fgoals%3Fgoal%3Dcar");
  await expect(page.locator(".app-splash")).toBeVisible();
  await page.getByRole("button",{name:"Finish example app initialization"}).click();
  await page.getByRole("button",{name:"Continue with Google",exact:true}).click();
  await page.getByRole("button",{name:"Complete example Google sign-in"}).click();
  await expect(page.locator(".app-splash")).toBeVisible();
  await page.getByRole("button",{name:"Return mismatched example session"}).click();
  await expect(page.getByRole("navigation",{name:"Main navigation"})).toHaveCount(0);
  await page.getByRole("button",{name:"Verify matching example session"}).click();
  await expect(page.locator(".app-splash")).toBeVisible();
  await expect(page.getByRole("navigation",{name:"Main navigation"})).toHaveCount(0);
  await page.getByRole("button",{name:"Finish example goal reading"}).click();
  await expect(page.getByRole("heading",{name:"Example verified workspace"})).toBeVisible();
  await expect(page.getByTestId("return-target")).toHaveText("/app/goals?goal=car");
});

test("a first goal read shows loading, success reveals setup, and a real failure remains unavailable",async({page})=>{
  await page.goto("/tests/browser/harness.html?view=detail&waiting-read");
  await expect(page.getByRole("heading",{name:"Loading your goal…"})).toBeVisible();
  await expect(page.getByText("Read unavailable",{exact:true})).toHaveCount(0);
  await expect(page.locator(".goal-financial-summary, .car-stage")).toHaveCount(0);
  await page.getByRole("button",{name:"Complete example goal read"}).click();
  await expect(page.getByRole("heading",{name:"Loading your goal…"})).toHaveCount(0);
  await expect(page.locator(".goal-financial-summary")).toBeVisible();
  await expect(page.getByRole("button",{name:"Initialize Solana goal",exact:true})).toBeEnabled();
  await page.goto("/tests/browser/harness.html?view=detail&waiting-read");
  await page.getByRole("button",{name:"Fail example goal read"}).click();
  await expect(page.getByText("Read unavailable",{exact:true}).first()).toBeVisible();
  await expect(page.getByRole("button",{name:"Refresh balance",exact:true})).toBeEnabled();
  await expect(page.getByRole("button",{name:/Deposit|Claim savings|Create .* vault|Initialize Solana goal/})).toHaveCount(0);
});

test("creation replaces fields with loading and does not show unavailable balances while reading",async({page})=>{
  await page.goto("/tests/browser/harness.html?slow-create&creating-read");
  await page.getByRole("button",{name:"New goal",exact:true}).click();
  await page.getByLabel("Goal name",{exact:true}).fill("My Save");
  await page.getByLabel("Target in USDC").fill("10000");
  await page.getByRole("checkbox",{name:/I understand deposits stay locked/}).check();
  await page.getByRole("button",{name:"Create goal",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Creating your goal…",exact:true})).toBeVisible();
  await expect(page.getByLabel("Goal name",{exact:true})).toHaveCount(0);
  await expect(page.getByTestId("example-create-count")).toHaveText("1");
  await expect(page.getByRole("dialog")).toHaveCount(0,{timeout:5000});
  await expect(page.getByRole("heading",{name:"Creating your goal…",exact:true})).toBeVisible();
  await expect(page.getByText("Read unavailable",{exact:true})).toHaveCount(0);
  await expect(page.locator(".goal-financial-summary")).toHaveCount(0);
  await page.getByRole("button",{name:"Complete example goal read"}).click();
  await expect(page.getByRole("heading",{name:"My Save",exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Creating your goal…",exact:true})).toHaveCount(0);
});

test("splash and goal loaders reflow accessibly without transform motion when reduced",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  for(const width of [320,390,768,1280]){
    await page.setViewportSize({width,height:900});
    await page.goto("/tests/browser/auth.html?boot");
    await expect(page.locator(".app-splash")).toBeVisible();
    expect(await page.locator(".loading-mark rect").first().evaluate(element=>getComputedStyle(element).animationName)).toBe("none");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  const audit=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
  expect(audit.violations).toEqual([]);
});
