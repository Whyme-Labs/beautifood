// One ingredient: rename, re-cost or change its unit (while unused); or remove it from every recipe.
import { api, body } from "../../../../../src/server/http";
import { actorOf, staffTenant } from "../../../../../src/server/routing";
import { deleteIngredient, updateIngredient } from "../../../../../src/server/domain/inventory";
import { IngredientInput } from "../../../../../src/server/schemas";

export const PATCH = api(async (c) => {
  const s = await staffTenant(c, "inventory.manage");
  const input = await body(c, IngredientInput.partial());
  return updateIngredient(c.env.DB, s.tenantId, actorOf(s), c.req.param("id")!, input);
});

export const DELETE = api(async (c) => {
  const s = await staffTenant(c, "inventory.manage");
  await deleteIngredient(c.env.DB, s.tenantId, actorOf(s), c.req.param("id")!);
  return { ok: true };
});
