import { defineConfig } from "void/config";

// MAIL_FROM (e.g. "Beautifood <receipts@mail.example.com>") turns on Cloudflare Email Sending:
// `void deploy --platform cloudflare` sets up Email Routing and Email Sending on its domain
// and binds SEND_EMAIL. Leave it unset to deploy without email.
const mailFrom = process.env.MAIL_FROM?.trim();

// Explicit resource names: the Cloudflare account also hosts an older "beautifood" app
// (its own Worker and a "beautifood-db" database with live users), so nothing here may
// share its names. The D1 database is pinned below; the queue is named by its
// path (queues/beautifood-app/broadcasts.ts → "beautifood-app-broadcasts").
const NAME = "beautifood-app";

// Storefront hosts (src/shared/domains.ts), both opt-in at deploy time. STOREFRONT_DOMAIN (a zone
// on this account, with a proxied wildcard DNS record) routes <slug>.<domain> here. CUSTOM_DOMAINS_ZONE
// is the Cloudflare for SaaS zone whose custom hostnames (restaurants' own domains) this Worker serves.
const storefrontDomain = process.env.STOREFRONT_DOMAIN?.trim();
// APP_DOMAIN (e.g. app.beautifood.io) is the app's own address, a Workers Custom Domain:
// Cloudflare keeps its DNS record and certificate. Its zone must be on this account.
const appDomain = process.env.APP_DOMAIN?.trim();
const saasZone = process.env.CUSTOM_DOMAINS_ZONE?.trim();
const routes = [
  ...(appDomain ? [{ pattern: appDomain, custom_domain: true }] : []),
  ...(storefrontDomain ? [{ pattern: `*.${storefrontDomain}/*`, zone_name: storefrontDomain }] : []),
  ...(saasZone ? [{ pattern: "*/*", zone_name: saasZone }] : []),
];

export default defineConfig({
  worker: {
    compatibility_date: "2026-09-01",
    compatibility_flags: ["nodejs_compat"],
  },
  ...(mailFrom ? { email: { from: mailFrom } } : {}),
  // Workers AI is bound explicitly below for deploys only (it has no local simulator).
  inference: { bindings: { ai: false } },
  head: {
    title: "Beautifood: queue, order and book with no app",
    meta: [
      { charset: "utf-8" },
      // Without this, phones lay pages out at 980px and shrink everything to fit.
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "description", content: "Walk-in queues, shared table ordering, POS, kitchen display and bookings for hawker stalls and restaurants, in English and 中文. No app to download." },
      { name: "theme-color", content: "#ffd12e" },
      { property: "og:title", content: "Beautifood" },
      { property: "og:description", content: "Queue, order and book at hawker stalls and restaurants with no app." },
      { property: "og:image", content: "/icon-512.png" },
    ],
    link: [
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  },
  cloudflare: {
    name: NAME,
    // Declared so deploys never have to guess the Worker's public surface:
    // served on <name>.<subdomain>.workers.dev and the routes above (the app's domain, storefront hosts), no per-version preview URLs.
    workers_dev: true,
    preview_urls: false,
    routes,
    d1_databases: [{ binding: "DB", database_name: `${NAME}-db` }],
    // Workers AI for menu translation in production (no local simulator, so not in dev/tests).
    ...(process.env.BEAUTIFOOD_WORKERS_AI ? { ai: { binding: "AI" } } : {}),
    // Cloudflare Email Sending. Deploys (MAIL_FROM set, sending domain onboarded in the
    // dashboard) bind it for real; end-to-end runs bind a local one so delivery goes through
    // the real binding path (miniflare stores the .eml) instead of the dev-inbox fallback.
    ...(mailFrom || process.env.E2E_SEND_EMAIL ? { send_email: [{ name: "SEND_EMAIL" }] } : {}),
  },
});
