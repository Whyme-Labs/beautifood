// Outgoing email through Cloudflare Email Sending (Void's `sendEmail` over the SEND_EMAIL
// binding), plus e-receipt rendering. Every message is recorded first (once per
// kind/ref/recipient), then delivered; delivery never throws, so a mail outage can't
// stall the event pipeline. Failed sends are retried by the cron with backoff.
import { sendEmail as deliverEmail, type SendEmailError, type SendEmailResult } from "void/email";
import { MAIL_FROM } from "../../shared/mail";
import { newId } from "../ids";

export interface EmailInput {
  tenantId?: string | null;
  /** Display name for the sender, e.g. the restaurant's name. */
  fromName?: string | null;
  to: string;
  subject: string;
  html: string;
  text: string;
  kind: string;
  ref: string;
  headers?: Record<string, string>;
}

export interface MailEnv {
  APP_ENV?: string;
}

export type EmailStatus = "queued" | "sent" | "logged" | "unconfigured" | "failed" | "rejected" | "unknown";

/** After this many attempts (or a day), a failed email is left for a human to look at. */
export const MAX_EMAIL_ATTEMPTS = 5;

interface EmailRow {
  id: string;
  to_email: string;
  subject: string;
  html: string;
  text: string;
  headers: string | null;
  from_name: string | null;
  attempts: number;
}

/** Record, then deliver. Returns `duplicate` when this (kind, ref, recipient) was already handled. */
export async function sendEmail(db: D1Database, env: MailEnv, e: EmailInput): Promise<{ id: string; status: EmailStatus | "duplicate"; duplicate?: boolean }> {
  const id = newId("em_");
  const ins = await db
    .prepare(
      "INSERT OR IGNORE INTO emails (id, tenant_id, to_email, subject, html, text, headers, from_name, kind, ref, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?)",
    )
    .bind(id, e.tenantId ?? null, e.to.toLowerCase(), e.subject, e.html, e.text, e.headers ? JSON.stringify(e.headers) : null, e.fromName ?? null, e.kind, e.ref, Date.now())
    .run();
  if (!ins.meta.changes) return { id: "", status: "duplicate", duplicate: true };
  const status = await deliver(db, env, { id, to_email: e.to.toLowerCase(), subject: e.subject, html: e.html, text: e.text, headers: e.headers ? JSON.stringify(e.headers) : null, from_name: e.fromName ?? null, attempts: 0 });
  return { id, status };
}

/** Retry failed sends with exponential backoff (1, 2, 4, 8 minutes), for up to a day. */
export async function retryFailedEmails(db: D1Database, env: MailEnv, limit = 50): Promise<number> {
  const now = Date.now();
  const rows = (
    await db
      .prepare(
        `SELECT id, to_email, subject, html, text, headers, from_name, attempts FROM emails
         WHERE status = 'failed' AND attempts < ? AND created_at > ? AND last_attempt_at < ? - (60000 << (attempts - 1))
         ORDER BY last_attempt_at LIMIT ?`,
      )
      .bind(MAX_EMAIL_ATTEMPTS, now - 86_400_000, now, limit)
      .all<EmailRow>()
  ).results;
  for (const r of rows) await deliver(db, env, r);
  return rows.length;
}

/** Characters that would break or spoof a From header display name. */
const displayName = (n: string, fallback: string) => n.replace(/[\r\n<>"\\]/g, "").trim().slice(0, 60) || fallback;

async function deliver(db: D1Database, env: MailEnv, r: EmailRow): Promise<EmailStatus> {
  const at = Date.now();
  // Claim the attempt first, so two overlapping retries never send the same row twice.
  const claim = await db
    .prepare("UPDATE emails SET status = 'queued', attempts = attempts + 1, last_attempt_at = ? WHERE id = ? AND attempts = ? AND status IN ('queued', 'failed')")
    .bind(at, r.id, r.attempts)
    .run();
  if (!claim.meta.changes) return "queued";
  if (!MAIL_FROM) {
    // No sender configured: keep the record (dev inbox / console outbox), don't retry.
    const status: EmailStatus = env.APP_ENV === "production" ? "unconfigured" : "logged";
    await db.prepare("UPDATE emails SET status = ?, sent_at = ? WHERE id = ?").bind(status, Date.now(), r.id).run();
    return status;
  }
  let result: SendEmailResult;
  try {
    result = await deliverEmail({
      from: { email: MAIL_FROM.email, name: displayName(r.from_name ?? "", MAIL_FROM.name) },
      to: r.to_email,
      subject: r.subject,
      html: r.html,
      text: r.text,
      headers: r.headers ? (JSON.parse(r.headers) as Record<string, string>) : undefined,
    });
  } catch (err) {
    result = { ok: false, error: { code: "UPSTREAM_ERROR", message: String(err) } };
  }
  const outcome = classify(result, env);
  await db
    .prepare("UPDATE emails SET status = ?, error = ?, message_id = COALESCE(?, message_id), sent_at = CASE WHEN ? IN ('sent', 'logged') THEN ? ELSE sent_at END WHERE id = ?")
    .bind(outcome.status, outcome.error, outcome.messageId, outcome.status, Date.now(), r.id)
    .run();
  if (outcome.status === "failed" || outcome.status === "unknown") console.warn("email", r.id, outcome.status, outcome.error);
  return outcome.status;
}

/** Map Void/Cloudflare send results onto our statuses. Exported for unit tests. */
export function classify(result: SendEmailResult, env: MailEnv): { status: EmailStatus; error: string | null; messageId: string | null } {
  if (result.ok) return { status: "sent", error: null, messageId: result.ids[0]?.messageId ?? null };
  const e: SendEmailError | undefined = "error" in result ? result.error : result.deliveries.find((d) => !d.ok && "error" in d)?.error;
  const code = e?.code ?? "UPSTREAM_ERROR";
  const error = `${code}: ${e?.message ?? "send failed"}`.slice(0, 300);
  switch (code) {
    case "BINDING_MISSING":
      // Local dev and tests have no SEND_EMAIL binding: keep the message in the dev inbox.
      return env.APP_ENV === "production" ? { status: "failed", error, messageId: null } : { status: "logged", error: null, messageId: null };
    case "INVALID_TO":
    case "UNVERIFIED_DESTINATION":
    case "MIME_ERROR":
      return { status: "rejected", error, messageId: null };
    case "OUTCOME_UNKNOWN":
    case "IDEMPOTENCY_CONFLICT":
      // Cloudflare may already have accepted it; resending could deliver it twice.
      return { status: "unknown", error, messageId: null };
    default:
      // INVALID_FROM (sender not set up yet), QUOTA_EXCEEDED, UPSTREAM_ERROR: retry later.
      return { status: "failed", error, messageId: null };
  }
}


export interface ReceiptSnapshot {
  restaurant: string;
  branch: string;
  address: string;
  orderNumber: string;
  type: string;
  tables: string[];
  closedAt: number;
  currency: string;
  timezone: string;
  items: { name: string; qty: number; unitPrice: number; modifiers: { option: string; price: number }[]; lineTotal: number }[];
  subtotal: number;
  discount: number;
  discountLabel: string | null;
  serviceCharge: number;
  serviceChargePct: number;
  tax: number;
  taxPct: number;
  rounding: number;
  total: number;
  payments: { method: string; amount: number; change: number; splitLabel: string | null }[];
  points: { earned: number; balance: number; tier: string } | null;
  url: string;
}
