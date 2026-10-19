// Webhooks: every subscribed event in the log goes to the restaurant's endpoints as a signed
// POST, retried with backoff and logged. This is the surface a restaurant's connectors (or the
// glue code its own AI agent writes) build on.
//
// Fan-out reads the event log with its own cursor (like the side-effect pipeline), so it is
// at-least-once and in order. A delivery row per (endpoint, event) makes it exactly-once to queue;
// receivers dedupe on the delivery id if a retry lands after a slow success.
import { RETRY_MINUTES, WEBHOOK_EVENT_TYPES, WEBHOOK_HEADERS, WEBHOOK_PING, subscribes } from "../../shared/webhooks";
import { fail, notFound } from "../errors";
import { newId } from "../ids";
import { orderView } from "./orders";
import { endpointSecret, signature } from "../webhookSign";

export { endpointSecret, signature };

const CONSUMER = "webhooks";
const TIMEOUT_MS = 10_000;
const KEEP_BODY = 2000;

export interface EndpointRow {
  id: string;
  tenant_id: string;
  url: string;
  description: string;
  events: string;
  branches: string;
  active: number;
  secret_version: number;
  from_event_id: number;
  created_by: string;
  created_at: number;
}

export const toEndpoint = (r: EndpointRow, stats?: { delivered: number; failed: number; pending: number; last_at: number | null }) => ({
  id: r.id,
  url: r.url,
  description: r.description,
  events: JSON.parse(r.events) as string[],
  branches: JSON.parse(r.branches) as string[],
  active: !!r.active,
  createdAt: r.created_at,
  stats: stats ?? null,
});

/** Only https (http too outside production, for local receivers), and never this app's own host. */
export function checkUrl(raw: string, env: { APP_ENV: string; PUBLIC_URL: string }) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return fail(400, "invalid_url", "That isn't a web address");
  }
  if (u.protocol !== "https:" && !(u.protocol === "http:" && env.APP_ENV !== "production")) fail(400, "invalid_url", "Use an https:// address");
  if (u.username || u.password) fail(400, "invalid_url", "Put credentials in your receiver, not in the address");
  try {
    if (env.PUBLIC_URL && new URL(env.PUBLIC_URL).host === u.host && env.APP_ENV === "production") fail(400, "invalid_url", "A webhook can't point back at Beautifood");
  } catch {
    // PUBLIC_URL unset or malformed: nothing to compare against
  }
  return u.toString();
}

export async function listEndpoints(db: D1Database, tenantId: string) {
  const rows = (await db.prepare("SELECT * FROM webhook_endpoints WHERE tenant_id = ? ORDER BY created_at").bind(tenantId).all<EndpointRow>()).results;
  const stats = (
    await db
      .prepare(
        `SELECT endpoint_id, SUM(status = 'delivered') AS delivered, SUM(status = 'failed') AS failed, SUM(status = 'pending') AS pending, MAX(COALESCE(delivered_at, created_at)) AS last_at
         FROM webhook_deliveries WHERE tenant_id = ? AND created_at > ? GROUP BY endpoint_id`,
      )
      .bind(tenantId, Date.now() - 7 * 86_400_000)
      .all<{ endpoint_id: string; delivered: number; failed: number; pending: number; last_at: number | null }>()
  ).results;
  return rows.map((r) => toEndpoint(r, stats.find((x) => x.endpoint_id === r.id) ?? { delivered: 0, failed: 0, pending: 0, last_at: null }));
}

export async function getEndpoint(db: D1Database, tenantId: string, id: string) {
  const r = await db.prepare("SELECT * FROM webhook_endpoints WHERE id = ? AND tenant_id = ?").bind(id, tenantId).first<EndpointRow>();
  if (!r) notFound("Webhook");
  return r;
}

export interface EndpointInput {
  url: string;
  description?: string;
  events: string[];
  branches: string[];
  active?: boolean;
}

const cleanEvents = (events: string[]) => (events.includes("*") ? ["*"] : [...new Set(events)].filter((e) => (WEBHOOK_EVENT_TYPES as string[]).includes(e)));

