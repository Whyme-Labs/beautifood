// Xero: every paid bill becomes an authorised sales invoice, paid in full, so the books match the
// till without anyone typing. Needs XERO_CLIENT_ID, XERO_CLIENT_SECRET, XERO_REFRESH_TOKEN (from
// connecting your Xero app once) and XERO_TENANT_ID; XERO_ACCOUNT_CODE is the sales account
// (default 200). Xero rotates refresh tokens: bind KV as STATE so the new one is kept.
import type { BeautifoodEvent, Connector, Env } from "../beautifood";

const TOKEN_URL = "https://identity.xero.com/connect/token";
const API = "https://api.xero.com/api.xro/2.0";

export function xeroInvoice(e: BeautifoodEvent, env: Env) {
  const o = e.data.order;
  if (!o) return null;
  const account = env.XERO_ACCOUNT_CODE || "200";
  const lines = o.items.map((i) => ({
    Description: [i.name, ...i.modifiers.map((m) => m.option), i.deal ? `(${i.deal})` : ""].filter(Boolean).join(" · "),
    Quantity: i.qty,
    UnitAmount: (i.unit_price + i.modifiers.reduce((s, m) => s + m.price, 0)) / 100,
    AccountCode: account,
  }));
  // service charge, tax and rounding as their own lines, so the invoice total is the bill total
  for (const [label, v] of [["Service charge", o.service_charge], ["Tax", o.tax], ["Rounding", o.rounding], ["Discount", -o.discount]] as const)
    if (v) lines.push({ Description: label, Quantity: 1, UnitAmount: v / 100, AccountCode: account });
  return {
    Type: "ACCREC",
    Status: "AUTHORISED",
    LineAmountTypes: "NoTax",
    Contact: { Name: `${e.restaurant.name} walk-in guests` },
    Date: e.created_at.slice(0, 10),
    DueDate: e.created_at.slice(0, 10),
    Reference: `Beautifood ${e.branch?.name ?? ""} #${o.number}`.trim(),
    LineItems: lines,
  };
}

async function accessToken(env: Env): Promise<string> {
  const refresh = (await env.STATE?.get("xero:refresh")) || env.XERO_REFRESH_TOKEN!;
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", authorization: `Basic ${btoa(`${env.XERO_CLIENT_ID}:${env.XERO_CLIENT_SECRET}`)}` },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh }),
  });
  if (!r.ok) throw new Error(`Xero token: ${r.status} ${await r.text()}`);
  const j = (await r.json()) as { access_token: string; refresh_token: string };
  await env.STATE?.put("xero:refresh", j.refresh_token);
  return j.access_token;
}

export const xero: Connector = {
  name: "xero",
  events: ["order.paid"],
  enabled: (env) => !!(env.XERO_CLIENT_ID && env.XERO_CLIENT_SECRET && env.XERO_REFRESH_TOKEN && env.XERO_TENANT_ID),
  async handle(e, env) {
    const invoice = xeroInvoice(e, env);
    if (!invoice) return;
    const token = await accessToken(env);
    const headers = { authorization: `Bearer ${token}`, "xero-tenant-id": env.XERO_TENANT_ID!, "content-type": "application/json", accept: "application/json", "idempotency-key": `bf-${e.id}` };
    const r = await fetch(`${API}/Invoices`, { method: "POST", headers, body: JSON.stringify({ Invoices: [invoice] }) });
    if (!r.ok) throw new Error(`Xero invoice: ${r.status} ${await r.text()}`);
  },
};
