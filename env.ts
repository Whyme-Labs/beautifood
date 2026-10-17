import { defineEnv, oneOf, string } from "void/env";

export default defineEnv({
  APP_ENV: oneOf(["development", "test", "production"]).default("development"),
  /** HMAC key for stateless customer tokens (tickets, dynamic QR, carts, members). */
  TOKEN_SECRET: string().default("dev-only-token-secret-change-me-in-production"),
  PUBLIC_URL: string().default("http://localhost:5173"),
  ANTHROPIC_API_KEY: string().optional(),
  ANTHROPIC_MODEL: string().default("claude-sonnet-5-5"),
  RESEND_API_KEY: string().optional(),
  EMAIL_FROM: string().default("Beautifood <receipts@beautifood.app>"),
  VAPID_PUBLIC_KEY: string().optional(),
  VAPID_PRIVATE_KEY: string().optional(),
  VAPID_SUBJECT: string().default("mailto:ops@beautifood.app"),
});
