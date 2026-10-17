import { api } from "../../../../../../src/server/http";
import { staffBranch } from "../../../../../../src/server/routing";
import { kitchenBoard } from "../../../../../../src/server/domain/orders";

export const GET = api(async (c) => {
  const { ctx } = await staffBranch(c, "kds.operate");
  return kitchenBoard(c.env.DB, ctx.branch.id, c.req.query("station") || null);
});
