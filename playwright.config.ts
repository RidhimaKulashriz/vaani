import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

const chromium = existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    ...(chromium ? { launchOptions: { executablePath: chromium, args: ["--no-sandbox"] } } : {}),
  },
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:3000/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
