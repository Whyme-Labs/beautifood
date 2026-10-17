import { api } from "../../../src/server/http";
import { appEnv } from "../../../src/server/appenv";
import { verify } from "../../../src/server/sign";

export const GET = api(async (c) => {
  const tok = await verify(appEnv().TOKEN_SECRET, c.req.query("t"), "member");
  if (!tok) return c.html("<p>This unsubscribe link is invalid or expired.</p>", 400);
  await c.env.DB.prepare("UPDATE members SET opt_in = 0 WHERE tenant_id = ? AND email = ?").bind(tok.t, tok.email).run();
  return c.html("<p style='font-family:sans-serif'>You're unsubscribed from promotional emails. Receipts and table notifications still arrive.</p>");
});
