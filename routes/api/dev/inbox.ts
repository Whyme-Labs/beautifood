// Development inbox: every email the system "sent" (receipts, OTPs, campaigns, notifications).
import { api } from "../../../src/server/http";
import { appEnv } from "../../../src/server/appenv";
import { fail } from "../../../src/server/errors";

export const GET = api(async (c) => {
  if (appEnv().APP_ENV === "production") fail(404, "not_found", "Not found");
  const to = c.req.query("to");
  const kind = c.req.query("kind");
  const where: string[] = [];
  const params: string[] = [];
  if (to) {
    where.push("to_email = ?");
    params.push(to.toLowerCase());
  }
  if (kind) {
    where.push("kind = ?");
    params.push(kind);
  }
  const rows = (await c.env.DB.prepare(`SELECT id, to_email, subject, kind, ref, status, created_at, ${c.req.query("html") ? "html, text" : "text"} FROM emails ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC LIMIT 100`).bind(...params).all()).results;
  return rows;
});
