import { expect, test } from "@playwright/test";
import { errorOf, guestClient, hire, json, seed, uid } from "../helpers";

// The e2e server runs with STOREFRONT_DOMAIN=stores.test and the stand-in for Cloudflare for SaaS
// (src/server/domain/domains.ts): an address goes live on its first check, "pending." ones never do.
const at = (host: string) => ({ headers: { host }, maxRedirects: 0 });

test("storefront hosts: a restaurant's subdomain serves its page; the staff console stays on the app", async () => {
  const s = await seed();
  const guest = await guestClient();
  const home = await guest.get("/", at(`${s.slug}.stores.test`));
  expect(home.status()).toBe(200);
  const html = await home.text();
  expect(html).toContain('data-testid="storefront"');
  expect(html).toContain(`<link rel="canonical" href="https://${s.slug}.stores.test"`);
  // the same page under its app path moves to the subdomain's root
  const old = await guest.get(`/at/${s.slug}`, at(`${s.slug}.stores.test`));
  expect(old.status()).toBe(301);
  expect(old.headers().location).toBe("/");
  // ordering pages work there; the staff console and sign-in go to the app
  expect((await guest.get(`/r/${s.klcc.ref}/menu`, at(`${s.slug}.stores.test`))).status()).toBe(200);
  const console_ = await guest.get("/m/pos?x=1", at(`${s.slug}.stores.test`));
  expect(console_.status()).toBe(302);
  expect(console_.headers().location).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/m\/pos\?x=1$/);
  expect((await guest.post("/api/auth/sign-in/email", { ...at(`${s.slug}.stores.test`), data: {} })).status()).toBe(302);
  // the app's own host is unchanged, and an unknown subdomain isn't a restaurant
  expect(await (await guest.get("/")).text()).not.toContain('data-testid="storefront"');
  expect((await guest.get("/", at(`nobody-${uid("")}.stores.test`))).status()).toBe(200);
  expect(await (await guest.get("/", at("api.stores.test"))).text()).not.toContain('data-testid="storefront"');
});

test("custom domains: connect, see the DNS records, go live, and stop", async () => {
  const s = await seed();
  const guest = await guestClient();
  const host = `www.${uid("r").toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;

  const before = await json(s.owner.get("/api/m/storefront/domains"));
  expect(before).toMatchObject({ domains: [], available: true, urls: { primary: `https://${s.slug}.stores.test`, subdomain: `https://${s.slug}.stores.test` } });

  const added = await json(s.owner.post("/api/m/storefront/domains", { data: { hostname: `https://${host.toUpperCase()}/menu` } }));
  expect(added).toMatchObject({ hostname: host, status: "pending" });
  expect(added.records[0]).toEqual({ type: "CNAME", name: host, value: before.target, purpose: "route" });
  expect(added.records.some((r: any) => r.type === "TXT")).toBe(true);
  // not served until it's live
  expect(await (await guest.get("/", at(host))).text()).not.toContain('data-testid="storefront"');

  const live = await json(s.owner.post(`/api/m/storefront/domains/${host}`));
  expect(live).toMatchObject({ hostname: host, status: "active", detail: "" });
  expect(live.records).toHaveLength(1);
  const page = await (await guest.get("/", at(host))).text();
  expect(page).toContain('data-testid="storefront"');
  expect(page).toContain(`<link rel="canonical" href="https://${host}"`);
  expect((await json(s.owner.get("/api/m/storefront"))).url).toBe(`https://${host}`);

  // one address, one restaurant; the platform's names aren't anyone's
  const other = await seed();
  expect((await errorOf(other.owner.post("/api/m/storefront/domains", { data: { hostname: host } }), 409)).code).toBe("domain_taken");
  expect((await errorOf(s.owner.post("/api/m/storefront/domains", { data: { hostname: host } }), 409)).code).toBe("domain_exists");
  expect((await errorOf(s.owner.post("/api/m/storefront/domains", { data: { hostname: `${other.slug}.stores.test` } }), 400)).code).toBe("domain_reserved");
  expect((await errorOf(s.owner.post("/api/m/storefront/domains", { data: { hostname: "not a domain" } }), 400)).code).toBe("invalid_domain");
  // the restaurant can't touch another's address
  await errorOf(other.owner.delete(`/api/m/storefront/domains/${host}`), 404);

  // one that never verifies stays pending; one Cloudflare refuses says why
  const waiting = await json(s.owner.post("/api/m/storefront/domains", { data: { hostname: `pending.${host.slice(4)}` } }));
  expect((await json(s.owner.post(`/api/m/storefront/domains/${waiting.hostname}`))).status).toBe("pending");
  const broken = await json(s.owner.post("/api/m/storefront/domains", { data: { hostname: `broken.${host.slice(4)}` } }));
  expect(await json(s.owner.post(`/api/m/storefront/domains/${broken.hostname}`))).toMatchObject({ status: "failed", detail: "CAA records block certificate issuance" });
  // three at most
  expect((await errorOf(s.owner.post("/api/m/storefront/domains", { data: { hostname: `order.${host.slice(4)}` } }), 409)).code).toBe("too_many_domains");

  // only people who manage settings
  const waiter = await hire(s.owner, "waiter", [s.klcc.id]);
  await errorOf(waiter.api.post("/api/m/storefront/domains", { data: { hostname: `menu.${host.slice(4)}` } }), 403);
  await errorOf(waiter.api.delete(`/api/m/storefront/domains/${host}`), 403);

  // removed: the address stops serving the page
  await json(s.owner.delete(`/api/m/storefront/domains/${host}`));
  expect(await (await guest.get("/", at(host))).text()).not.toContain('data-testid="storefront"');
  expect((await json(s.owner.get("/api/m/storefront/domains"))).domains.map((d: any) => d.hostname)).toEqual([waiting.hostname, broken.hostname]);
});

test("restaurant web addresses never take the platform's names", async () => {
  const s = await seed();
  expect((await errorOf(s.owner.post("/api/m/tenants", { data: { name: "API", slug: "api" } }), 400)).code).toBe("slug_reserved");
  // a name that slugs to one gets a different address
  const t = await json(s.owner.post("/api/m/tenants", { data: { name: "WWW" } }), 201);
  expect(t.slug).toMatch(/^www-eats/);
});
