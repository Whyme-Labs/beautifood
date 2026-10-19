import type { Context } from "hono";
import { defineHandler } from "void";
import { getUser } from "void/auth";
import type { z } from "zod";
import { can, inBranchScope, isTenantWide, permsOf, type Permission } from "../shared/rbac";
import type { Role } from "../shared/types";
import { AppError, errorResponse, fail } from "./errors";
import { sha256Hex } from "./sign";
import { resolveRole } from "./domain/roles";

export type Ctx = Context<{ Bindings: Env }>;
type Env = { DB: D1Database; KV?: KVNamespace };

/** Route handler with uniform JSON errors. */
export function api(fn: (c: Ctx) => unknown | Promise<unknown>) {
  return defineHandler(async (c) => {
    try {
      const out = await fn(c as unknown as Ctx);
      return out === undefined ? null : (out as never);
    } catch (e) {
      return errorResponse(c as unknown as Context, e);
    } finally {
      // Always consume the request body (e.g. a POST refused before it was parsed): replying
      // with it unread can poison a pooled upstream connection for the next request.
      const raw = (c as unknown as Ctx).req.raw;
      if (raw.body && !raw.bodyUsed) await raw.arrayBuffer().catch(() => undefined);
    }
  });
}

export async function body<S extends z.ZodType>(c: Ctx, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    raw = {};
  }
  return schema.parse(raw);
}

export const db = (c: Ctx) => c.env.DB;

export interface Staff {
  userId: string;
  tenantId: string;
  /** A built-in role name, or a custom role id ("rl_…"). */
  role: Role | string;
  /** What the role grants, resolved at sign-in (custom roles from the roles table). */
  perms: Permission[];
  tenantWide: boolean;
  /** The role's name: the built-in name, or the custom role's. */
  roleName: string;
  branches: string[];
  name: string;
  email: string;
  via: "session" | "token";
}

interface StaffRow {
  user_id: string;
  tenant_id: string;
  role: Role;
  branch_ids: string;
  name: string;
  email: string;
}

async function toStaff(c: Ctx, r: StaffRow, via: Staff["via"]): Promise<Staff> {
  const g = await resolveRole(db(c), r.tenant_id, r.role);
  return {
    userId: r.user_id,
    tenantId: r.tenant_id,
    role: r.role,
    perms: permsOf(g),
    tenantWide: isTenantWide(g),
    roleName: g.name,
    branches: JSON.parse(r.branch_ids),
    name: r.name,
    email: r.email,
    via,
  };
}

/**
 * Resolve the signed-in staff member (Better Auth session cookie, or a personal
 * access token for agents) and their membership in the requested tenant.
 */
export async function requireStaff(c: Ctx, tenantId?: string | null): Promise<Staff> {
  const tenant = tenantId ?? c.req.header("x-tenant") ?? null;
  const authz = c.req.header("authorization");
  if (authz?.startsWith("Bearer bf_pat_")) {
    const hash = await sha256Hex(authz.slice(7));
    const tok = await db(c).prepare("SELECT user_id, tenant_id FROM api_tokens WHERE token_hash = ?").bind(hash).first<{ user_id: string; tenant_id: string }>();
    if (!tok) fail(401, "unauthorized", "Invalid API token");
    if (tenant && tenant !== tok.tenant_id) fail(403, "forbidden", "Token is not valid for this tenant");
    const row = await db(c).prepare("SELECT * FROM staff WHERE user_id = ? AND tenant_id = ?").bind(tok.user_id, tok.tenant_id).first<StaffRow>();
    if (!row) fail(403, "forbidden", "No longer a member of this restaurant");
    c.executionCtx.waitUntil(db(c).prepare("UPDATE api_tokens SET last_used_at = ? WHERE token_hash = ?").bind(Date.now(), hash).run());
    return toStaff(c, row, "token");
  }
  const user = getUser();
  if (!user) fail(401, "unauthorized", "Sign in required");
  const rows = (await db(c).prepare("SELECT * FROM staff WHERE user_id = ? ORDER BY created_at").bind(user.id).all<StaffRow>()).results;
  if (!rows.length) fail(403, "no_tenant", "This account is not linked to a restaurant yet");
  const row = tenant ? rows.find((r) => r.tenant_id === tenant) : rows[0];
  if (!row) fail(403, "forbidden", "Not a member of this restaurant");
  return toStaff(c, row, "session");
}

export function requirePerm(s: Staff, perm: Permission, branchId?: string | null): void {
  if (!can(s, perm)) throw new AppError(403, "forbidden", `Your role (${s.roleName}) cannot ${perm.replace(".", " ")}`);
  if (branchId && !inBranchScope(s, branchId)) throw new AppError(403, "forbidden", "This branch is outside your access");
}

export function deviceId(c: Ctx): string | null {
  const d = c.req.header("x-device");
  return d && /^[\w-]{8,64}$/.test(d) ? d : null;
}

export function publicUrl(c: Ctx, configured?: string): string {
  if (configured && !configured.includes("localhost")) return configured.replace(/\/$/, "");
  return new URL(c.req.url).origin;
}
