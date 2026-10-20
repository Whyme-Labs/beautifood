// A dish's recipe: { lines: [{ ingredientId, qty }] }, qty per serving in the ingredient's unit.
import { z } from "zod";
import { api, body } from "../../../../../src/server/http";
import { actorOf, staffTenant } from "../../../../../src/server/routing";
import { getRecipe, requireStockAccess, setRecipe } from "../../../../../src/server/domain/inventory";
import { MAX_QTY, MAX_RECIPE_LINES } from "../../../../../src/shared/inventory";
import { notFound } from "../../../../../src/server/errors";

export const GET = api(async (c) => {
  const s = await staffTenant(c, null);
  requireStockAccess(s);
  const id = c.req.param("item")!;
  if (!(await c.env.DB.prepare("SELECT 1 FROM menu_items WHERE id = ? AND tenant_id = ?").bind(id, s.tenantId).first())) notFound("Dish");
  return getRecipe(c.env.DB, s.tenantId, id);
});

export const PUT = api(async (c) => {
  const s = await staffTenant(c, "inventory.manage");
  const { lines } = await body(c, z.object({ lines: z.array(z.object({ ingredientId: z.string().max(40), qty: z.number().positive().max(MAX_QTY) })).max(MAX_RECIPE_LINES) }));
  return setRecipe(c.env.DB, s.tenantId, actorOf(s), c.req.param("item")!, lines);
});
