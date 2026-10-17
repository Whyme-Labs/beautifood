// The restaurant's outbox: every email sent to its guests, with Cloudflare delivery status.
import { api } from "../../../src/server/http";
import { staffTenant } from "../../../src/server/routing";

export const GET = api(async (c) => {
  const s = await staffTenant(c, "member.manage");
  const to = c.req.query("to")?.toLowerCase();
  const rows = (
    await c.env.DB.prepare(
      `SELECT id, to_email, subject, kind, status, error, attempts, created_at, sent_at, html FROM emails
       WHERE tenant_id = ? ${to ? "AND to_email LIKE ?" : ""} ORDER BY created_at DESC LIMIT 100`,
    )
      .bind(...(to ? [s.tenantId, `%${to}%`] : [s.tenantId]))
      .all()
  ).results;
  return rows;
});
