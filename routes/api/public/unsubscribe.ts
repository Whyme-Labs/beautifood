import { api } from "../../../src/server/http";
import { appEnv } from "../../../src/server/appenv";
import { verify } from "../../../src/server/sign";
import type { Ctx } from "../../../src/server/http";

async function unsubscribe(c: Ctx) {
  const tok = await verify(appEnv().TOKEN_SECRET, c.req.query("t"), "member");
  if (!tok) return null;
  await c.env.DB.prepare("UPDATE members SET opt_in = 0 WHERE tenant_id = ? AND email = ?").bind(tok.t, tok.email).run();
  return tok;
}

// The link in the email footer.
export const GET = api(async (c) => {
  if (!(await unsubscribe(c))) return c.html("<p>This unsubscribe link is invalid or expired.</p>", 400);
  return c.html("<p style='font-family:sans-serif'>You're unsubscribed from promotional emails. Receipts and table notifications still arrive.</p>");
});

// One-click unsubscribe (RFC 8058): mail clients POST to the List-Unsubscribe URL.
export const POST = api(async (c) => {
  if (!(await unsubscribe(c))) return c.json({ error: { code: "invalid_token", message: "This unsubscribe link is invalid or expired." } }, 400);
  return { unsubscribed: true };
});
