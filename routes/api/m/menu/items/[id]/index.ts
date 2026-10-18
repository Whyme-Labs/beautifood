import { api, body } from "../../../../../../src/server/http";
import { actorOf, staffTenant } from "../../../../../../src/server/routing";
import { deleteItem, upsertItem } from "../../../../../../src/server/domain/menu";
import { ItemInput } from "../../../../../../src/server/menuSchemas";
import { notFound } from "../../../../../../src/server/errors";

export const PUT = api(async (c) => {
  const s = await staffTenant(c, "menu.manage");
  const id = c.req.param("id")!;
  if (!(await c.env.DB.prepare("SELECT 1 FROM menu_items WHERE id = ? AND tenant_id = ?").bind(id, s.tenantId).first())) notFound("Item");
  return upsertItem(c.env.DB, s.tenantId, actorOf(s), { ...(await body(c, ItemInput)), id });
});

export const DELETE = api(async (c) => {
  const s = await staffTenant(c, "menu.manage");
  await deleteItem(c.env.DB, s.tenantId, actorOf(s), c.req.param("id")!);
  return { ok: true };
});
