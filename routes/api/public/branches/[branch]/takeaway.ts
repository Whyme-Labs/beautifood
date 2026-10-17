// Start a takeaway order cart.
import { api } from "../../../../../src/server/http";
import { appEnv } from "../../../../../src/server/appenv";
import { getBranch } from "../../../../../src/server/domain/context";
import { openSession } from "../../../../../src/server/domain/orders";
import { fail } from "../../../../../src/server/errors";
import { sign } from "../../../../../src/server/sign";

export const POST = api(async (c) => {
  const ctx = await getBranch(c.env.DB, c.req.param("branch")!);
  if (!ctx.branch.active) fail(409, "branch_closed", "This branch is closed");
  const sessionId = await openSession(c.env.DB, ctx, "takeaway", null);
  const token = await sign(appEnv().TOKEN_SECRET, { k: "session", id: sessionId, b: ctx.branch.id });
  return c.json({ sessionId, token, url: `/s/${sessionId}?k=${encodeURIComponent(token)}` }, 201);
});
