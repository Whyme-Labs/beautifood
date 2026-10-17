import { defineConfig } from "void/config";
import { MAIL_FROM } from "./src/shared/mail";

export default defineConfig({
  worker: {
    compatibility_date: "2026-09-01",
    compatibility_flags: ["nodejs_compat"],
  },
  // Cloudflare Email Sending: `void deploy --platform cloudflare` sets up Email Routing and
  // Email Sending on this sender's domain and binds SEND_EMAIL.
  email: { from: `${MAIL_FROM.name} <${MAIL_FROM.email}>` },
  // End-to-end runs bind a local SEND_EMAIL so delivery goes through the real binding path
  // (miniflare accepts the message and stores the .eml) instead of the dev-inbox fallback.
  ...(process.env.E2E_SEND_EMAIL ? { cloudflare: { send_email: [{ name: "SEND_EMAIL" }] } } : {}),
});
