import { z } from "zod";
import { api, body } from "../../../../src/server/http";
import { staffTenant } from "../../../../src/server/routing";
import { ensureMember, toMember, type MemberRow } from "../../../../src/server/domain/loyalty";

export const GET = api(async (c) => {
  const s = await staffTenant(c, null);
  const q = `%${(c.req.query("q") ?? "").toLowerCase()}%`;
  const rows = (
    await c.env.DB.prepare("SELECT * FROM members WHERE tenant_id = ? AND (lower(email) LIKE ? OR lower(name) LIKE ? OR phone LIKE ?) ORDER BY last_visit_at DESC NULLS LAST, created_at DESC LIMIT 100")
      .bind(s.tenantId, q, q, q)
      .all<MemberRow>()
  ).results;
  const stats = await c.env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(points), 0) AS points, SUM(opt_in) AS opted FROM members WHERE tenant_id = ?").bind(s.tenantId).first<{ n: number; points: number; opted: number }>();
  return { members: rows.map(toMember), stats };
});

export const POST = api(async (c) => {
  const s = await staffTenant(c, "order.create");
  const input = await body(c, z.object({ email: z.string().email(), name: z.string().max(60).optional(), phone: z.string().max(30).optional(), optIn: z.boolean().optional() }));
  return c.json(toMember(await ensureMember(c.env.DB, s.tenantId, input.email, input)), 201);
});
