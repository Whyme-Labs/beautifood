import { api } from "../../../../../src/server/http";
import { actorOf, staffTenant } from "../../../../../src/server/routing";
import { deleteCategory } from "../../../../../src/server/domain/menu";

export const DELETE = api(async (c) => {
  const s = await staffTenant(c, "menu.manage");
  await deleteCategory(c.env.DB, s.tenantId, actorOf(s), c.req.param("id")!);
  return { ok: true };
});
