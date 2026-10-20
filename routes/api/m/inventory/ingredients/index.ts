// The restaurant's ingredients: anyone who works with stock reads them; managers add them.
import { api, body } from "../../../../../src/server/http";
import { actorOf, staffTenant } from "../../../../../src/server/routing";
import { createIngredient, listIngredients, requireStockAccess } from "../../../../../src/server/domain/inventory";
import { IngredientInput } from "../../../../../src/server/schemas";

export const GET = api(async (c) => {
  const s = await staffTenant(c, null);
  requireStockAccess(s);
  return listIngredients(c.env.DB, s.tenantId);
});

export const POST = api(async (c) => {
  const s = await staffTenant(c, "inventory.manage");
  const input = await body(c, IngredientInput);
  return c.json(await createIngredient(c.env.DB, s.tenantId, actorOf(s), input), 201);
});
