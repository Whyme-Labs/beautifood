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

export default defineConfig({
  worker: {
    compatibility_date: "2026-09-01",
    compatibility_flags: ["nodejs_compat"],
  },
  ...(mailFrom ? { email: { from: mailFrom } } : {}),
  cloudflare: {
    name: NAME,
    d1_databases: [{ binding: "DB", database_name: `${NAME}-db` }],
    // End-to-end runs bind a local SEND_EMAIL so delivery goes through the real binding path
    // (miniflare accepts the message and stores the .eml) instead of the dev-inbox fallback.
    ...(process.env.E2E_SEND_EMAIL ? { send_email: [{ name: "SEND_EMAIL" }] } : {}),
  },
});
