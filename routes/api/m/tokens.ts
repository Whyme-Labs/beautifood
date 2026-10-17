// Personal access tokens so a merchant's own AI agent can use the MCP server.
import { z } from "zod";
import { api, body } from "../../../src/server/http";
import { staffTenant } from "../../../src/server/routing";
import { newId, randomToken } from "../../../src/server/ids";
import { sha256Hex } from "../../../src/server/sign";
import { fail } from "../../../src/server/errors";

export const GET = api(async (c) => {
  const s = await staffTenant(c, null);
  return (await c.env.DB.prepare("SELECT id, name, created_at, last_used_at FROM api_tokens WHERE user_id = ? AND tenant_id = ?").bind(s.userId, s.tenantId).all()).results;
});

export const POST = api(async (c) => {
  const s = await staffTenant(c, null);
  if (s.via === "token") fail(403, "forbidden", "Create tokens from the dashboard");
  const { name } = await body(c, z.object({ name: z.string().min(1).max(40) }));
  const token = `bf_pat_${randomToken(24)}`;
  await c.env.DB.prepare("INSERT INTO api_tokens (id, user_id, tenant_id, name, token_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(newId("pat_"), s.userId, s.tenantId, name, await sha256Hex(token), Date.now()).run();
  return c.json({ token, note: "Shown once. Use as: Authorization: Bearer <token>" }, 201);
});

export const DELETE = api(async (c) => {
  const s = await staffTenant(c, null);
  await c.env.DB.prepare("DELETE FROM api_tokens WHERE id = ? AND user_id = ?").bind(c.req.query("id") ?? "", s.userId).run();
  return { ok: true };
});
