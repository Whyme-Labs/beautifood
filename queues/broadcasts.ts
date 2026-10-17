// Campaign fan-out: each message carries up to 50 recipients. Emails are
// idempotent per (campaign, recipient), so redelivered batches never double-send.
import { defineQueue } from "void";
import type { BroadcastMessage } from "../src/server/domain/campaigns";
import { sendEmail } from "../src/server/domain/messaging";
import { appEnv } from "../src/server/appenv";
import { sign } from "../src/server/sign";

export const maxBatchSize = 10;
export const maxRetries = 5;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export default defineQueue<BroadcastMessage>(async (batch, bindings) => {
  const db = (bindings as { DB: D1Database }).DB;
  const env = appEnv();
  for (const msg of batch.messages) {
    const { tenantId, campaignId, recipients } = msg.body;
    const c = await db.prepare("SELECT subject, body, promo_code FROM campaigns WHERE id = ?").bind(campaignId).first<{ subject: string; body: string; promo_code: string | null }>();
    const t = await db.prepare("SELECT name FROM tenants WHERE id = ?").bind(tenantId).first<{ name: string }>();
    if (!c || !t) {
      msg.ack();
      continue;
    }
    let sent = 0;
    for (const r of recipients) {
      const unsub = `${env.PUBLIC_URL.replace(/\/$/, "")}/api/public/unsubscribe?t=${encodeURIComponent(await sign(env.TOKEN_SECRET, { k: "member", t: tenantId, email: r.email, exp: Date.now() + 90 * 86_400_000 }))}`;
      const body = c.body.replace(/\{name\}/g, r.name || "there");
      const res = await sendEmail(db, env, {
        tenantId,
        fromName: t.name,
        to: r.email,
        subject: c.subject,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:auto"><h2>${esc(t.name)}</h2><p>${esc(body).replace(/\n/g, "<br>")}</p>${c.promo_code ? `<p style="font-size:18px">Use code <b>${esc(c.promo_code)}</b></p>` : ""}<p style="color:#999;font-size:12px"><a href="${unsub}">Unsubscribe</a></p></div>`,
        text: `${body}${c.promo_code ? `\nUse code ${c.promo_code}` : ""}\nUnsubscribe: ${unsub}`,
        kind: "campaign",
        ref: campaignId,
        // RFC 8058 one-click unsubscribe, which bulk senders need for Gmail/Yahoo delivery
        headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      });
      if (!res.duplicate) sent++;
    }
    await db
      .prepare("UPDATE campaigns SET sent = sent + ?, status = CASE WHEN sent + ? >= recipients THEN 'sent' ELSE status END WHERE id = ?")
      .bind(sent, sent, campaignId)
      .run();
    msg.ack();
  }
});
