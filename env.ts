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
  /** Lets a trusted caller (e2e runner) bypass auth rate limits. Never expose to browsers. */
  AUTH_TRUSTED_KEY: string().optional(),
});
