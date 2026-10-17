import { defineEnv, oneOf, string } from "void/env";

export default defineEnv({
  APP_ENV: oneOf(["development", "test", "production"]).default("development"),
  /** HMAC key for stateless customer tokens (tickets, dynamic QR, carts, members). */
  TOKEN_SECRET: string().default("dev-only-token-secret-change-me-in-production"),
  PUBLIC_URL: string().default("http://localhost:5173"),
  ANTHROPIC_API_KEY: string().optional(),
  ANTHROPIC_MODEL: string().default("claude-opus-5-5"),
  RESEND_API_KEY: string().optional(),
  EMAIL_FROM: string().default("Beautifood <receipts@beautifood.app>"),
  VAPID_PUBLIC_KEY: string().optional(),
  VAPID_PRIVATE_KEY: string().optional(),
  VAPID_SUBJECT: string().default("mailto:ops@beautifood.app"),
  /** Better Auth session secret (Void creates it on deploy; set locally for production previews). */
  BETTER_AUTH_SECRET: string().optional(),
  /** Lets a trusted caller (e2e runner) bypass auth rate limits. Never expose to browsers. */
  AUTH_TRUSTED_KEY: string().optional(),
});
