import { api } from "../../../../src/server/http";
import { staffTenant } from "../../../../src/server/routing";
import { getMenu } from "../../../../src/server/domain/menu";

export const GET = api(async (c) => {
  const s = await staffTenant(c, null);
  return getMenu(c.env.DB, s.tenantId, c.req.query("branch") || null, true);
});
