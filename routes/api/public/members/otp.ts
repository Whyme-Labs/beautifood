// Passwordless member sign-in: email a 6-digit code (stored hashed, 10-minute expiry, 5 attempts).
import { z } from "zod";
import { api, body } from "../../../../src/server/http";
import { appEnv } from "../../../../src/server/appenv";
import { getTenant } from "../../../../src/server/domain/context";
import { sendEmail } from "../../../../src/server/domain/messaging";
import { otpMail } from "../../../../src/server/emails";
import { requestLocale } from "../../../../src/server/locale";
import { sha256Hex } from "../../../../src/server/sign";
import { newId } from "../../../../src/server/ids";

export const POST = api(async (c) => {
  const { email, tenant } = await body(c, z.object({ email: z.string().trim().email(), tenant: z.string() }));
  const t = await getTenant(c.env.DB, tenant);
  const e = email.toLowerCase();
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
  await c.env.DB.prepare("INSERT INTO otp_codes (email, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0) ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0")
    .bind(`${t.id}:${e}`, await sha256Hex(`${t.id}:${e}:${code}`), Date.now() + 10 * 60_000)
    .run();
  await sendEmail(c.env.DB, appEnv(), {
    tenantId: t.id,
    fromName: t.name,
    to: e,
    ...otpMail(requestLocale(c.req), t.name, code),
    kind: "otp",
    ref: newId("otp_"),
  });
  return { sent: true };
});
