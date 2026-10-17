// Better Auth customization: keep the default per-IP limits, but let a trusted
// caller (the end-to-end test runner) bypass them with a secret header.
import { defineAuth } from "void/auth";

export default defineAuth(({ defaults, env }) => {
  const trusted = (env as { AUTH_TRUSTED_KEY?: string }).AUTH_TRUSTED_KEY;
  return {
    ...defaults,
    rateLimit: {
      ...defaults.rateLimit,
      customRules: {
        "/**": (request, rule) => (trusted && request.headers.get("x-auth-trusted-key") === trusted ? false : rule),
      },
    },
  };
});
