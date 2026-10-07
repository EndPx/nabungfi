// Original sculpture exports from the isolated local renderer. Requires Python + Pillow.
import {chromium} from "@playwright/test";
import {mkdir} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
const base=process.argv[2] ?? "http://127.0.0.1:5190";
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw new Error("Use an isolated local Vite server.");
const output=new URL("../public/illustrations/",import.meta.url),source=new URL("../../../.local/landing-artwork/",import.meta.url);
await mkdir(output,{recursive:true});await mkdir(source,{recursive:true});
const browser=await chromium.launch({channel:process.env.PW_BROWSER_CHANNEL ?? "chrome",headless:true});
try {
  const page=await browser.newPage({viewport:{width:800,height:800},deviceScaleFactor:1,reducedMotion:"reduce"});
  for(const model of ["camera","scooter","sailboat"]){
    await page.goto(`${base}/tests/browser/landing-posters.html?model=${model}`);
    await page.locator('.landing-sculpture[data-ready="true"]').waitFor({timeout:20000});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const png=fileURLToPath(new URL(`${model}.png`,source)),webp=fileURLToPath(new URL(`landing-${model}.webp`,output));
    await page.locator(".landing-sculpture").screenshot({path:png,omitBackground:true});
    const converted=spawnSync("python",["-c","from PIL import Image; import sys; Image.open(sys.argv[1]).save(sys.argv[2], 'WEBP', quality=90)",png,webp],{encoding:"utf8"});
    if(converted.status!==0)throw new Error(converted.stderr || "Artwork conversion failed");
    process.stdout.write(`Exported original ${model} sculpture\n`);
  }
} finally {await browser.close();}
