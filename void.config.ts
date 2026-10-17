import { defineConfig } from "void/config";

// MAIL_FROM (e.g. "Beautifood <receipts@mail.example.com>") turns on Cloudflare Email Sending:
// `void deploy --platform cloudflare` sets up Email Routing and Email Sending on its domain
// and binds SEND_EMAIL. Leave it unset to deploy without email.
const mailFrom = process.env.MAIL_FROM?.trim();

export default defineConfig({
  worker: {
    compatibility_date: "2026-09-01",
    compatibility_flags: ["nodejs_compat"],
  },
  ...(mailFrom ? { email: { from: mailFrom } } : {}),
  // End-to-end runs bind a local SEND_EMAIL so delivery goes through the real binding path
  // (miniflare accepts the message and stores the .eml) instead of the dev-inbox fallback.
  ...(process.env.E2E_SEND_EMAIL ? { cloudflare: { send_email: [{ name: "SEND_EMAIL" }] } } : {}),
});
