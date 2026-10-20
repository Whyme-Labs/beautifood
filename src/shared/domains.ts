// Where a restaurant's storefront can live besides /at/<slug>: its own subdomain of the storefront
// domain (<slug>.<STOREFRONT_DOMAIN>) and web addresses of its own (custom domains, served through
// Cloudflare for SaaS). Pure host logic, shared by the request router, the API and the editor.

/** Subdomains no restaurant can have: they belong to the platform or would look like it. */
export const RESERVED_LABELS = new Set([
  "www", "app", "api", "admin", "m", "staff", "pos", "mail", "email", "smtp", "imap", "ftp", "ns1", "ns2",
  "cdn", "static", "assets", "img", "status", "help", "support", "docs", "blog", "dev", "test", "stage",
  "staging", "preview", "beta", "auth", "login", "id", "account", "billing", "pay", "stores", "store", "shop",
  "apps", "hooks", "webhooks", "mcp", "beautifood",
]);

export const MAX_DOMAINS = 3;

/** A slug that works as one DNS label: a–z, 0–9 and inner hyphens, at most 63 long. */
export const isLabel = (s: string) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(s);

/** A slug a restaurant may have as its subdomain. */
export const subdomainOk = (slug: string) => isLabel(slug) && !RESERVED_LABELS.has(slug);

/**
 * What someone typed as their web address, as a bare lowercase hostname, or null if it can't be one.
 * Accepts "https://www.Example.com/menu", "www.example.com." and Unicode names (made punycode).
 */
export function cleanHostname(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(s)) s = `http://${s}`;
  let host: string;
  try {
    const u = new URL(s);
    if (u.username || u.password || u.port) return null;
    host = u.hostname.replace(/\.$/, "");
  } catch {
    return null;
  }
  if (host.length > 253 || /^[\d.]+$/.test(host) || host.startsWith("[")) return null;
  const labels = host.split(".");
  if (labels.length < 2 || !labels.every(isLabel) || /^\d+$/.test(labels.at(-1)!)) return null;
  return host;
}

export interface HostRules {
  /** The storefront domain (restaurants get <slug>.<this>), if this deployment has one. */
  storefrontDomain?: string;
  /** The app's own host (from PUBLIC_URL): never a storefront. */
  appHost: string;
}

export type HostKind = { kind: "app" } | { kind: "subdomain"; slug: string } | { kind: "custom"; hostname: string };

const bare = (h: string) => h.toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");

/** What a request's host is: the app itself, a restaurant's subdomain, or possibly a custom domain. */
export function classifyHost(rawHost: string, rules: HostRules): HostKind {
  const host = bare(rawHost);
  const sd = rules.storefrontDomain ? bare(rules.storefrontDomain) : "";
  if (!host || host === bare(rules.appHost) || host === sd || host === `www.${sd}`) return { kind: "app" };
  if (host === "localhost" || host === "127.0.0.1" || host.startsWith("[") || /^[\d.]+$/.test(host) || host.endsWith(".workers.dev")) return { kind: "app" };
  if (sd && host.endsWith(`.${sd}`)) {
    const label = host.slice(0, -sd.length - 1);
    return subdomainOk(label) ? { kind: "subdomain", slug: label } : { kind: "app" };
  }
  return { kind: "custom", hostname: host };
}

/** Whether a restaurant may claim this hostname as its own (not the platform's, not another's subdomain). */
export function claimable(hostname: string, rules: HostRules): boolean {
  const k = classifyHost(hostname, rules);
  if (k.kind !== "custom") return false;
  const sd = rules.storefrontDomain ? bare(rules.storefrontDomain) : "";
  const app = bare(rules.appHost);
  return !(sd && hostname.endsWith(`.${sd}`)) && !hostname.endsWith(`.${app}`);
}

/** Paths that belong to the staff console and sign-in: on a storefront host they go to the app. */
export const appOnlyPath = (path: string) => /^\/(m|me)(\/|$)/.test(path) || path.startsWith("/api/auth/") || path.startsWith("/api/m/") || path === "/mcp";

export type DomainStatus = "pending" | "active" | "failed";

/** A DNS record the restaurant adds at its domain provider. */
export interface DnsRecord {
  type: "CNAME" | "TXT";
  name: string;
  value: string;
  /** Why it's there: routing the address here, or proving it's theirs / issuing the certificate. */
  purpose: "route" | "verify";
}

export interface CustomDomain {
  hostname: string;
  status: DomainStatus;
  records: DnsRecord[];
  detail: string;
  createdAt: number;
  checkedAt: number | null;
}

/** Every address a storefront answers on, best first. */
export function storefrontUrls(slug: string, appUrl: string, storefrontDomain: string | undefined, domains: Pick<CustomDomain, "hostname" | "status">[]) {
  const live = domains.filter((d) => d.status === "active").map((d) => `https://${d.hostname}`);
  const sub = storefrontDomain && subdomainOk(slug) ? `https://${slug}.${bare(storefrontDomain)}` : null;
  const path = `${appUrl.replace(/\/$/, "")}/at/${slug}`;
  return { primary: live[0] ?? sub ?? path, subdomain: sub, path, custom: live };
}

/** A Cloudflare for SaaS custom hostname, as its API returns it (the parts we read). */
export interface ProviderHost {
  id: string;
  hostname: string;
  status: string;
  ssl?: { status?: string; validation_records?: { txt_name?: string; txt_value?: string }[]; validation_errors?: { message: string }[] };
  ownership_verification?: { type?: string; name?: string; value?: string };
  verification_errors?: string[];
}

/** Our reading of Cloudflare's state, and the records the restaurant still has to add. */
export function readProvider(h: ProviderHost, target: string): { status: DomainStatus; records: DnsRecord[]; detail: string } {
  const ssl = h.ssl?.status ?? "";
  const records: DnsRecord[] = [{ type: "CNAME", name: h.hostname, value: target, purpose: "route" }];
  if (h.ownership_verification?.name && h.ownership_verification.value) records.push({ type: "TXT", name: h.ownership_verification.name, value: h.ownership_verification.value, purpose: "verify" });
  for (const r of h.ssl?.validation_records ?? []) if (r.txt_name && r.txt_value) records.push({ type: "TXT", name: r.txt_name, value: r.txt_value, purpose: "verify" });
  const errors = [...(h.verification_errors ?? []), ...(h.ssl?.validation_errors ?? []).map((e) => e.message)].filter(Boolean);
  if (h.status === "active" && ssl === "active") return { status: "active", records: records.slice(0, 1), detail: "" };
  if (["blocked", "moved", "deleted"].includes(h.status) || ["validation_timed_out", "issuance_timed_out", "deleted"].includes(ssl)) return { status: "failed", records, detail: errors[0] ?? `Cloudflare: ${h.status === "pending" ? ssl : h.status}` };
  return { status: "pending", records, detail: errors[0] ?? "" };
}
