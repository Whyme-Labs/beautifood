// Make the draft the live storefront.
import { api } from "../../../../src/server/http";
import { actorOf, staffTenant } from "../../../../src/server/routing";
import { getStorefront, publish } from "../../../../src/server/domain/storefront";

export const POST = api(async (c) => {
  const s = await staffTenant(c, "settings.manage");
  await publish(c.env.DB, s.tenantId, actorOf(s));
  return getStorefront(c.env.DB, s.tenantId);
});
