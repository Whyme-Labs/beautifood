// Custom roles: a restaurant names a role and picks its permissions ("Supervisor: refunds and
// voids, no reports"). Staff hold a built-in role name or a custom role id. Whoever creates,
// changes or hands out a role can only use permissions they hold themselves (see canGrant).
import { OWNER_ONLY, PERMISSIONS, ROLE_PERMISSIONS, canGrant, isBuiltInRole, isCustomRole, type Grantee, type Permission } from "../../shared/rbac";
import type { Role } from "../../shared/types";
import { fail, notFound } from "../errors";
import { newId } from "../ids";
import { Tx } from "../tx";
import { streams } from "./context";

export interface CustomRole {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  tenantWide: boolean;
  members: number;
  createdAt: number;
  updatedAt: number;
}

interface RoleRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  permissions: string;
  tenant_wide: number;
  created_at: number;
  updated_at: number;
}

const valid = (ps: unknown): Permission[] => (Array.isArray(ps) ? ps.filter((p): p is Permission => (PERMISSIONS as readonly string[]).includes(p)) : []);

const toRole = (r: RoleRow, members = 0): CustomRole => ({
  id: r.id,
  name: r.name,
  description: r.description,
  permissions: valid(JSON.parse(r.permissions || "[]")),
  tenantWide: !!r.tenant_wide,
  members,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export async function listRoles(db: D1Database, tenantId: string): Promise<CustomRole[]> {
  const [rows, counts] = await db.batch([
    db.prepare("SELECT * FROM roles WHERE tenant_id = ? ORDER BY name").bind(tenantId),
    db.prepare("SELECT role, COUNT(*) AS n FROM staff WHERE tenant_id = ? AND role LIKE 'rl_%' GROUP BY role").bind(tenantId),
  ]);
  const n = new Map((counts.results as { role: string; n: number }[]).map((c) => [c.role, c.n]));
  return (rows.results as unknown as RoleRow[]).map((r) => toRole(r, n.get(r.id) ?? 0));
}

/** What a role string grants in a restaurant: a built-in role's permissions, or a custom role's (none if it's gone). */
export async function resolveRole(db: D1Database, tenantId: string, role: string): Promise<Grantee & { name: string; exists: boolean }> {
  if (isBuiltInRole(role)) return { role, perms: [...ROLE_PERMISSIONS[role]], tenantWide: undefined, name: role, exists: true };
  if (!isCustomRole(role)) return { role, perms: [], tenantWide: false, name: role, exists: false };
  const r = await db.prepare("SELECT * FROM roles WHERE id = ? AND tenant_id = ?").bind(role, tenantId).first<RoleRow>();
  if (!r) return { role, perms: [], tenantWide: false, name: role, exists: false };
  const c = toRole(r);
  return { role, perms: c.permissions, tenantWide: c.tenantWide, name: c.name, exists: true };
}

/** Many roles at once (the staff list, /me): role string → its grant. */
export async function resolveRoles(db: D1Database, pairs: { tenantId: string; role: string }[]) {
  const custom = [...new Set(pairs.filter((p) => isCustomRole(p.role)).map((p) => p.role))];
  const rows = custom.length ? (await db.prepare(`SELECT * FROM roles WHERE id IN (${custom.map(() => "?").join(",")})`).bind(...custom).all<RoleRow>()).results : [];
  return (tenantId: string, role: string): Grantee & { name: string } => {
    if (isBuiltInRole(role)) return { role, perms: [...ROLE_PERMISSIONS[role]], name: role };
    const r = rows.find((x) => x.id === role && x.tenant_id === tenantId);
    return r ? { role, perms: toRole(r).permissions, tenantWide: !!r.tenant_wide, name: r.name } : { role, perms: [], tenantWide: false, name: role };
  };
}

export interface RoleInput {
  id?: string;
  name: string;
  description?: string;
  permissions: string[];
  tenantWide?: boolean;
}

/** Create or change a custom role: only with permissions `by` holds, and only a role `by` could hand out. */
export async function saveRole(db: D1Database, by: Grantee & { tenantId: string; userId: string }, input: RoleInput) {
  const permissions = [...new Set(valid(input.permissions))];
  if (!permissions.length) fail(400, "no_permissions", "Pick at least one permission");
  if (permissions.some((p) => OWNER_ONLY.includes(p))) fail(400, "owner_only", "Running the restaurant itself stays with owners");
  const next: Grantee = { role: "rl_new", perms: permissions, tenantWide: !!input.tenantWide };
  if (!canGrant(by, next)) fail(403, "forbidden", "You can only build a role from permissions you have yourself");
  const name = input.name.trim();
  if (isBuiltInRole(name.toLowerCase().replace(/\s+/g, "_") as Role)) fail(409, "role_name_taken", "That's the name of a built-in role");
  const tx = new Tx(db, { tenantId: by.tenantId, actor: by.userId });
  let id = input.id;
  tx.assert("NOT EXISTS (SELECT 1 FROM roles WHERE tenant_id = ? AND lower(name) = lower(?) AND id <> ?)", [by.tenantId, name, input.id ?? ""], 409, "role_name_taken", "There's already a role with that name");
  if (id) {
    const cur = await resolveRole(db, by.tenantId, id);
    if (!cur.exists || !isCustomRole(id)) notFound("Role");
    if (!canGrant(by, cur)) fail(403, "forbidden", "This role has permissions you don't have");
    tx.run("UPDATE roles SET name = ?, description = ?, permissions = ?, tenant_wide = ?, updated_at = ? WHERE id = ? AND tenant_id = ?", name, input.description ?? "", JSON.stringify(permissions), input.tenantWide ? 1 : 0, tx.at, id, by.tenantId);
  } else {
    id = newId("rl_");
    tx.run(
      "INSERT INTO roles (id, tenant_id, name, description, permissions, tenant_wide, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id,
      by.tenantId,
      name,
      input.description ?? "",
      JSON.stringify(permissions),
      input.tenantWide ? 1 : 0,
      by.userId,
      tx.at,
      tx.at,
    );
  }
  tx.event({ stream: streams.tenant(by.tenantId), type: input.id ? "role.updated" : "role.created", data: { id, name, permissions, tenantWide: !!input.tenantWide } });
  await tx.commit();
  return { id };
}

export async function deleteRole(db: D1Database, by: Grantee & { tenantId: string; userId: string }, id: string) {
  const cur = await resolveRole(db, by.tenantId, id);
  if (!cur.exists || !isCustomRole(id)) notFound("Role");
  if (!canGrant(by, cur)) fail(403, "forbidden", "This role has permissions you don't have");
  await new Tx(db, { tenantId: by.tenantId, actor: by.userId })
    .assert("NOT EXISTS (SELECT 1 FROM staff WHERE tenant_id = ? AND role = ?)", [by.tenantId, id], 409, "role_in_use", "Move the people in this role to another role first")
    .assert("NOT EXISTS (SELECT 1 FROM staff_invites WHERE tenant_id = ? AND role = ? AND accepted_at IS NULL)", [by.tenantId, id], 409, "role_in_use", "There are open invitations for this role")
    .run("DELETE FROM roles WHERE id = ? AND tenant_id = ?", id, by.tenantId)
    .event({ stream: streams.tenant(by.tenantId), type: "role.deleted", data: { id } })
    .commit();
}
