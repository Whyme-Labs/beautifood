// The brief a restaurant hands its coding agent to build connectors (Markdown, or JSON with ?format=json).
import { api } from "../../../../src/server/http";
import { staffTenant } from "../../../../src/server/routing";
import { appEnv } from "../../../../src/server/appenv";
import { listEndpoints } from "../../../../src/server/domain/webhooks";
import { integrationBrief } from "../../../../src/server/domain/brief";

export const GET = api(async (c) => {
  const s = await staffTenant(c, "integrations.manage");
  const db = c.env.DB;
  const tenant = (await db.prepare("SELECT id, name, slug, currency, timezone FROM tenants WHERE id = ?").bind(s.tenantId).first<{ id: string; name: string; slug: string; currency: string; timezone: string }>())!;
  const branches = (await db.prepare("SELECT id, name, slug FROM branches WHERE tenant_id = ? AND active = 1 ORDER BY created_at").bind(s.tenantId).all<{ id: string; name: string; slug: string }>()).results;
  const origin = appEnv().PUBLIC_URL || new URL(c.req.url).origin;
  const md = integrationBrief({ origin, tenant, branches, endpoints: (await listEndpoints(db, s.tenantId)).map((e) => ({ id: e.id, url: e.url, events: e.events })) });
  if (c.req.query("format") === "json") return { markdown: md };
  return c.body(md, 200, { "content-type": "text/markdown; charset=utf-8", "content-disposition": `inline; filename="beautifood-${tenant.slug}-integration-brief.md"` });
});
