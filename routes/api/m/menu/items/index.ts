import { api, body } from "../../../../../src/server/http";
import { actorOf, staffTenant } from "../../../../../src/server/routing";
import { upsertItem } from "../../../../../src/server/domain/menu";
import { ItemInput } from "../../../../../src/server/menuSchemas";

export const POST = api(async (c) => {
  const s = await staffTenant(c, "menu.manage");
  return c.json(await upsertItem(c.env.DB, s.tenantId, actorOf(s), await body(c, ItemInput)), 201);
});
