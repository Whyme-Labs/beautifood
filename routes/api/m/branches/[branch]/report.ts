import { api } from "../../../../../src/server/http";
import { staffBranch, today } from "../../../../../src/server/routing";
import { branchReport } from "../../../../../src/server/domain/reports";

export const GET = api(async (c) => {
  const { ctx } = await staffBranch(c, "report.view");
  return branchReport(c.env.DB, ctx, c.req.query("day") || today(ctx));
});
