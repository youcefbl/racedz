import { defineConfig } from "@playwright/test";

const baseURL = process.env.RACEDZ_BASE_URL ?? "http://127.0.0.1:3003";
const useExternalServer = process.env.RACEDZ_EXTERNAL_SERVER === "1";

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  expect: { timeout: 45_000 },
  fullyParallel: false,
  reporter: [["line"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROME_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH }
      : undefined
  },
  // Browser tests boot the canonical local app automatically. Set
  // RACEDZ_EXTERNAL_SERVER=1 when RACEDZ_BASE_URL points at a deployed server.
  webServer: useExternalServer
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
        stdout: "ignore",
        stderr: "pipe"
      }
});
