import { api } from "../../../../src/server/http";
import { staffBranch, staffTenant } from "../../../../src/server/routing";
import { getMenu, menuAt } from "../../../../src/server/domain/menu";

/** The whole menu for the editor; with `now=1` and a branch, as it stands there now (the till). */
export const GET = api(async (c) => {
  const branch = c.req.query("branch") || null;
  if (branch && c.req.query("now")) {
    const { ctx } = await staffBranch(c, null, branch);
    return menuAt(c.env.DB, ctx, Date.now(), true);
  }
  const s = await staffTenant(c, null);
  return getMenu(c.env.DB, s.tenantId, branch, true);
});
