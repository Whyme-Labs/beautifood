import { api } from "../../../../../src/server/http";
import { customerToken } from "../../../../../src/server/routing";
import { appEnv } from "../../../../../src/server/appenv";
import { getBranch } from "../../../../../src/server/domain/context";
import { getBooking } from "../../../../../src/server/domain/bookings";
import { openSession } from "../../../../../src/server/domain/orders";
import { sign } from "../../../../../src/server/sign";

export const POST = api(async (c) => {
  const id = c.req.param("id")!;
  const tok = await customerToken(c, "booking", id);
  const ctx = await getBranch(c.env.DB, tok.b);
  const b = await getBooking(c.env.DB, id);
  const sessionId = b.session_id ?? (await openSession(c.env.DB, ctx, "booking", id));
  const token = await sign(appEnv().TOKEN_SECRET, { k: "session", id: sessionId, b: ctx.branch.id });
  return c.json({ sessionId, token, url: `/s/${sessionId}?k=${encodeURIComponent(token)}` }, 201);
});
