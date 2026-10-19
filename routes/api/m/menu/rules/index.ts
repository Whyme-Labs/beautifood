import { api, body } from "../../../../../src/server/http";
import { actorOf, staffTenant } from "../../../../../src/server/routing";
import { savePriceRule } from "../../../../../src/server/domain/menu";
import { PriceRuleInput } from "../../../../../src/server/menuSchemas";

/** Create or update a price rule: a happy hour or any other timed price. */
export const POST = api(async (c) => {
  const s = await staffTenant(c, "menu.manage");
  return c.json(await savePriceRule(c.env.DB, s.tenantId, actorOf(s), await body(c, PriceRuleInput)), 201);
});
