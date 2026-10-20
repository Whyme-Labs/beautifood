// Storefront web addresses: which restaurant a request's host belongs to, and the custom domains
// restaurants add. A custom domain is a Cloudflare for SaaS custom hostname on the platform's zone:
// the restaurant points a CNAME at CUSTOM_DOMAIN_TARGET, Cloudflare checks it and issues the
// certificate, and once both are active the address serves the storefront. Without Cloudflare
// configured, development and tests use a stand-in that behaves the same way.
import { env } from "void/env";
import { MAX_DOMAINS, classifyHost, claimable, cleanHostname, readProvider, type CustomDomain, type DomainStatus, type HostRules, type ProviderHost } from "../../shared/domains";
import { fail } from "../errors";
import { Tx } from "../tx";
import { streams } from "./context";

export function hostRules(): HostRules {
  let appHost = "";
  try {
    appHost = new URL(env.PUBLIC_URL).host;
  } catch {
    /* unset in odd setups: nothing is the app host */
  }
  return { storefrontDomain: env.STOREFRONT_DOMAIN?.trim() || undefined, appHost };
}

// ---- Cloudflare for SaaS ----


export interface Hostnames {
  create(hostname: string): Promise<ProviderHost>;
  get(id: string): Promise<ProviderHost | null>;
  remove(id: string): Promise<void>;
}

