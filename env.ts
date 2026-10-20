import { defineEnv, oneOf, string } from "void/env";

export default defineEnv({
  /** Production unless a local `.env` says otherwise (see .env.example), so a deploy can never expose dev tools. */
  APP_ENV: oneOf(["development", "test", "production"]).default("production"),
  /** HMAC key for stateless customer tokens (tickets, dynamic QR, carts, members). Derived from BETTER_AUTH_SECRET when unset. */
  TOKEN_SECRET: string().optional(),
  PUBLIC_URL: string().default("http://localhost:5173"),
  ANTHROPIC_API_KEY: string().optional(),
  ANTHROPIC_MODEL: string().default("claude-opus-5-5"),
  VAPID_PUBLIC_KEY: string().optional(),
  VAPID_PRIVATE_KEY: string().optional(),
  VAPID_SUBJECT: string().default("mailto:ops@beautifood.app"),
  /** Better Auth session secret (Void creates it on deploy; set locally for production previews). */
  BETTER_AUTH_SECRET: string().optional(),
  /** Restaurants' storefronts on <slug>.<this> (e.g. "beautifood.store"). Needs a wildcard DNS record and route to this Worker. */
  STOREFRONT_DOMAIN: string().optional(),
  /** Custom domains (Cloudflare for SaaS): the zone holding the fallback origin, an API token with SSL and Certificates: Edit, and the CNAME target restaurants point at. */
  CUSTOM_DOMAINS_ZONE_ID: string().optional(),
  CUSTOM_DOMAINS_API_TOKEN: string().optional(),
  CUSTOM_DOMAIN_TARGET: string().optional(),
  /** The guest assistant's model for what the rules engine can't answer: workers-ai | anthropic | openai | off. */
  ASSISTANT_PROVIDER: string().optional(),
  /** e.g. @cf/google/gemma-4-26b-a4b-it, claude-haiku-5-5, deepseek-chat */
  ASSISTANT_MODEL: string().optional(),
  /** For "openai": any OpenAI-style chat API (DeepSeek, OpenRouter...). */
  ASSISTANT_BASE_URL: string().optional(),
  ASSISTANT_API_KEY: string().optional(),
  /** US dollars per million tokens "in,out", for a model the price list doesn't know. */
  ASSISTANT_PRICE: string().optional(),
  /** Model answers per branch per day for guests (default 100), and the platform's monthly AI budget in US dollars (default 20). */
  ASSISTANT_DAILY_PER_BRANCH: string().optional(),
  AI_MONTHLY_BUDGET_USD: string().optional(),
  /** Lets a trusted caller (e2e runner) bypass auth rate limits. Never expose to browsers. */
  AUTH_TRUSTED_KEY: string().optional(),
});
