import { api } from "../../../../../src/server/http";
import { actorOf, staffTenant } from "../../../../../src/server/routing";
import { deletePriceRule } from "../../../../../src/server/domain/menu";

export const DELETE = api(async (c) => {
  const s = await staffTenant(c, "menu.manage");
  await deletePriceRule(c.env.DB, s.tenantId, actorOf(s), c.req.param("id")!);
  return { ok: true };
});
