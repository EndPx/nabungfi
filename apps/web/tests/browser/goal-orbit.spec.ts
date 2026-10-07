import { test, expect } from "@playwright/test";

test("all goal models expose their underside and restore the studio on reset",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.setViewportSize({width:375,height:900});
  await page.goto("/");
  await page.getByRole("button",{name:"Explore 360°",exact:true}).click();
  for(const model of ["A new car","A better laptop","A home"]) {
    await page.getByRole("button",{name:model,exact:true}).click();
    const stage=page.locator(".car-stage");
    await expect(stage).toHaveAttribute("aria-label",/100 of 100/);
    const before=await stage.screenshot();
    for(let i=0;i<5;i++) await page.getByRole("button",{name:"Tilt build down",exact:true}).click();
    await expect(page.locator(".workshop")).toHaveAttribute("data-view","underside");
    expect((await stage.screenshot()).equals(before)).toBe(false);
    await expect(stage).toHaveAttribute("aria-label",/100 of 100/);
    await page.getByRole("button",{name:"Reset build view",exact:true}).click();
    await expect(page.locator(".workshop")).toHaveAttribute("data-view","studio");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
});

test("free rotation accepts vertical drag and Escape restores page scrolling",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.setViewportSize({width:375,height:900});
  await page.goto("/tests/browser/harness.html?view=detail&phase=claimed");
  const stage=page.locator(".car-stage");
  await page.getByRole("button",{name:"Rotate freely",exact:true}).click();
  expect(await page.locator("canvas").evaluate(c=>getComputedStyle(c).touchAction)).toBe("none");
  const box=(await page.locator("canvas").boundingBox())!;
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2+70);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2-70,{steps:12});
  await page.mouse.up();
  await expect(page.locator(".workshop")).toHaveAttribute("data-view","underside");
  await stage.focus();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button",{name:"Rotate freely",exact:true})).toHaveAttribute("aria-pressed","false");
  expect(await page.locator("canvas").evaluate(c=>getComputedStyle(c).touchAction)).toBe("pan-y");
  await page.keyboard.press("Home");
  await expect(page.locator(".workshop")).toHaveAttribute("data-view","studio");
  for(let i=0;i<5;i++) await page.keyboard.press("ArrowDown");
  await expect(page.locator(".workshop")).toHaveAttribute("data-view","underside");
});

test("360 exploration loads a complete model and a full turn changes the view", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() =>
    localStorage.setItem("nabungfi:built:landing-preview:car", "7"),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Explore 360°" }).click();
  await expect(
    page.getByRole("button", { name: "Try assembly" }),
  ).toBeEnabled();
  const stage = page.locator(".car-stage");
  await expect(stage).toHaveAttribute("aria-label", /100 of 100/);
  const before = await stage.screenshot();
  await page.getByRole("button", { name: "Rotate 360°", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Stop rotation" }),
  ).toBeVisible();
  await page.waitForTimeout(1200);
  const during = await stage.screenshot();
  expect(during.equals(before)).toBe(false);
  await expect(
    page.getByRole("button", { name: "Rotate 360°", exact: true }),
  ).toBeVisible({timeout:12000});
  await expect(page.locator(".workshop")).toHaveAttribute(
    "data-spinning",
    "false",
  );
  await expect(stage).toHaveAttribute("aria-label", /100 of 100/);
});

test("drag, arrow and reset interrupt the automatic turn", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore 360°" }).click();
  await page.getByRole("button", { name: "Rotate 360°", exact: true }).click();
  await page.getByRole("button", { name: "Rotate build right" }).click();
  await expect(page.locator(".workshop")).toHaveAttribute(
    "data-spinning",
    "false",
  );
  await page.getByRole("button", { name: "Rotate 360°", exact: true }).click();
  await page.locator("canvas").scrollIntoViewIfNeeded();
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("The goal canvas did not render");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(page.locator(".workshop")).toHaveAttribute(
    "data-spinning",
    "false",
  );
  await page.getByRole("button", { name: "Rotate 360°", exact: true }).click();
  await page.getByRole("button", { name: "Reset build view" }).click();
  await expect(page.locator(".workshop")).toHaveAttribute(
    "data-spinning",
    "false",
  );
});

test("all goal models keep manual orbit and mobile reflow in reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore 360°" }).click();
  for (const model of ["A new car", "A better laptop", "A home"]) {
    await page.getByRole("button", { name: model, exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Rotate 360°", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Rotate build left" }).click();
    await page.getByRole("button", { name: "Reset build view" }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator(".car-stage")).toHaveAttribute(
      "aria-label",
      /100 of 100/,
    );
  }
});
