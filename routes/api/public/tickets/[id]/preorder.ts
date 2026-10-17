// Start ordering while waiting in the queue; the order moves onto the table's bill when seated.
import { api } from "../../../../../src/server/http";
import { customerToken } from "../../../../../src/server/routing";
import { appEnv } from "../../../../../src/server/appenv";
import { getBranch } from "../../../../../src/server/domain/context";
import { getTicket } from "../../../../../src/server/domain/floor";
import { openSession } from "../../../../../src/server/domain/orders";
import { fail } from "../../../../../src/server/errors";
import { sign } from "../../../../../src/server/sign";

export const POST = api(async (c) => {
  const id = c.req.param("id")!;
  const tok = await customerToken(c, "ticket", id);
  const ctx = await getBranch(c.env.DB, tok.b);
  if (!ctx.config.modules.queuePreorder) fail(409, "preorder_off", "Preordering isn't available at this branch");
  const t = await getTicket(c.env.DB, id);
  const sessionId = t.session_id ?? (await openSession(c.env.DB, ctx, "queue", id));
  const token = await sign(appEnv().TOKEN_SECRET, { k: "session", id: sessionId, b: ctx.branch.id });
  return c.json({ sessionId, token, url: `/s/${sessionId}?k=${encodeURIComponent(token)}` }, 201);
});
