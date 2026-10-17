// AI operational insights from the day's report (facts computed; Claude narrates when configured).
import { api } from "../../../../../src/server/http";
import { staffBranch, today } from "../../../../../src/server/routing";
import { branchReport } from "../../../../../src/server/domain/reports";
import { insights } from "../../../../../src/server/ai";
import { appEnv } from "../../../../../src/server/appenv";

export const GET = api(async (c) => {
  const { ctx } = await staffBranch(c, "report.view");
  return insights(appEnv(), ctx, await branchReport(c.env.DB, ctx, c.req.query("day") || today(ctx)));
});
