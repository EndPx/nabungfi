import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5180",
    channel: process.env.PW_BROWSER_CHANNEL || undefined,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm exec vite --host 127.0.0.1 --port 5180 --strictPort",
    url: "http://127.0.0.1:5180/tests/browser/harness.html",
    reuseExistingServer: false,
    env: { VITE_DISABLE_REACT_DEVTOOLS: "1" },
  },
});
