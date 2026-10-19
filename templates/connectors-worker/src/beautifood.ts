// What every connector needs from Beautifood: signature checks, the event shapes, once-only
// handling of a delivery, and a small client for calling back.

export interface Env {
  BEAUTIFOOD_URL: string;
  BEAUTIFOOD_WEBHOOK_SECRET?: string;
  BEAUTIFOOD_TOKEN?: string;
  STATE?: KV;
  SLACK_WEBHOOK_URL?: string;
  WHATSAPP_TOKEN?: string;
  WHATSAPP_PHONE_ID?: string;
  WHATSAPP_TEMPLATE?: string;
  XERO_CLIENT_ID?: string;
  XERO_CLIENT_SECRET?: string;
  XERO_REFRESH_TOKEN?: string;
  XERO_TENANT_ID?: string;
  XERO_ACCOUNT_CODE?: string;
  DELIVERY_SECRET?: string;
}

/** The slice of Workers KV this uses (so it type-checks without the Workers types package). */
export interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

export interface Ticket {
  id: string;
  number: string;
  name: string;
  phone: string | null;
  locale: string | null;
  party_size: number;
  status: string;
}
export interface OrderLine {
  id: string;
  item_id: string;
  name: string;
  qty: number;
  unit_price: number;
  list_price: number | null;
  deal: string | null;
  modifiers: { group: string; option: string; price: number }[];
}
export interface Order {
  id: string;
  number: string;
  type: string;
  items: OrderLine[];
  subtotal: number;
  discount: number;
  service_charge: number;
  tax: number;
  rounding: number;
  total: number;
  paid: number;
  payments: { method: string; amount: number; label: string | null }[];
}
export interface BeautifoodEvent {
  id: string;
  type: string;
  created_at: string;
  restaurant: { id: string; name: string; slug: string };
  branch: { id: string; name: string; slug: string } | null;
  data: Record<string, unknown> & { ticket?: Ticket; order?: Order; item?: { id: string; name: string; price: number }; shift?: Record<string, unknown> };
}

/** Check `x-beautifood-signature: t=<unix>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">` (5 minutes' tolerance). */
export async function verify(raw: string, header: string | null, secret: string, now = Date.now(), toleranceS = 300): Promise<boolean> {
  const parts = Object.fromEntries((header ?? "").split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || !parts.v1 || Math.abs(now / 1000 - t) > toleranceS) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${raw}`)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  let diff = hex.length ^ parts.v1.length;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ (parts.v1.charCodeAt(i) || 0);
  return diff === 0;
}

/** Run `fn` once per key (a delivery id plus the connector's name). Without KV it runs every time. */
export async function once(env: Env, key: string, fn: () => Promise<void>): Promise<"done" | "skipped"> {
  if (env.STATE && (await env.STATE.get(`seen:${key}`))) return "skipped";
  await fn();
  await env.STATE?.put(`seen:${key}`, "1", { expirationTtl: 14 * 86_400 });
  return "done";
}

export const money = (minor: number, currency = "MYR") => new Intl.NumberFormat("en-MY", { style: "currency", currency }).format(minor / 100);

/** Call Beautifood's staff API with the restaurant's API key. */
export async function beautifood<T>(env: Env, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  if (!env.BEAUTIFOOD_TOKEN) throw new Error("Set BEAUTIFOOD_TOKEN (a bf_pat_… key from Integrations → API keys)");
  const r = await fetch(`${env.BEAUTIFOOD_URL.replace(/\/$/, "")}${path}`, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers: { authorization: `Bearer ${env.BEAUTIFOOD_TOKEN}`, "content-type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Beautifood ${path}: ${r.status} ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : null) as T;
}

export interface Connector {
  name: string;
  /** Has its secrets: runs. Otherwise it is skipped (and listed as off on GET /). */
  enabled(env: Env): boolean;
  /** The events it handles. */
  events: string[];
  handle(e: BeautifoodEvent, env: Env): Promise<void>;
}
