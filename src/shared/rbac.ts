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
  ]),
  cashier: new Set<Permission>(["queue.operate", "order.create", "payment.take", "shift.manage", "booking.manage"]),
  waiter: new Set<Permission>(["queue.operate", "order.create", "booking.manage", "kds.operate"]),
  kitchen: new Set<Permission>(["kds.operate", "menu.availability"]),
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

export function can(claims: Pick<StaffClaims, "role">, perm: Permission): boolean {
  return ROLE_PERMISSIONS[claims.role]?.has(perm) ?? false;
}

export function inBranchScope(claims: Pick<StaffClaims, "role" | "branches">, branchId: string): boolean {
  if (TENANT_WIDE_ROLES.includes(claims.role)) return true;
  return claims.branches.includes("*") || claims.branches.includes(branchId);
}

export function permissionsFor(role: Role): Permission[] {
  return [...(ROLE_PERMISSIONS[role] ?? [])];
}
