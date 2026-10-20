// Scores real models on the guest cases (test/eval). Needs network and credentials, so it's
// separate from the unit tests: CF_ACCOUNT_ID + CF_API_TOKEN (Workers AI), EVAL_MODELS (comma list).
import { defineConfig } from "vitest/config";
export default defineConfig({
  define: { __MAIL_FROM__: JSON.stringify("") },
  test: { include: ["test/eval/**/*.eval.ts"], environment: "node", testTimeout: 1_800_000 },
});
