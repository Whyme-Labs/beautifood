import { env } from "void/env";
import type { PipelineEnv } from "./pipeline";

/** The guest assistant's model and limits (see env.ts). */
export interface AssistantSettings {
  ASSISTANT_PROVIDER?: string;
  ASSISTANT_MODEL?: string;
  ASSISTANT_BASE_URL?: string;
  ASSISTANT_API_KEY?: string;
  ASSISTANT_PRICE?: string;
  ASSISTANT_DAILY_PER_BRANCH?: string;
  AI_MONTHLY_BUDGET_USD?: string;
  AI_DAILY_BUDGET_USD?: string;
}

const DEV_TOKEN_SECRET = "dev-only-token-secret-not-for-production";

/**
 * The key that signs customer links. An explicit TOKEN_SECRET wins; otherwise it is
 * derived from BETTER_AUTH_SECRET (which Void creates on deploy), so production needs
 * no extra secret. Production refuses to start with neither.
 */
function tokenSecret(): string {
  if (env.TOKEN_SECRET) {
    if (env.APP_ENV === "production" && env.TOKEN_SECRET.length < 32) throw new Error("TOKEN_SECRET must be at least 32 characters in production");
    return env.TOKEN_SECRET;
  }
  if (env.BETTER_AUTH_SECRET && env.BETTER_AUTH_SECRET.length >= 32) return `beautifood-customer-tokens:${env.BETTER_AUTH_SECRET}`;
  if (env.APP_ENV === "production") throw new Error("Set TOKEN_SECRET or BETTER_AUTH_SECRET (32+ characters) in production");
  return DEV_TOKEN_SECRET;
}

/** Typed app configuration (declared in env.ts) shaped for the domain modules. */
export function appEnv(): PipelineEnv & { TOKEN_SECRET: string; APP_ENV: string; ANTHROPIC_API_KEY?: string; ANTHROPIC_MODEL: string } & AssistantSettings {
  return {
    APP_ENV: env.APP_ENV,
    TOKEN_SECRET: tokenSecret(),
    PUBLIC_URL: env.PUBLIC_URL,
    VAPID_PUBLIC_KEY: env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: env.VAPID_SUBJECT,
    ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL: env.ANTHROPIC_MODEL,
    ASSISTANT_PROVIDER: env.ASSISTANT_PROVIDER,
    ASSISTANT_MODEL: env.ASSISTANT_MODEL,
    ASSISTANT_BASE_URL: env.ASSISTANT_BASE_URL,
    ASSISTANT_API_KEY: env.ASSISTANT_API_KEY,
    ASSISTANT_PRICE: env.ASSISTANT_PRICE,
    ASSISTANT_DAILY_PER_BRANCH: env.ASSISTANT_DAILY_PER_BRANCH,
    AI_MONTHLY_BUDGET_USD: env.AI_MONTHLY_BUDGET_USD,
    AI_DAILY_BUDGET_USD: env.AI_DAILY_BUDGET_USD,
  };
}
