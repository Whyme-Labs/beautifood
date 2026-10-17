/**
 * The sender for outgoing mail (Cloudflare Email Sending), from the MAIL_FROM build
 * variable, e.g. `Beautifood <receipts@mail.example.com>`. `void deploy` sets up Email
 * Routing and Email Sending on that address's domain. Unset means email is not
 * configured: messages are still recorded (and visible in the console's outbox) but not sent.
 * Each restaurant's own name is used as the display name.
 */
declare const __MAIL_FROM__: string;

export function parseSender(raw: string): { name: string; email: string } | null {
  const m = raw.trim().match(/^(?:"?([^"<]*?)"?\s*<([^<>\s]+@[^<>\s]+)>|([^<>\s]+@[^<>\s]+))$/);
  if (!m) return null;
  return { name: (m[1] ?? "").trim() || "Beautifood", email: (m[2] ?? m[3]).toLowerCase() };
}

export const MAIL_FROM = typeof __MAIL_FROM__ === "string" ? parseSender(__MAIL_FROM__) : null;
