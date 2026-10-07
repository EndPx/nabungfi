import {test,expect} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("three new sculptures automatically build, rotate and reverse to zero before switching",async({page})=>{
  test.setTimeout(65000);
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.setViewportSize({width:1280,height:900});
  const appTraffic:string[]=[];
  page.on("request",request=>{
    if(new URL(request.url()).pathname.startsWith("/api/"))appTraffic.push(request.url());
  });
  await page.goto("/");
  const studio=page.locator(".landing-studio"),stage=page.locator(".landing-sculpture");
  await expect(studio).toHaveAttribute("data-ready","true");
  await expect(page.locator(".car-stage, .workshop")).toHaveCount(0);
  await expect(page.getByRole("button",{name:/Try a build|Try assembly|Explore 360/})).toHaveCount(0);
  await expect(page.getByRole("link",{name:/Try.*build/})).toHaveCount(0);
  for(const id of ["camera","scooter","sailboat"]){
    await expect(studio).toHaveAttribute("data-model",id,{timeout:13000});
    await expect(studio).toHaveAttribute("data-phase","complete",{timeout:13000});
    await expect(stage).toHaveAttribute("data-build","100");
    const full=await stage.screenshot();
    await page.waitForTimeout(500);
    expect((await stage.screenshot()).equals(full)).toBe(false);
    await expect(studio).toHaveAttribute("data-phase","reversing",{timeout:6000});
    await expect.poll(()=>stage.getAttribute("data-build")).not.toBe("100");
    await expect(studio).toHaveAttribute("data-phase","empty",{timeout:6000});
    await expect(stage).toHaveAttribute("data-build","0");
    expect((await stage.screenshot()).equals(full)).toBe(false);
  }
  expect(appTraffic).toEqual([]);
});

test("page motion pause freezes the studio and offscreen motion resumes from the same build",async({page})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.setViewportSize({width:1280,height:900});
  await page.goto("/");
  const studio=page.locator(".landing-studio"),stage=page.locator(".landing-sculpture");
  await expect(studio).toHaveAttribute("data-ready","true");
  await page.getByRole("button",{name:"Pause page motion"}).click();
  await expect(studio).toHaveAttribute("data-running","false");
  const frozen=await stage.getAttribute("data-build");
  const image=await stage.screenshot();
  await page.waitForTimeout(500);
  expect(await stage.getAttribute("data-build")).toBe(frozen);
  expect((await stage.screenshot()).equals(image)).toBe(true);
  await page.getByRole("button",{name:"Enable page motion"}).click();
  await expect(studio).toHaveAttribute("data-running","true");
  await expect.poll(()=>stage.getAttribute("data-build")).not.toBe(frozen);
  await page.getByRole("heading",{name:"A few things to know."}).scrollIntoViewIfNeeded();
  await expect(studio).toHaveAttribute("data-running","false");
  const offscreen=await stage.getAttribute("data-build");
  await page.waitForTimeout(500);
  expect(await stage.getAttribute("data-build")).toBe(offscreen);
  await page.getByRole("heading",{name:"Small saves. Big possibilities."}).scrollIntoViewIfNeeded();
  await expect(studio).toHaveAttribute("data-running","true");
});

test("reduced motion is complete and still, reflows at all widths and has no demo entry",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  for(const width of [320,390,768,1280]){
    await page.setViewportSize({width,height:900});
    await page.goto("/");
    await expect(page.locator(".landing-studio")).toHaveAttribute("data-phase","complete");
    await expect(page.locator(".landing-sculpture")).toHaveAttribute("data-build","100");
    await expect(page.locator(".landing-studio")).toHaveAttribute("data-running","false");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.getByRole("link",{name:"Start a goal",exact:true})).toHaveAttribute("href","/login");
  }
  for(const legacy of ["/?demo=1","/?legacy-demo=1","/demo"]){
    await page.goto(legacy);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading",{name:"Small saves. Big possibilities."})).toBeVisible();
    await expect(page.locator('a[href*="demo"]')).toHaveCount(0);
  }
});

test("guest navigation keeps sign-in, eligibility copy and accessible landing controls",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.setViewportSize({width:390,height:844});
  await page.goto("/app");
  await expect(page.getByRole("heading",{name:"Sign in to your workshop"})).toBeVisible();
  await page.getByRole("link",{name:"Back to NabungFi",exact:true}).click();
  await expect(page.locator('.landing-studio[data-ready="true"]')).toBeVisible();
  await page.locator("summary").filter({hasText:"Does building the model unlock my savings?"}).click();
  await expect(page.getByText(/Animation never changes your balances/)).toBeVisible();
  await page.locator("summary").filter({hasText:"What happens when I reach the target?"}).click();
  await expect(page.getByText(/A delayed chain stays pending/)).toBeVisible();
  const audit=await new AxeBuilder({page}).include(".landing").withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"]).analyze();
  expect(audit.violations).toEqual([]);
});
