// The owner's live dashboard across all branches.
import { api } from "../../../src/server/http";
import { staffTenant } from "../../../src/server/routing";
import { tenantOverview, tenantTrend } from "../../../src/server/domain/reports";
import { TENANT_WIDE_ROLES } from "../../../src/shared/rbac";

export const GET = api(async (c) => {
  const s = await staffTenant(c, null);
  const scope = TENANT_WIDE_ROLES.includes(s.role) || s.branches.includes("*") ? "*" : s.branches;
  const days = Array.from({ length: 7 }, (_, i) => new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10));
  return { ...(await tenantOverview(c.env.DB, s.tenantId, scope)), trend: scope === "*" ? await tenantTrend(c.env.DB, s.tenantId, days) : [] };
});
