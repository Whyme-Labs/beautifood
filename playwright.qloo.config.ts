// Records the Qloo demo footage from the live app (no local server): real Qloo answers for Kuala
// Lumpur, through the judge account. The footage stays out of the repository (Qloo's data):
//   E2E_BASE=https://app.beautifood.io JUDGE_EMAIL=… JUDGE_PASSWORD=… pnpm exec playwright test -c playwright.qloo.config.ts
// then scripts/qloo-footage.sh converts it into video/public/qloo/ (git-ignored).
import { defineConfig } from "@playwright/test";

const chromium = process.env.PW_CHROMIUM;

export default defineConfig({
  testDir: "./e2e/qloo",
  outputDir: "./test-results/qloo",
  workers: 1,
  retries: 0,
  timeout: 600_000,
  expect: { timeout: 30_000 },
  reporter: "list",
  use: {
    actionTimeout: 30_000,
    launchOptions: { slowMo: 250, ...(chromium ? { executablePath: chromium } : {}) },
  },
});
