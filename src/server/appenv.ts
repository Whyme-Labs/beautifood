import { env } from "void/env";
import type { PipelineEnv } from "./pipeline";

/** Typed app configuration (declared in env.ts) shaped for the domain modules. */
export function appEnv(): PipelineEnv & { TOKEN_SECRET: string; APP_ENV: string; ANTHROPIC_API_KEY?: string; ANTHROPIC_MODEL: string } {
  // Customer links are signed with TOKEN_SECRET: refuse to run production on the dev default.
  if (env.APP_ENV === "production" && (env.TOKEN_SECRET.startsWith("dev-only") || env.TOKEN_SECRET.length < 32)) throw new Error("TOKEN_SECRET must be set to a strong secret in production");
  return {
    APP_ENV: env.APP_ENV,
    TOKEN_SECRET: env.TOKEN_SECRET,
    PUBLIC_URL: env.PUBLIC_URL,
    VAPID_PUBLIC_KEY: env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: env.VAPID_SUBJECT,
    ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL: env.ANTHROPIC_MODEL,
  };
}
