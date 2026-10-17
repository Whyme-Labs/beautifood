import { z } from "zod";
import { api, body } from "../../../../src/server/http";
import { appEnv } from "../../../../src/server/appenv";
import { getTenant } from "../../../../src/server/domain/context";
import { ensureMember, toMember } from "../../../../src/server/domain/loyalty";
import { fail } from "../../../../src/server/errors";
import { sha256Hex, sign } from "../../../../src/server/sign";

export const POST = api(async (c) => {
  const { email, tenant, code, name } = await body(c, z.object({ email: z.string().trim().email(), tenant: z.string(), code: z.string().regex(/^\d{6}$/), name: z.string().max(60).optional() }));
  const t = await getTenant(c.env.DB, tenant);
  const key = `${t.id}:${email.toLowerCase()}`;
  const row = await c.env.DB.prepare("SELECT code_hash, expires_at, attempts FROM otp_codes WHERE email = ?").bind(key).first<{ code_hash: string; expires_at: number; attempts: number }>();
  if (!row || row.expires_at < Date.now() || row.attempts >= 5) fail(401, "code_expired", "That code has expired. Request a new one.");
  if ((await sha256Hex(`${key}:${code}`)) !== row.code_hash) {
    await c.env.DB.prepare("UPDATE otp_codes SET attempts = attempts + 1 WHERE email = ?").bind(key).run();
    fail(401, "wrong_code", "That code isn't right");
  }
  await c.env.DB.prepare("DELETE FROM otp_codes WHERE email = ?").bind(key).run();
  const m = await ensureMember(c.env.DB, t.id, email, { name });
  const token = await sign(appEnv().TOKEN_SECRET, { k: "member", t: t.id, email: m.email, exp: Date.now() + 30 * 86_400_000 });
  return { token, member: toMember(m) };
});
