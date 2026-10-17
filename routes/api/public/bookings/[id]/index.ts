import { api } from "../../../../../src/server/http";
import { customerToken, kick } from "../../../../../src/server/routing";
import { appEnv } from "../../../../../src/server/appenv";
import { getBranch } from "../../../../../src/server/domain/context";
import { getBooking, setBookingStatus, toBooking } from "../../../../../src/server/domain/bookings";
import { sign } from "../../../../../src/server/sign";

export const GET = api(async (c) => {
  const id = c.req.param("id")!;
  const tok = await customerToken(c, "booking", id);
  const ctx = await getBranch(c.env.DB, tok.b);
  const b = toBooking(await getBooking(c.env.DB, id));
  const preorder = b.sessionId ? `/s/${b.sessionId}?k=${encodeURIComponent(await sign(appEnv().TOKEN_SECRET, { k: "session", id: b.sessionId, b: ctx.branch.id }))}` : null;
  return { ...b, phone: undefined, branch: { id: ctx.branch.id, name: ctx.branch.name, restaurant: ctx.tenant.name, timezone: ctx.config.timezone }, preorderUrl: preorder };
});

export const DELETE = api(async (c) => {
  const id = c.req.param("id")!;
  const tok = await customerToken(c, "booking", id);
  await setBookingStatus(c.env.DB, await getBranch(c.env.DB, tok.b), "guest", id, "cancelled");
  kick(c);
  return { cancelled: true };
});
