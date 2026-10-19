import { api, body } from "../../../../../src/server/http";
import { actorOf, staffTenant } from "../../../../../src/server/routing";
import { saveTimedMenu } from "../../../../../src/server/domain/menu";
import { TimedMenuInput } from "../../../../../src/server/menuSchemas";

/** Create or update a timed menu (Breakfast, Lunch…) and when it is served. */
export const POST = api(async (c) => {
  const s = await staffTenant(c, "menu.manage");
  return c.json(await saveTimedMenu(c.env.DB, s.tenantId, actorOf(s), await body(c, TimedMenuInput)), 201);
});
