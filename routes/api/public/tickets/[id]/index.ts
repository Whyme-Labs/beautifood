// A queue ticket, authorized by its signed link (no account needed).
import { api } from "../../../../../src/server/http";
import { customerToken, kick } from "../../../../../src/server/routing";
import { getBranch } from "../../../../../src/server/domain/context";
import { cancelTicket, ticketView } from "../../../../../src/server/domain/floor";
import { appEnv } from "../../../../../src/server/appenv";
import { sign } from "../../../../../src/server/sign";

export const GET = api(async (c) => {
  const id = c.req.param("id")!;
  const tok = await customerToken(c, "ticket", id);
  const ctx = await getBranch(c.env.DB, tok.b);
  const view = await ticketView(c.env.DB, ctx, id);
  // once seated, hand the guest their table's cart link (dynamic QR delivered to their phone)
  const tableLink = view.seating ? `/s/${view.seating.sessionId}?k=${encodeURIComponent(await sign(appEnv().TOKEN_SECRET, { k: "session", id: view.seating.sessionId, b: ctx.branch.id }))}` : null;
  let preorder: { sessionId: string; url: string } | null = null;
  if (view.sessionId && view.status !== "seated") {
    const t = await sign(appEnv().TOKEN_SECRET, { k: "session", id: view.sessionId, b: ctx.branch.id });
    preorder = { sessionId: view.sessionId, url: `/s/${view.sessionId}?k=${encodeURIComponent(t)}` };
  }
  return { ...view, tableLink, preorder };
});

export const DELETE = api(async (c) => {
  const id = c.req.param("id")!;
  const tok = await customerToken(c, "ticket", id);
  await cancelTicket(c.env.DB, await getBranch(c.env.DB, tok.b), "guest", id);
  kick(c);
  return { cancelled: true };
});
