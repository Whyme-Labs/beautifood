// The branch's taste brief (Qloo through the taste service): what the area loves, and what to try.
import { env } from "void/env";
import { api } from "../../../../../src/server/http";
import { fail } from "../../../../../src/server/errors";
import { staffBranch } from "../../../../../src/server/routing";
import { branchTasteBrief, tasteEnabled } from "../../../../../src/server/taste";

export const GET = api(async (c) => {
  const { ctx } = await staffBranch(c, "report.view");
  if (!tasteEnabled(env)) fail(409, "taste_off", "Taste insights aren't set up on this deployment");
  const location = c.req.query("location")?.slice(0, 120);
  return branchTasteBrief(c.env.DB, env, ctx, { location, refresh: c.req.query("refresh") === "1" });
});
