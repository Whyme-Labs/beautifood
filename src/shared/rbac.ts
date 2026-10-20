import type { Role, StaffClaims } from "./types";

export const PERMISSIONS = [
  "tenant.manage",
  "branch.manage",
  "staff.manage",
  "menu.manage",
  "menu.availability",
  "table.manage",
  "queue.operate",
  "order.create",
  "order.void",
  "order.discount",
  "payment.take",
  "payment.refund",
  "shift.manage",
  "kds.operate",
  "booking.manage",
  "report.view",
  "report.view_all",
  "member.manage",
  "campaign.manage",
  "settings.manage",
  "ai.merchant",
  "integrations.manage",
  "inventory.manage",
  "inventory.stock",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL = new Set<Permission>(PERMISSIONS);
const without = (...p: Permission[]) => new Set<Permission>(PERMISSIONS.filter((x) => !p.includes(x)));

export const ROLE_PERMISSIONS: Record<Role, Set<Permission>> = {
  owner: ALL,
  admin: without("tenant.manage"),
  branch_manager: new Set<Permission>([
    "menu.availability",
    "table.manage",
    "queue.operate",
    "order.create",
    "order.void",
    "order.discount",
    "payment.take",
    "payment.refund",
    "shift.manage",
    "kds.operate",
    "booking.manage",
    "report.view",
    "staff.manage",
    "settings.manage",
    "ai.merchant",
    "inventory.manage",
    "inventory.stock",
  ]),
  cashier: new Set<Permission>(["queue.operate", "order.create", "payment.take", "shift.manage", "booking.manage"]),
  waiter: new Set<Permission>(["queue.operate", "order.create", "booking.manage", "kds.operate"]),
  // the kitchen takes in deliveries and writes off wastage; ingredients, recipes, corrections and counts are managers'
  kitchen: new Set<Permission>(["kds.operate", "menu.availability", "inventory.stock"]),
  marketing: new Set<Permission>(["member.manage", "campaign.manage", "report.view", "report.view_all"]),
};

/** Roles that can see every branch regardless of the assignment list. */
export const TENANT_WIDE_ROLES: Role[] = ["owner", "admin", "marketing"];

/** Roles a given role may grant to other staff (no privilege escalation). */
export const GRANTABLE: Record<Role, Role[]> = {
  owner: ["owner", "admin", "branch_manager", "cashier", "waiter", "kitchen", "marketing"],
  admin: ["admin", "branch_manager", "cashier", "waiter", "kitchen", "marketing"],
  branch_manager: ["cashier", "waiter", "kitchen"],
  cashier: [],
  waiter: [],
  kitchen: [],
  marketing: [],
};

/** Who holds which permissions: a built-in role, or a custom role resolved to its permission list. */
export interface Grantee {
  role: string;
  /** Set for custom roles (and resolved staff); built-in roles fall back to ROLE_PERMISSIONS. */
  perms?: readonly Permission[];
  tenantWide?: boolean;
}

/** Custom roles are stored per restaurant with ids like "rl_…"; anything else is a built-in role. */
export const isCustomRole = (role: string) => role.startsWith("rl_");
export const isBuiltInRole = (role: string): role is Role => role in ROLE_PERMISSIONS;

export function permsOf(g: Grantee): Permission[] {
  if (g.perms) return [...g.perms];
  return isBuiltInRole(g.role) ? [...ROLE_PERMISSIONS[g.role]] : [];
}

export function can(claims: Grantee, perm: Permission): boolean {
  if (claims.perms) return claims.perms.includes(perm);
  return isBuiltInRole(claims.role) ? ROLE_PERMISSIONS[claims.role].has(perm) : false;
}

/** Sees every branch whatever its assignment list (owner, admin, marketing, or a custom role set so). */
export const isTenantWide = (claims: Grantee) => claims.tenantWide ?? (TENANT_WIDE_ROLES as string[]).includes(claims.role);

export function inBranchScope(claims: Grantee & { branches: string[] }, branchId: string): boolean {
  if (isTenantWide(claims)) return true;
  return claims.branches.includes("*") || claims.branches.includes(branchId);
}

export function permissionsFor(role: Role): Permission[] {
  return [...(ROLE_PERMISSIONS[role] ?? [])];
}

/** Permissions a custom role may never hold: running the restaurant itself stays with owners. */
export const OWNER_ONLY: Permission[] = ["tenant.manage"];

/**
 * May `by` give someone `target`? Only with permission to manage staff, only permissions `by`
 * holds itself (so nobody can create or hand out more power than they have), and a tenant-wide
 * role, or one that can itself manage staff, only from a tenant-wide grantor (a branch manager
 * can't mint more managers). For the built-in roles this is exactly GRANTABLE.
 */
export function canGrant(by: Grantee, target: Grantee): boolean {
  if (!can(by, "staff.manage")) return false;
  const mine = new Set(permsOf(by));
  if (!permsOf(target).every((p) => mine.has(p))) return false;
  if ((isTenantWide(target) || can(target, "staff.manage")) && !isTenantWide(by)) return false;
  return true;
}

/** Permissions grouped the way the role editor shows them. */
export const PERMISSION_GROUPS: { group: string; perms: Permission[] }[] = [
  { group: "floor", perms: ["queue.operate", "booking.manage", "table.manage"] },
  { group: "orders", perms: ["order.create", "order.void", "order.discount", "kds.operate", "menu.availability"] },
  { group: "money", perms: ["payment.take", "payment.refund", "shift.manage"] },
  { group: "menu", perms: ["menu.manage"] },
  { group: "inventory", perms: ["inventory.stock", "inventory.manage"] },
  { group: "guests", perms: ["member.manage", "campaign.manage"] },
  { group: "reports", perms: ["report.view", "report.view_all"] },
  { group: "admin", perms: ["staff.manage", "settings.manage", "branch.manage", "integrations.manage", "ai.merchant", "tenant.manage"] },
];
