import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  expect: { timeout: 45_000 },
  fullyParallel: false,
  reporter: [["line"]],
  use: {
    baseURL: process.env.RACEDZ_BASE_URL ?? "http://127.0.0.1:3003",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROME_PATH ?? "/usr/bin/google-chrome"
    }
  }
});
