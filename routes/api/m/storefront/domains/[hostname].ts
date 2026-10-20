// One of the restaurant's own web addresses: check where it stands now, or remove it.
import { api } from "../../../../../src/server/http";
import { actorOf, staffTenant } from "../../../../../src/server/routing";
import { checkDomain, removeDomain } from "../../../../../src/server/domain/domains";

export const POST = api(async (c) => {
  const s = await staffTenant(c, "settings.manage");
  return checkDomain(c.env.DB, s.tenantId, c.req.param("hostname")!);
});

export const DELETE = api(async (c) => {
  const s = await staffTenant(c, "settings.manage");
  await removeDomain(c.env.DB, s.tenantId, actorOf(s), c.req.param("hostname")!);
  return { ok: true };
});
