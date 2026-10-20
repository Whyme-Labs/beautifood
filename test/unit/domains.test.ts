import { describe, expect, it } from "vitest";
import { appOnlyPath, classifyHost, claimable, cleanHostname, readProvider, storefrontUrls, subdomainOk } from "../../src/shared/domains";

const rules = { storefrontDomain: "beautifood.store", appHost: "beautifood-app.team.workers.dev" };

describe("storefront hosts", () => {
  it("knows the app, a restaurant's subdomain, and anything else", () => {
    expect(classifyHost("beautifood-app.team.workers.dev", rules)).toEqual({ kind: "app" });
    expect(classifyHost("localhost:5173", rules)).toEqual({ kind: "app" });
    expect(classifyHost("127.0.0.1:5190", rules)).toEqual({ kind: "app" });
    expect(classifyHost("beautifood.store", rules)).toEqual({ kind: "app" });
    expect(classifyHost("www.beautifood.store", rules)).toEqual({ kind: "app" });
    expect(classifyHost("Ah-Seng.beautifood.store:443", rules)).toEqual({ kind: "subdomain", slug: "ah-seng" });
    // reserved names and nested subdomains are never a restaurant
    expect(classifyHost("api.beautifood.store", rules)).toEqual({ kind: "app" });
    expect(classifyHost("a.b.beautifood.store", rules)).toEqual({ kind: "app" });
    expect(classifyHost("www.ahseng.com.my", rules)).toEqual({ kind: "custom", hostname: "www.ahseng.com.my" });
    // with no storefront domain, nothing is a subdomain
    expect(classifyHost("ah-seng.beautifood.store", { appHost: rules.appHost })).toEqual({ kind: "custom", hostname: "ah-seng.beautifood.store" });
  });

  it("only takes slugs that work as one DNS label", () => {
    expect(subdomainOk("ah-seng")).toBe(true);
    expect(subdomainOk("-ah")).toBe(false);
    expect(subdomainOk("ah-")).toBe(false);
    expect(subdomainOk("www")).toBe(false);
    expect(subdomainOk("a".repeat(64))).toBe(false);
  });

  it("reads what people type as a web address", () => {
    expect(cleanHostname("https://WWW.AhSeng.com.my/menu?x=1")).toBe("www.ahseng.com.my");
    expect(cleanHostname("order.ahseng.com.")).toBe("order.ahseng.com");
    expect(cleanHostname("  www.ahseng.com  ")).toBe("www.ahseng.com");
    expect(cleanHostname("www.肉骨茶.com")).toMatch(/^www\.xn--[a-z0-9]+\.com$/);
    for (const bad of ["", "localhost", "ahseng", "1.2.3.4", "www.ahseng.com:8080", "user@www.ahseng.com", "-x.com", "a..com", "ahseng.123"]) expect(cleanHostname(bad), bad).toBeNull();
  });

  it("won't let a restaurant claim the platform's addresses", () => {
    expect(claimable("www.ahseng.com", rules)).toBe(true);
    expect(claimable("ah-seng.beautifood.store", rules)).toBe(false);
    expect(claimable("api.beautifood.store", rules)).toBe(false);
    expect(claimable("beautifood.store", rules)).toBe(false);
    expect(claimable("x.beautifood-app.team.workers.dev", rules)).toBe(false);
  });

  it("keeps the staff console and sign-in on the app", () => {
    for (const p of ["/m", "/m/pos", "/me", "/api/auth/sign-in/email", "/api/m/storefront", "/mcp"]) expect(appOnlyPath(p), p).toBe(true);
    for (const p of ["/", "/r/x~y/menu", "/t/abc", "/api/public/storefronts/x", "/menu", "/mex"]) expect(appOnlyPath(p), p).toBe(false);
  });

  it("puts the restaurant's own live domain first, then its subdomain, then the page on the app", () => {
    const app = "https://beautifood-app.team.workers.dev/";
    expect(storefrontUrls("ah-seng", app, undefined, []).primary).toBe("https://beautifood-app.team.workers.dev/at/ah-seng");
    expect(storefrontUrls("ah-seng", app, "beautifood.store", []).primary).toBe("https://ah-seng.beautifood.store");
    const u = storefrontUrls("ah-seng", app, "beautifood.store", [
      { hostname: "pending.ahseng.com", status: "pending" },
      { hostname: "www.ahseng.com", status: "active" },
    ]);
    expect(u).toEqual({ primary: "https://www.ahseng.com", subdomain: "https://ah-seng.beautifood.store", path: "https://beautifood-app.team.workers.dev/at/ah-seng", custom: ["https://www.ahseng.com"] });
  });
});

describe("Cloudflare custom hostname state", () => {
  const target = "stores.beautifood.store";
  it("is pending with the records to add until both the hostname and its certificate are active", () => {
    const r = readProvider(
      {
        id: "1",
        hostname: "www.ahseng.com",
        status: "pending",
        ownership_verification: { type: "txt", name: "_cf-custom-hostname.www.ahseng.com", value: "abc" },
        ssl: { status: "pending_validation", validation_records: [{ txt_name: "_acme-challenge.www.ahseng.com", txt_value: "def" }] },
      },
      target,
    );
    expect(r.status).toBe("pending");
    expect(r.records).toEqual([
      { type: "CNAME", name: "www.ahseng.com", value: target, purpose: "route" },
      { type: "TXT", name: "_cf-custom-hostname.www.ahseng.com", value: "abc", purpose: "verify" },
      { type: "TXT", name: "_acme-challenge.www.ahseng.com", value: "def", purpose: "verify" },
    ]);
    expect(readProvider({ id: "1", hostname: "www.ahseng.com", status: "active", ssl: { status: "pending_validation" } }, target).status).toBe("pending");
  });

  it("is active once both are, keeping only the routing record", () => {
    const r = readProvider({ id: "1", hostname: "www.ahseng.com", status: "active", ssl: { status: "active" } }, target);
    expect(r).toEqual({ status: "active", records: [{ type: "CNAME", name: "www.ahseng.com", value: target, purpose: "route" }], detail: "" });
  });

  it("has failed when Cloudflare blocks it or gives up on the certificate, with its reason", () => {
    expect(readProvider({ id: "1", hostname: "x.com", status: "blocked", verification_errors: ["Hostname is blocked"] }, target)).toMatchObject({ status: "failed", detail: "Hostname is blocked" });
    expect(readProvider({ id: "1", hostname: "x.com", status: "pending", ssl: { status: "validation_timed_out", validation_errors: [{ message: "CAA records block issuance" }] } }, target)).toMatchObject({ status: "failed", detail: "CAA records block issuance" });
    expect(readProvider({ id: "1", hostname: "x.com", status: "pending", ssl: { status: "validation_timed_out" } }, target).detail).toBe("Cloudflare: validation_timed_out");
  });
});