export async function createEndpoint(db: D1Database, tenantId: string, actor: string, input: EndpointInput) {
  const events = cleanEvents(input.events);
  if (!events.length) fail(400, "no_events", "Pick at least one event");
  const count = await db.prepare("SELECT COUNT(*) AS n FROM webhook_endpoints WHERE tenant_id = ?").bind(tenantId).first<{ n: number }>();
  if ((count?.n ?? 0) >= 20) fail(409, "too_many_webhooks", "A restaurant can have up to 20 webhooks");
  const id = newId("wh_");
  const last = await db.prepare("SELECT COALESCE(MAX(id), 0) AS id FROM events").first<{ id: number }>();
  await db
    .batch([
      db
        .prepare("INSERT INTO webhook_endpoints (id, tenant_id, url, description, events, branches, active, from_event_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(id, tenantId, input.url, input.description ?? "", JSON.stringify(events), JSON.stringify(input.branches.length ? input.branches : ["*"]), input.active === false ? 0 : 1, last?.id ?? 0, actor, Date.now()),
      db.prepare("INSERT INTO events (tenant_id, stream, type, data, actor, at) VALUES (?, ?, 'webhook.created', ?, ?, ?)").bind(tenantId, `tenant:${tenantId}`, JSON.stringify({ id, events }), actor, Date.now()),
    ]);
  return id;
}

export async function updateEndpoint(db: D1Database, tenantId: string, id: string, input: Partial<EndpointInput>) {
  const r = await getEndpoint(db, tenantId, id);
  const events = input.events ? cleanEvents(input.events) : (JSON.parse(r.events) as string[]);
  if (!events.length) fail(400, "no_events", "Pick at least one event");
  await db
    .prepare("UPDATE webhook_endpoints SET url = ?, description = ?, events = ?, branches = ?, active = ? WHERE id = ? AND tenant_id = ?")
    .bind(input.url ?? r.url, input.description ?? r.description, JSON.stringify(events), JSON.stringify(input.branches ? (input.branches.length ? input.branches : ["*"]) : JSON.parse(r.branches)), input.active === undefined ? r.active : input.active ? 1 : 0, id, tenantId)
    .run();
}

export async function deleteEndpoint(db: D1Database, tenantId: string, id: string) {
  await getEndpoint(db, tenantId, id);
  await db.batch([db.prepare("DELETE FROM webhook_deliveries WHERE endpoint_id = ?").bind(id), db.prepare("DELETE FROM webhook_endpoints WHERE id = ? AND tenant_id = ?").bind(id, tenantId)]);
}

export async function rotateSecret(db: D1Database, tenantId: string, id: string) {
  await getEndpoint(db, tenantId, id);
  await db.prepare("UPDATE webhook_endpoints SET secret_version = secret_version + 1 WHERE id = ? AND tenant_id = ?").bind(id, tenantId).run();
}

export async function listDeliveries(db: D1Database, tenantId: string, endpointId: string, limit = 50) {
  await getEndpoint(db, tenantId, endpointId);
  return (
    await db
      .prepare("SELECT id, event_id, type, status, attempts, next_at, response_status, response_body, error, duration_ms, created_at, delivered_at, payload FROM webhook_deliveries WHERE endpoint_id = ? ORDER BY created_at DESC LIMIT ?")
      .bind(endpointId, limit)
      .all<{ id: string; event_id: number | null; type: string; status: string; attempts: number; next_at: number; response_status: number | null; response_body: string | null; error: string | null; duration_ms: number | null; created_at: number; delivered_at: number | null; payload: string }>()
  ).results.map((d) => ({
    id: d.id,
    eventId: d.event_id,
    type: d.type,
    status: d.status,
    attempts: d.attempts,
    nextAt: d.status === "pending" ? d.next_at : null,
    responseStatus: d.response_status,
    responseBody: d.response_body,
    error: d.error,
    durationMs: d.duration_ms,
    createdAt: d.created_at,
    deliveredAt: d.delivered_at,
    payload: JSON.parse(d.payload),
  }));
}

/** Send a delivery again now (from the log), whatever its state. */
export async function resend(db: D1Database, tenantId: string, deliveryId: string, env: WebhookEnv) {
  const d = await db.prepare("SELECT id FROM webhook_deliveries WHERE id = ? AND tenant_id = ?").bind(deliveryId, tenantId).first();
  if (!d) notFound("Delivery");
  await db.prepare("UPDATE webhook_deliveries SET status = 'pending', next_at = ? WHERE id = ?").bind(Date.now(), deliveryId).run();
  await deliverDue(db, env, deliveryId);
  return (await db.prepare("SELECT status, response_status, error FROM webhook_deliveries WHERE id = ?").bind(deliveryId).first<{ status: string; response_status: number | null; error: string | null }>())!;
}

/** A test ping, delivered now; the log shows how the receiver answered. */
export async function sendPing(db: D1Database, tenantId: string, endpointId: string, env: WebhookEnv) {
  const e = await getEndpoint(db, tenantId, endpointId);
  const tenant = await db.prepare("SELECT id, name, slug FROM tenants WHERE id = ?").bind(tenantId).first<{ id: string; name: string; slug: string }>();
  const id = newId("whd_");
  const payload = { id: `evt_ping_${id.slice(4)}`, type: WEBHOOK_PING, created_at: new Date().toISOString(), restaurant: tenant, branch: null, data: { message: "Hello from Beautifood. This endpoint is set up." } };
  await db.prepare("INSERT INTO webhook_deliveries (id, endpoint_id, tenant_id, event_id, type, payload, next_at, created_at) VALUES (?, ?, ?, NULL, ?, ?, ?, ?)").bind(id, e.id, tenantId, WEBHOOK_PING, JSON.stringify(payload), Date.now(), Date.now()).run();
  await deliverDue(db, env, id);
  return (await db.prepare("SELECT id, status, response_status, error FROM webhook_deliveries WHERE id = ?").bind(id).first<{ id: string; status: string; response_status: number | null; error: string | null }>())!;
}

// ── fan-out and delivery ────────────────────────────────────────────────────

export interface WebhookEnv {
  TOKEN_SECRET: string;
}

interface EventRow {
  id: number;
  tenant_id: string;
  branch_id: string | null;
  stream: string;
  type: string;
  data: string;
  at: number;
}

/** Queue deliveries for new events, then send what is due. Safe to run concurrently and repeatedly. */
export async function pumpWebhooks(db: D1Database, env: WebhookEnv, limit = 200): Promise<{ queued: number; sent: number }> {
  const queued = await fanOut(db, limit);
  const sent = await deliverDue(db, env);
  return { queued, sent };
}

async function fanOut(db: D1Database, limit: number): Promise<number> {
  await db.prepare("INSERT OR IGNORE INTO consumer_cursors (name, last_id, updated_at) VALUES (?, 0, ?)").bind(CONSUMER, Date.now()).run();
  const cur = (await db.prepare("SELECT last_id FROM consumer_cursors WHERE name = ?").bind(CONSUMER).first<{ last_id: number }>())!.last_id;
  const endpoints = (await db.prepare("SELECT * FROM webhook_endpoints WHERE active = 1").all<EndpointRow>()).results;
  const types = WEBHOOK_EVENT_TYPES as string[];
  const rows = endpoints.length
    ? (await db.prepare(`SELECT * FROM events WHERE id > ? AND type IN (${types.map(() => "?").join(",")}) ORDER BY id LIMIT ?`).bind(cur, ...types, limit).all<EventRow>()).results
    : [];
  let queued = 0;
  for (const e of rows) {
    const mine = endpoints.filter((w) => {
      const branches = JSON.parse(w.branches) as string[];
      return w.tenant_id === e.tenant_id && e.id > w.from_event_id && subscribes(JSON.parse(w.events), e.type) && (branches.includes("*") || (e.branch_id && branches.includes(e.branch_id)));
    });
    if (!mine.length) continue;
    const payload = JSON.stringify(await payloadFor(db, e));
    await db.batch(
      mine.map((w) =>
        db
          .prepare("INSERT OR IGNORE INTO webhook_deliveries (id, endpoint_id, tenant_id, event_id, type, payload, next_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(newId("whd_"), w.id, e.tenant_id, e.id, e.type, payload, Date.now(), Date.now()),
      ),
    );
    queued += mine.length;
  }
  // with no endpoints anywhere, skip ahead so a first endpoint never sees a backlog (it starts after its own from_event_id anyway)
  const last = rows.length ? rows[rows.length - 1].id : endpoints.length ? cur : ((await db.prepare("SELECT COALESCE(MAX(id), 0) AS id FROM events").first<{ id: number }>())?.id ?? cur);
  if (last > cur) await db.prepare("UPDATE consumer_cursors SET last_id = MAX(last_id, ?), updated_at = ? WHERE name = ?").bind(last, Date.now(), CONSUMER).run();
  return queued;
}

/** POST every due delivery (or one, by id). Each is claimed first, so two runs never send the same attempt. */
export async function deliverDue(db: D1Database, env: WebhookEnv, onlyId?: string): Promise<number> {
  const now = Date.now();
  const due = (
    await db
      .prepare(
        `SELECT d.id, d.payload, d.type, d.attempts, e.url, e.id AS endpoint_id, e.secret_version FROM webhook_deliveries d JOIN webhook_endpoints e ON e.id = d.endpoint_id
         WHERE d.status = 'pending' AND d.next_at <= ? ${onlyId ? "AND d.id = ?" : "AND e.active = 1"} ORDER BY d.next_at LIMIT 50`,
      )
      .bind(...(onlyId ? [now, onlyId] : [now]))
      .all<{ id: string; payload: string; type: string; attempts: number; url: string; endpoint_id: string; secret_version: number }>()
  ).results;
  let sent = 0;
  for (const d of due) {
    // claim this attempt: push next_at out so a concurrent run skips it
    const claim = await db.prepare("UPDATE webhook_deliveries SET next_at = ? WHERE id = ? AND status = 'pending' AND attempts = ? AND next_at <= ?").bind(now + 5 * 60_000, d.id, d.attempts, now).run();
    if (!claim.meta.changes) continue;
    const secret = await endpointSecret(env.TOKEN_SECRET, d.endpoint_id, d.secret_version);
    const started = Date.now();
    let status: number | null = null;
    let body: string | null = null;
    let error: string | null = null;
    try {
      const res = await fetch(d.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "Beautifood-Webhooks/1",
          [WEBHOOK_HEADERS.event]: d.type,
          [WEBHOOK_HEADERS.delivery]: d.id,
          [WEBHOOK_HEADERS.signature]: await signature(secret, d.payload, started),
        },
        body: d.payload,
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      status = res.status;
      body = (await res.text().catch(() => "")).slice(0, KEEP_BODY);
    } catch (e) {
      error = e instanceof Error ? (e.name === "TimeoutError" ? `No answer within ${TIMEOUT_MS / 1000} s` : e.message) : String(e);
    }
    const ok = status !== null && status >= 200 && status < 300;
    const attempts = d.attempts + 1;
    const gaveUp = !ok && attempts > RETRY_MINUTES.length;
    const next = ok || gaveUp ? now : Date.now() + RETRY_MINUTES[attempts - 1] * 60_000;
    await db
      .prepare("UPDATE webhook_deliveries SET status = ?, attempts = ?, next_at = ?, response_status = ?, response_body = ?, error = ?, duration_ms = ?, delivered_at = ? WHERE id = ?")
      .bind(ok ? "delivered" : gaveUp ? "failed" : "pending", attempts, next, status, body, error ?? (ok ? null : status ? `HTTP ${status}` : "No response"), Date.now() - started, ok ? Date.now() : null, d.id)
      .run();
    sent++;
  }
  return sent;
}

/** The delivery body: the event, where it happened, and the record it is about. */
async function payloadFor(db: D1Database, e: EventRow) {
  const data = JSON.parse(e.data || "{}") as Record<string, unknown>;
  const [tenant, branch] = await Promise.all([
    db.prepare("SELECT id, name, slug FROM tenants WHERE id = ?").bind(e.tenant_id).first<{ id: string; name: string; slug: string }>(),
    e.branch_id ? db.prepare("SELECT id, name, slug FROM branches WHERE id = ?").bind(e.branch_id).first<{ id: string; name: string; slug: string }>() : null,
  ]);
  return {
    id: `evt_${e.id}`,
    type: e.type,
    created_at: new Date(e.at).toISOString(),
    restaurant: tenant,
    branch,
    data: { ...data, ...(await about(db, e, data)) },
  };
}

async function about(db: D1Database, e: EventRow, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const [kind, id] = e.stream.split(":");
  try {
    if (e.type.startsWith("queue.") && typeof data.ticketId === "string") {
      const t = await db.prepare("SELECT id, number, name, phone, locale, party_size, status, created_at, called_at, seated_at FROM tickets WHERE id = ?").bind(data.ticketId).first();
      return t ? { ticket: t } : {};
    }
    if (kind === "booking") {
      const b = await db.prepare("SELECT id, name, party_size, slot_start, status, notes FROM bookings WHERE id = ?").bind(id).first<Record<string, unknown> & { slot_start: number }>();
      return b ? { booking: { ...b, slot_start: new Date(b.slot_start).toISOString() } } : {};
    }
    if (kind === "order") {
      const o = await orderView(db, id);
      return {
        order: {
          id: o.id,
          number: o.number,
          type: o.type,
          status: o.status,
          items: o.items.filter((i) => i.status !== "void").map((i) => ({ id: i.id, item_id: i.itemId, name: i.name, qty: i.qty, unit_price: i.unitPrice, list_price: i.listPrice ?? null, deal: i.deal ?? null, modifiers: i.modifiers, status: i.status })),
          subtotal: o.subtotal,
          discount: o.discount,
          service_charge: o.serviceCharge,
          tax: o.tax,
          rounding: o.rounding,
          total: o.total,
          paid: o.payments.reduce((s, p) => s + p.amount, 0),
          payments: o.payments.map((p) => ({ method: p.method, amount: p.amount, label: p.splitLabel })),
        },
      };
    }
    if (e.type.startsWith("menu.")) {
      const itemId = (data.itemId ?? data.id) as string | undefined;
      const i = itemId ? await db.prepare("SELECT id, name, price, active FROM menu_items WHERE id = ?").bind(itemId).first() : null;
      return i ? { item: i } : {};
    }
    if (kind === "shift") {
      const s = await db.prepare("SELECT id, user_name, opened_at, closed_at, opening_float, closing_count, expected_cash FROM shifts WHERE id = ?").bind(id).first();
      return s ? { shift: s } : {};
    }
  } catch {
    // the record is gone or unreadable: the event alone still goes out
  }
  return {};
}
