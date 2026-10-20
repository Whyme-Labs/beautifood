// The stock ledger at this branch, newest first: ?ingredient=ing_… for one ingredient, ?limit= up to 200.
import { api } from "../../../../../../src/server/http";
import { staffBranch } from "../../../../../../src/server/routing";
import { listMovements, requireStockAccess } from "../../../../../../src/server/domain/inventory";

export const GET = api(async (c) => {
  const { staff, ctx } = await staffBranch(c, null);
  requireStockAccess(staff);
  const limit = Math.min(200, Math.max(1, Number(c.req.query("limit")) || 50));
  return listMovements(c.env.DB, ctx, c.req.query("ingredient") || null, limit);
});
