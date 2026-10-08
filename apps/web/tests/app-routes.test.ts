import { test } from "node:test";
import assert from "node:assert/strict";
import { appHref, isAppRoute, readAppRoute } from "../src/app-routes.ts";

test("marketing anchors never open the account shell", () => {
  for (const fragment of ["", "#how-it-works", "#questions", "#main-content"])
    assert.equal(
      isAppRoute(new URL(`https://example.test/${fragment}`)),
      false,
    );
});
test("named app pages and the installed entry preserve their destinations", () => {
  for (const destination of [
    "goals",
    "activity",
    "wallets",
    "faucets",
    "settings",
  ] as const) {
    const url = new URL(`https://example.test/app/${destination}`);
    assert.equal(isAppRoute(url), true);
    assert.deepEqual(readAppRoute(url), { destination, goalId: null });
  }
  assert.deepEqual(
    readAppRoute(new URL("https://example.test/app?source=pwa")),
    { destination: "goals", goalId: null },
  );
});
test("legacy goal links retain the original selected goal", () => {
  for (const path of [
    "/#goals?goal=car-123",
    "/app#goals?goal=car-123",
    "/app/goals?goal=car-123",
  ])
    assert.deepEqual(readAppRoute(new URL(`https://example.test${path}`)), {
      destination: "goals",
      goalId: "car-123",
    });
  assert.deepEqual(readAppRoute(new URL("https://example.test/app#activity")), {
    destination: "activity",
    goalId: null,
  });
});
test("only the goal page carries a goal selection; path wins over a stale hash", () => {
  assert.deepEqual(
    readAppRoute(new URL("https://example.test/app/wallets?goal=car#activity")),
    { destination: "wallets", goalId: null },
  );
  assert.deepEqual(
    readAppRoute(
      new URL("https://example.test/app/goals?goal=laptop#goals?goal=car"),
    ),
    { destination: "goals", goalId: "laptop" },
  );
});
test("goal links encode the entire identity without introducing another route or parameter", () => {
  const id = "goal / + & # rumah";
  const url = new URL(appHref("goals", id), "https://example.test");
  assert.equal(url.pathname, "/app/goals");
  assert.equal(url.searchParams.size, 1);
  assert.equal(readAppRoute(url).goalId, id);
  assert.equal(appHref("settings", id), "/app/settings");
});
test("history destinations retain the selected goal and persist the activity anchor",()=>{
 const href=appHref("goals","house",true);
 assert.equal(href,"/app/goals?goal=house#goal-activity");
 assert.deepEqual(readAppRoute(new URL(href,"https://example.test")),{destination:"goals",goalId:"house"});
});
