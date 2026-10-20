// The storefront's web addresses: its subdomain, and the restaurant's own domains (add one here).
import { z } from "zod";
import { env } from "void/env";
import { api, body } from "../../../../../src/server/http";
import { actorOf, staffTenant } from "../../../../../src/server/routing";
import { addDomain, cnameTarget, hostnames, listDomains } from "../../../../../src/server/domain/domains";
import { storefrontUrls } from "../../../../../src/shared/domains";

export const GET = api(async (c) => {
  const s = await staffTenant(c, "settings.manage");
  const [domains, t] = await Promise.all([listDomains(c.env.DB, s.tenantId), c.env.DB.prepare("SELECT slug FROM tenants WHERE id = ?").bind(s.tenantId).first<{ slug: string }>()]);
  return { domains, target: cnameTarget(), available: !!hostnames(), urls: storefrontUrls(t!.slug, env.PUBLIC_URL, env.STOREFRONT_DOMAIN, domains) };
});

export const POST = api(async (c) => {
  const s = await staffTenant(c, "settings.manage");
  const { hostname } = await body(c, z.object({ hostname: z.string().min(3).max(260) }));
  return addDomain(c.env.DB, s.tenantId, actorOf(s), hostname);
});