function cloudflare(zone: string, token: string): Hostnames {
  const base = `https://api.cloudflare.com/client/v4/zones/${zone}/custom_hostnames`;
  const call = async (path: string, init: RequestInit = {}) => {
    const r = await fetch(base + path, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" } });
    const j = (await r.json().catch(() => ({}))) as { success?: boolean; result?: ProviderHost; errors?: { code: number; message: string }[] };
    if (r.status === 404) return null;
    if (!r.ok || j.success === false) {
      const e = j.errors?.[0];
      // 1406: the hostname is already a custom hostname on this (or another) zone
      if (e?.code === 1406) fail(409, "domain_taken", "That address is already connected to a site on Cloudflare");
      fail(502, "domain_provider", e?.message ? `Cloudflare: ${e.message}` : "Cloudflare didn't accept that address. Try again in a minute.");
    }
    return j.result ?? null;
  };
  return {
    create: async (hostname) => (await call("", { method: "POST", body: JSON.stringify({ hostname, ssl: { method: "http", type: "dv", settings: { min_tls_version: "1.2" } } }) }))!,
    get: (id) => call(`/${id}`),
    remove: async (id) => void (await call(`/${id}`, { method: "DELETE" })),
  };
}

/**
 * The stand-in for development and tests: an address goes live on its first check, except
 * names starting "pending." (never verified) and "broken." (Cloudflare refuses the certificate).
 */
const standIn: Hostnames = {
  create: async (hostname) => ({ id: `local:${hostname}`, hostname, status: "pending", ssl: { status: "pending_validation" }, ownership_verification: { type: "txt", name: `_cf-custom-hostname.${hostname}`, value: "local-check" } }),
  get: async (id) => {
    const hostname = id.slice("local:".length);
    if (hostname.startsWith("pending.")) return { id, hostname, status: "pending", ssl: { status: "pending_validation" }, ownership_verification: { type: "txt", name: `_cf-custom-hostname.${hostname}`, value: "local-check" } };
    if (hostname.startsWith("broken.")) return { id, hostname, status: "pending", ssl: { status: "validation_timed_out", validation_errors: [{ message: "CAA records block certificate issuance" }] } };
    return { id, hostname, status: "active", ssl: { status: "active" } };
  },
  remove: async () => {},
};

let override: Hostnames | null = null;
/** Tests can swap the provider. */
export const setHostnames = (h: Hostnames | null) => void (override = h);

/** The provider, or null when this deployment can't take custom domains. */
export function hostnames(): Hostnames | null {
  if (override) return override;
  if (env.CUSTOM_DOMAINS_ZONE_ID && env.CUSTOM_DOMAINS_API_TOKEN) return cloudflare(env.CUSTOM_DOMAINS_ZONE_ID, env.CUSTOM_DOMAINS_API_TOKEN);
  return env.APP_ENV === "production" ? null : standIn;
}

/** What restaurants point their CNAME at. */
export function cnameTarget(): string {
  const t = env.CUSTOM_DOMAIN_TARGET?.trim();
  if (t) return t;
  const sd = env.STOREFRONT_DOMAIN?.trim();
  return sd ? `stores.${sd}` : hostRules().appHost.replace(/:\d+$/, "") || "stores.beautifood.app";
}

// ---- Commands ----

interface Row {
  hostname: string;
  tenant_id: string;
  status: DomainStatus;
  provider_id: string;
  records: string;
  detail: string;
  created_at: number;
  checked_at: number | null;
}

const view = (r: Row): CustomDomain => ({ hostname: r.hostname, status: r.status, records: JSON.parse(r.records || "[]"), detail: r.detail, createdAt: r.created_at, checkedAt: r.checked_at });

export async function listDomains(db: D1Database, tenantId: string): Promise<CustomDomain[]> {
  const rows = (await db.prepare("SELECT * FROM custom_domains WHERE tenant_id = ? ORDER BY created_at").bind(tenantId).all<Row>()).results;
  return rows.map(view);
}

function provider(): Hostnames {
  const p = hostnames();
  if (!p) fail(503, "domains_unavailable", "Custom web addresses aren't set up on this Beautifood yet");
  return p;
}

export async function addDomain(db: D1Database, tenantId: string, actor: string, input: string): Promise<CustomDomain> {
  const hostname = cleanHostname(input);
  if (!hostname) fail(400, "invalid_domain", "That isn't a web address. Try something like www.yourrestaurant.com");
  if (!claimable(hostname, hostRules())) fail(400, "domain_reserved", "That address belongs to Beautifood. Use one of your own.");
  const p = provider();
  // checked before Cloudflare is asked, so a refusal costs nothing there
  const taken = await db.prepare("SELECT tenant_id FROM custom_domains WHERE hostname = ?").bind(hostname).first<{ tenant_id: string }>();
  if (taken) fail(409, taken.tenant_id === tenantId ? "domain_exists" : "domain_taken", taken.tenant_id === tenantId ? "You've already added that address" : "Another restaurant uses that address");
  const count = (await db.prepare("SELECT COUNT(*) AS n FROM custom_domains WHERE tenant_id = ?").bind(tenantId).first<{ n: number }>())!.n;
  if (count >= MAX_DOMAINS) fail(409, "too_many_domains", `Up to ${MAX_DOMAINS} web addresses`);

  const h = await p.create(hostname);
  const read = readProvider(h, cnameTarget());
  const now = Date.now();
  try {
    await new Tx(db, { tenantId, actor })
      .assert("NOT EXISTS (SELECT 1 FROM custom_domains WHERE hostname = ?)", [hostname], 409, "domain_taken", "Another restaurant uses that address")
      .assert("(SELECT COUNT(*) FROM custom_domains WHERE tenant_id = ?) < ?", [tenantId, MAX_DOMAINS], 409, "too_many_domains", `Up to ${MAX_DOMAINS} web addresses`)
      .run(
        "INSERT INTO custom_domains (hostname, tenant_id, status, provider_id, records, detail, created_at, checked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        hostname,
        tenantId,
        read.status,
        h.id,
        JSON.stringify(read.records),
        read.detail,
        now,
        now,
      )
      .event({ stream: streams.tenant(tenantId), type: "domain.added", data: { hostname } })
      .commit();
  } catch (e) {
    // lost a race: don't leave the hostname behind at Cloudflare
    await p.remove(h.id).catch(() => {});
    throw e;
  }
  forgetHost(hostname);
  return { hostname, status: read.status, records: read.records, detail: read.detail, createdAt: now, checkedAt: now };
}

async function own(db: D1Database, tenantId: string, hostname: string): Promise<Row> {
  const r = await db.prepare("SELECT * FROM custom_domains WHERE hostname = ? AND tenant_id = ?").bind(hostname.toLowerCase(), tenantId).first<Row>();
  if (!r) fail(404, "not_found", "That address isn't connected");
  return r;
}

/** Ask Cloudflare where an address stands and record it. */
async function check(db: D1Database, r: Row, p: Hostnames): Promise<CustomDomain> {
  const h = await p.get(r.provider_id);
  const read = h ? readProvider(h, cnameTarget()) : { status: "failed" as const, records: JSON.parse(r.records), detail: "Cloudflare no longer has this address. Remove it and add it again." };
  const now = Date.now();
  const tx = new Tx(db, { tenantId: r.tenant_id, actor: "system:domains" }).run(
    "UPDATE custom_domains SET status = ?, records = ?, detail = ?, checked_at = ? WHERE hostname = ?",
    read.status,
    JSON.stringify(read.records),
    read.detail,
    now,
    r.hostname,
  );
  if (read.status !== r.status) tx.event({ stream: streams.tenant(r.tenant_id), type: `domain.${read.status}`, data: { hostname: r.hostname, detail: read.detail } });
  await tx.commit();
  if (read.status !== r.status) forgetHost(r.hostname);
  return { ...view(r), status: read.status, records: read.records, detail: read.detail, checkedAt: now };
}

export async function checkDomain(db: D1Database, tenantId: string, hostname: string): Promise<CustomDomain> {
  return check(db, await own(db, tenantId, hostname), provider());
}

export async function removeDomain(db: D1Database, tenantId: string, actor: string, hostname: string) {
  const r = await own(db, tenantId, hostname);
  const p = hostnames();
  if (p && r.provider_id) await p.remove(r.provider_id);
  await new Tx(db, { tenantId, actor })
    .run("DELETE FROM custom_domains WHERE hostname = ?", r.hostname)
    .event({ stream: streams.tenant(tenantId), type: "domain.removed", data: { hostname: r.hostname } })
    .commit();
  forgetHost(r.hostname);
}

/** Cron: re-check addresses still waiting on DNS, often at first and then every quarter hour. */
export async function checkPendingDomains(db: D1Database, limit = 20) {
  const p = hostnames();
  if (!p) return;
  const now = Date.now();
  const rows = (
    await db
      .prepare("SELECT * FROM custom_domains WHERE status = 'pending' AND (checked_at IS NULL OR checked_at < CASE WHEN created_at > ? THEN ? ELSE ? END) ORDER BY checked_at LIMIT ?")
      .bind(now - 3_600_000, now - 60_000, now - 900_000, limit)
      .all<Row>()
  ).results;
  for (const r of rows) await check(db, r, p).catch((e) => console.error("domain check", r.hostname, e));
}

// ---- Which restaurant a host is ----

const cache = new Map<string, { slug: string | null; until: number }>();
const forgetHost = (host: string) => void cache.delete(host);

/** The storefront slug a request's host serves, or null for the app itself (and unknown hosts). */
export async function storefrontForHost(db: D1Database, rawHost: string): Promise<string | null> {
  const k = classifyHost(rawHost, hostRules());
  if (k.kind === "app") return null;
  const key = k.kind === "subdomain" ? `sub:${k.slug}` : k.hostname;
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.slug;
  const row =
    k.kind === "subdomain"
      ? await db.prepare("SELECT slug FROM tenants WHERE slug = ?").bind(k.slug).first<{ slug: string }>()
      : await db.prepare("SELECT t.slug FROM custom_domains d JOIN tenants t ON t.id = d.tenant_id WHERE d.hostname = ? AND d.status = 'active'").bind(k.hostname).first<{ slug: string }>();
  if (cache.size > 2000) cache.clear();
  cache.set(key, { slug: row?.slug ?? null, until: Date.now() + 60_000 });
  return row?.slug ?? null;
}
