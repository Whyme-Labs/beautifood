import { getUser } from "void/auth";
import { api } from "../../../src/server/http";
import { permsOf, isTenantWide } from "../../../src/shared/rbac";
import { resolveRoles } from "../../../src/server/domain/roles";
import { fail } from "../../../src/server/errors";

export const GET = api(async (c) => {
  const user = getUser();
  if (!user) fail(401, "unauthorized", "Sign in required");
  const rows = (
    await c.env.DB.prepare("SELECT s.tenant_id, s.role, s.branch_ids, t.name, t.slug FROM staff s JOIN tenants t ON t.id = s.tenant_id WHERE s.user_id = ? ORDER BY s.created_at")
      .bind(user.id)
      .all<{ tenant_id: string; role: string; branch_ids: string; name: string; slug: string }>()
  ).results;
  const roleOf = await resolveRoles(c.env.DB, rows.map((r) => ({ tenantId: r.tenant_id, role: r.role })));
  return {
    user: { id: user.id, email: user.email, name: user.name },
    memberships: rows.map((r) => {
      const g = roleOf(r.tenant_id, r.role);
      return { tenantId: r.tenant_id, tenantName: r.name, tenantSlug: r.slug, role: r.role, roleName: g.name, tenantWide: isTenantWide(g), branchIds: JSON.parse(r.branch_ids), permissions: permsOf(g) };
    }),
  };
});
