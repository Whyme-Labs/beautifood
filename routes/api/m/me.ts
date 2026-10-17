import { getUser } from "void/auth";
import { api } from "../../../src/server/http";
import { permissionsFor } from "../../../src/shared/rbac";
import type { Role } from "../../../src/shared/types";
import { fail } from "../../../src/server/errors";

export const GET = api(async (c) => {
  const user = getUser();
  if (!user) fail(401, "unauthorized", "Sign in required");
  const rows = (
    await c.env.DB.prepare("SELECT s.tenant_id, s.role, s.branch_ids, t.name, t.slug FROM staff s JOIN tenants t ON t.id = s.tenant_id WHERE s.user_id = ? ORDER BY s.created_at")
      .bind(user.id)
      .all<{ tenant_id: string; role: Role; branch_ids: string; name: string; slug: string }>()
  ).results;
  return {
    user: { id: user.id, email: user.email, name: user.name },
    memberships: rows.map((r) => ({ tenantId: r.tenant_id, tenantName: r.name, tenantSlug: r.slug, role: r.role, branchIds: JSON.parse(r.branch_ids), permissions: permissionsFor(r.role) })),
  };
});
