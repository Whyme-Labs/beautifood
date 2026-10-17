import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 5190);
const chromium = process.env.PW_CHROMIUM ?? (process.env.PLAYWRIGHT_BROWSERS_PATH ? undefined : undefined);

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }], ["json", { outputFile: "test-results/e2e.json" }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    extraHTTPHeaders: { "x-auth-trusted-key": process.env.AUTH_TRUSTED_KEY ?? "e2e-trusted" },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: chromium ? { executablePath: chromium } : {},
  },
  projects: [
    { name: "api", testMatch: /api\/.*\.spec\.ts/ },
    { name: "ui", testMatch: /ui\/.*\.spec\.ts/, use: { ...devices["Desktop Chrome"], launchOptions: chromium ? { executablePath: chromium } : {} } },
  ],
  webServer: {
    command: `PORT=${PORT} ./scripts/e2e-server.sh`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: !!process.env.E2E_REUSE,
    timeout: 240_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
