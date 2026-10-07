import {test,expect} from "@playwright/test";

async function recordAudio(page: import("@playwright/test").Page) {
  await page.addInitScript(()=>{
    const Original=window.AudioContext;
    (window as any).buildAudio=[];
    window.AudioContext=class extends Original {
      createBufferSource(){
        const source=super.createBufferSource(),start=source.start.bind(source);
        source.start=(...args: Parameters<AudioBufferSourceNode["start"]>)=>{
          (window as any).buildAudio.push({duration:source.buffer?.duration,loop:source.loop});
          start(...args);
        };
        return source;
      }
    };
  });
}

test("a partial build plays the short cue without a goal hop",async({page})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});
  await recordAudio(page);
  await page.goto("/tests/browser/harness.html?view=detail&amount=250000&motion=on");
  await page.getByRole("button",{name:"Enable assembly sound",exact:true}).click();
  await page.getByRole("button",{name:"Replay build",exact:true}).click();
  await expect.poll(async()=>page.evaluate(()=>(window as any).buildAudio.filter((a:any)=>!a.loop).map((a:any)=>a.duration))).toEqual([0.64]);
  await expect(page.locator(".workshop")).toHaveAttribute("data-celebrating","false");
  await expect(page.locator(".car-stage")).toHaveAttribute("aria-label",/2 of 100/);
});

test("100-percent completion plays the full cue and hops only after assembly",async({page})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});
  await recordAudio(page);
  await page.goto("/tests/browser/harness.html?view=detail&phase=claimed&motion=on");
  await page.getByRole("button",{name:"Enable assembly sound",exact:true}).click();
  await page.getByRole("button",{name:"Replay build",exact:true}).click();
  await expect(page.locator(".workshop")).toHaveAttribute("data-celebrating","true",{timeout:14000});
  await expect(page.locator(".car-stage")).toHaveAttribute("aria-label",/100 of 100/);
  await expect.poll(async()=>page.evaluate(()=>(window as any).buildAudio.filter((a:any)=>!a.loop).map((a:any)=>a.duration))).toEqual([1.8]);
  await page.waitForTimeout(300);
  const airborne=await page.locator(".car-stage").screenshot();
  await expect(page.locator(".workshop")).toHaveAttribute("data-celebrating","false");
  const landed=await page.locator(".car-stage").screenshot();
  expect(airborne.equals(landed)).toBe(false);
  await expect(page.getByRole("button",{name:"Replay build",exact:true})).toBeEnabled();
});

test("reduced motion finishes silently when muted and never hops",async({page})=>{
  await recordAudio(page);
  await page.goto("/tests/browser/harness.html?view=detail&phase=claimed");
  await page.getByRole("button",{name:"Replay build",exact:true}).click();
  await expect(page.locator(".workshop")).toHaveAttribute("data-celebrating","false");
  expect(await page.evaluate(()=>(window as any).buildAudio)).toEqual([]);
  await expect(page.getByRole("button",{name:"Replay build",exact:true})).toBeEnabled();
});
