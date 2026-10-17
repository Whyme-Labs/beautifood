// Outgoing email (recorded first, delivered after; idempotent per kind/ref/recipient),
// e-receipts and Web Push "tickles".
import { formatMoney } from "../../shared/format";
import { newId } from "../ids";

export interface EmailInput {
  tenantId?: string | null;
  to: string;
  subject: string;
  html: string;
  text: string;
  kind: string;
  ref: string;
}

export interface MailEnv {
  RESEND_API_KEY?: string;
  EMAIL_FROM: string;
}

/**
 * Record then deliver. Delivery uses Resend when configured; otherwise the email
 * stays in the `emails` table as status "logged" (the dev inbox at /m/dev/inbox).
 */
export async function sendEmail(db: D1Database, env: MailEnv, e: EmailInput): Promise<{ id: string; status: string; duplicate?: boolean }> {
  const id = newId("em_");
  const ins = await db
    .prepare("INSERT OR IGNORE INTO emails (id, tenant_id, to_email, subject, html, text, kind, ref, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?)")
    .bind(id, e.tenantId ?? null, e.to.toLowerCase(), e.subject, e.html, e.text, e.kind, e.ref, Date.now())
    .run();
  if (!ins.meta.changes) return { id: "", status: "duplicate", duplicate: true };
  if (!env.RESEND_API_KEY) {
    await db.prepare("UPDATE emails SET status = 'logged', sent_at = ? WHERE id = ?").bind(Date.now(), id).run();
    return { id, status: "logged" };
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json", "idempotency-key": id },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [e.to], subject: e.subject, html: e.html, text: e.text }),
    });
    if (!r.ok) throw new Error(`resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
    await db.prepare("UPDATE emails SET status = 'sent', sent_at = ? WHERE id = ?").bind(Date.now(), id).run();
    return { id, status: "sent" };
  } catch (err) {
    await db.prepare("UPDATE emails SET status = 'failed', error = ? WHERE id = ?").bind(String(err).slice(0, 300), id).run();
    throw err;
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

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

export function receiptHtml(r: ReceiptSnapshot): string {
  const m = (n: number) => esc(formatMoney(n, r.currency));
  const when = new Intl.DateTimeFormat("en-MY", { timeZone: r.timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(r.closedAt));
  const row = (l: string, v: string, strong = false) =>
    `<tr><td style="padding:4px 0;${strong ? "font-weight:700;font-size:16px" : "color:#555"}">${l}</td><td style="padding:4px 0;text-align:right;${strong ? "font-weight:700;font-size:16px" : ""}">${v}</td></tr>`;
  return `<!doctype html><html><body style="margin:0;background:#f6f3ee;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1d1a16">
<div style="max-width:480px;margin:24px auto;background:#fff;border-radius:14px;padding:28px">
<h1 style="margin:0 0 4px;font-size:22px">${esc(r.restaurant)}</h1>
<div style="color:#777;font-size:13px">${esc(r.branch)}${r.address ? " · " + esc(r.address) : ""}</div>
<div style="margin:16px 0;font-size:13px;color:#555">Receipt #${esc(r.orderNumber)} · ${esc(when)}${r.tables.length ? " · Table " + esc(r.tables.join("+")) : ""}</div>
<table style="width:100%;border-collapse:collapse;font-size:14px">
${r.items
  .map(
    (i) =>
      `<tr><td style="padding:6px 0">${i.qty}× ${esc(i.name)}${i.modifiers.length ? `<div style="color:#888;font-size:12px">${i.modifiers.map((x) => esc(x.option)).join(", ")}</div>` : ""}</td><td style="text-align:right;vertical-align:top;padding:6px 0">${m(i.lineTotal)}</td></tr>`,
  )
  .join("")}
</table>
<hr style="border:none;border-top:1px solid #eee;margin:12px 0">
<table style="width:100%;border-collapse:collapse;font-size:14px">
${row("Subtotal", m(r.subtotal))}
${r.discount ? row(esc(r.discountLabel ?? "Discount"), "-" + m(r.discount)) : ""}
${r.serviceCharge ? row(`Service charge (${r.serviceChargePct}%)`, m(r.serviceCharge)) : ""}
${r.tax ? row(`Tax (${r.taxPct}%)`, m(r.tax)) : ""}
${r.rounding ? row("Rounding", m(r.rounding)) : ""}
${row("Total", m(r.total), true)}
${r.payments.map((p) => row(`Paid · ${esc(p.method)}${p.splitLabel ? " (" + esc(p.splitLabel) + ")" : ""}`, m(p.amount))).join("")}
</table>
${r.points ? `<div style="margin-top:16px;background:#fdf4e3;border-radius:10px;padding:12px;font-size:14px">⭐ You earned <b>${r.points.earned}</b> points · balance <b>${r.points.balance}</b> · ${esc(r.points.tier)}</div>` : ""}
<p style="margin-top:20px;font-size:13px"><a href="${esc(r.url)}" style="color:#b4532a">View this receipt online</a></p>
<p style="color:#999;font-size:12px">Thank you for dining with us.</p>
</div></body></html>`;
}

export function receiptText(r: ReceiptSnapshot): string {
  const m = (n: number) => formatMoney(n, r.currency);
  return [
    `${r.restaurant} — ${r.branch}`,
    `Receipt #${r.orderNumber}`,
    ...r.items.map((i) => `${i.qty}x ${i.name}  ${m(i.lineTotal)}`),
    `Subtotal ${m(r.subtotal)}`,
    r.discount ? `Discount -${m(r.discount)}` : "",
    r.serviceCharge ? `Service ${m(r.serviceCharge)}` : "",
    r.tax ? `Tax ${m(r.tax)}` : "",
    `Total ${m(r.total)}`,
    r.points ? `Points earned ${r.points.earned}, balance ${r.points.balance}` : "",
    r.url,
  ]
    .filter(Boolean)
    .join("\n");
}
