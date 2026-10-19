// The restaurant's roles: the built-in ones (read-only) and its own, with what each can do.
import { api, body } from "../../../../src/server/http";
import { actorOf, staffTenant } from "../../../../src/server/routing";
import { RoleInput } from "../../../../src/server/schemas";
import { listRoles, saveRole } from "../../../../src/server/domain/roles";
import { ROLE_PERMISSIONS, TENANT_WIDE_ROLES, canGrant } from "../../../../src/shared/rbac";
import type { Role } from "../../../../src/shared/types";

export const GET = api(async (c) => {
  const s = await staffTenant(c, "staff.manage");
  const custom = await listRoles(c.env.DB, s.tenantId);
  return {
    builtIn: (Object.keys(ROLE_PERMISSIONS) as Role[]).map((r) => ({ id: r, permissions: [...ROLE_PERMISSIONS[r]], tenantWide: TENANT_WIDE_ROLES.includes(r), grantable: canGrant(s, { role: r }) })),
    custom: custom.map((r) => ({ ...r, grantable: canGrant(s, { role: r.id, perms: r.permissions, tenantWide: r.tenantWide }) })),
    mine: { permissions: s.perms, tenantWide: s.tenantWide },
  };
});

export const POST = api(async (c) => {
  const s = await staffTenant(c, "staff.manage");
  const input = await body(c, RoleInput);
  return c.json(await saveRole(c.env.DB, { ...s, userId: actorOf(s) }, input), input.id ? 200 : 201);
});
