// Restaurants (tenants), branches, staff and RBAC assignments.
import { GRANTABLE, TENANT_WIDE_ROLES } from "../../shared/rbac";
import { DEFAULT_BRANCH_CONFIG, type BranchConfig, type Role } from "../../shared/types";
import { fail, notFound } from "../errors";
import { newId, randomToken, shortCode, slugify } from "../ids";
import { Tx } from "../tx";
import { branchConfig, invalidateBranch, streams, type BranchCtx } from "./context";
import type { Staff } from "../http";

export interface TenantInput {
  name: string;
  slug?: string;
  cuisine?: string;
  description?: string;
  currency?: string;
  timezone?: string;
  branchName?: string;
  address?: string;
}

async function uniqueSlug(db: D1Database, base: string) {
  let slug = slugify(base);
  for (let i = 0; i < 5; i++) {
    const hit = await db.prepare("SELECT 1 FROM tenants WHERE slug = ?").bind(slug).first();
    if (!hit) return slug;
    slug = `${slugify(base)}-${shortCode(3).toLowerCase()}`;
  }
  return `${slugify(base)}-${randomToken(4).toLowerCase()}`;
}

/** Self-serve signup: create the restaurant, its first branch, and make the creator the owner. */
export async function createTenant(db: D1Database, user: { id: string; email: string; name: string }, input: TenantInput) {
  const tenantId = newId("tn_");
  const branchId = newId("br_");
  const slug = input.slug ? slugify(input.slug) : await uniqueSlug(db, input.name);
  const now = Date.now();
  const tx = new Tx(db, { tenantId, branchId, actor: user.id });
  tx.assert("NOT EXISTS (SELECT 1 FROM tenants WHERE slug = ?)", [slug], 409, "slug_taken", "That web address is taken");
  tx.run(
    "INSERT INTO tenants (id, slug, name, description, cuisine, currency, timezone, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    tenantId,
    slug,
    input.name.slice(0, 80),
    input.description ?? "",
    input.cuisine ?? "",
    input.currency ?? "MYR",
    input.timezone ?? "Asia/Kuala_Lumpur",
    now,
  );
  tx.run(
    "INSERT INTO branches (id, tenant_id, slug, name, address, config, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    branchId,
    tenantId,
    slugify(input.branchName ?? "main"),
    input.branchName ?? "Main",
    input.address ?? "",
    JSON.stringify({}),
    now,
  );
  tx.run("INSERT INTO staff (user_id, tenant_id, email, name, role, branch_ids, created_at) VALUES (?, ?, ?, ?, 'owner', '[\"*\"]', ?)", user.id, tenantId, user.email, user.name, now);
  tx.event({ stream: streams.tenant(tenantId), type: "tenant.created", data: { name: input.name, slug } });
  await tx.commit();
  return { tenantId, branchId, slug };
}

export async function updateTenant(db: D1Database, tenantId: string, actor: string, patch: Partial<{ name: string; description: string; cuisine: string; story: string; currency: string; timezone: string; menu_language: string; loyalty: object; onboarding: object }>) {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    params.push(typeof v === "object" ? JSON.stringify(v) : v);
  }
  if (!sets.length) return;
  await new Tx(db, { tenantId, actor })
    .run(`UPDATE tenants SET ${sets.join(", ")} WHERE id = ?`, ...params, tenantId)
    .event({ stream: streams.tenant(tenantId), type: "tenant.updated", data: { fields: Object.keys(patch) } })
    .commit();
  invalidateBranch(tenantId);
}

export async function addBranch(db: D1Database, tenantId: string, actor: string, input: { name: string; address?: string; config?: Partial<BranchConfig> }) {
  const id = newId("br_");
  let slug = slugify(input.name);
  if (await db.prepare("SELECT 1 FROM branches WHERE tenant_id = ? AND slug = ?").bind(tenantId, slug).first()) slug = `${slug}-${shortCode(3).toLowerCase()}`;
  await new Tx(db, { tenantId, branchId: id, actor })
    .run("INSERT INTO branches (id, tenant_id, slug, name, address, config, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", id, tenantId, slug, input.name, input.address ?? "", JSON.stringify(input.config ?? {}), Date.now())
    .event({ stream: streams.branch(id), type: "branch.created", data: { name: input.name } })
    .commit();
  return { id, slug };
}

/** Validate and apply a partial branch-config change (merged over current settings). */
export async function updateBranchConfig(db: D1Database, ctx: BranchCtx, actor: string, patch: Partial<BranchConfig> & { name?: string; address?: string; active?: boolean }) {
  const current = JSON.parse(ctx.branch.config || "{}") as Partial<BranchConfig>;
  const { name, address, active, ...cfg } = patch;
  const next = { ...current, ...cfg };
  if (cfg.categories) {
    const cats = [...cfg.categories].sort((a, b) => a.min - b.min);
    for (let i = 0; i < cats.length; i++) {
      const c = cats[i];
      if (!c.code || !c.prefix || c.min < 1 || c.max < c.min) fail(400, "invalid_categories", `Category ${c.code || i + 1} is invalid`);
      if (i > 0 && c.min <= cats[i - 1].max) fail(400, "overlapping_categories", `Party sizes for ${cats[i - 1].code} and ${c.code} overlap`);
    }
    if (new Set(cats.map((c) => c.prefix)).size !== cats.length) fail(400, "duplicate_prefix", "Each category needs its own ticket prefix");
  }
  if (cfg.strategy && !["fifo", "category_fifo", "best_fit", "smart"].includes(cfg.strategy)) fail(400, "invalid_strategy", "Unknown strategy");
  if (cfg.qrMode && !["static", "dynamic", "both"].includes(cfg.qrMode)) fail(400, "invalid_qr_mode", "Unknown QR mode");
  const merged = branchConfig({ config: JSON.stringify(next) });
  if (merged.serviceChargePct < 0 || merged.serviceChargePct > 30 || merged.taxPct < 0 || merged.taxPct > 30) fail(400, "invalid_rates", "Rates must be between 0 and 30%");
  await new Tx(db, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor })
    .run(
      "UPDATE branches SET config = ?, name = COALESCE(?, name), address = COALESCE(?, address), active = COALESCE(?, active) WHERE id = ?",
      JSON.stringify(next),
      name ?? null,
      address ?? null,
      active === undefined ? null : active ? 1 : 0,
      ctx.branch.id,
    )
    .event({ stream: streams.branch(ctx.branch.id), type: "branch.config_updated", data: { fields: Object.keys(patch) } })
    .commit();
  invalidateBranch(ctx.branch.id);
  return merged;
}

export async function listBranches(db: D1Database, tenantId: string) {
  return (await db.prepare("SELECT id, slug, name, address, active, config FROM branches WHERE tenant_id = ? ORDER BY created_at").bind(tenantId).all<{ id: string; slug: string; name: string; address: string; active: number; config: string }>()).results.map(
    (b) => ({ id: b.id, slug: b.slug, name: b.name, address: b.address, active: !!b.active, config: branchConfig(b) }),
  );
}

// ── staff ───────────────────────────────────────────────────────────────────

function checkGrant(by: Staff, role: Role, branchIds: string[]) {
  if (!GRANTABLE[by.role].includes(role)) fail(403, "forbidden", `A ${by.role} can't assign the ${role} role`);
  if (!TENANT_WIDE_ROLES.includes(by.role) && !by.branches.includes("*")) {
    if (branchIds.includes("*") || branchIds.some((b) => !by.branches.includes(b))) fail(403, "forbidden", "You can only assign staff to your own branches");
  }
}

export async function inviteStaff(db: D1Database, by: Staff, input: { email: string; name: string; role: Role; branchIds: string[] }) {
  checkGrant(by, input.role, input.branchIds);
  const code = randomToken(12);
  await new Tx(db, { tenantId: by.tenantId, actor: by.userId })
    .run(
      "INSERT INTO staff_invites (code, tenant_id, email, name, role, branch_ids, invited_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      code,
      by.tenantId,
      input.email.toLowerCase(),
      input.name,
      input.role,
      JSON.stringify(input.branchIds),
      by.userId,
      Date.now(),
    )
    .event({ stream: streams.tenant(by.tenantId), type: "staff.invited", data: { email: input.email, role: input.role } })
    .commit();
  return code;
}

export async function acceptInvite(db: D1Database, user: { id: string; email: string; name: string }, code: string) {
  const inv = await db.prepare("SELECT * FROM staff_invites WHERE code = ?").bind(code).first<{ tenant_id: string; email: string; role: string; branch_ids: string; accepted_at: number | null; name: string }>();
  if (!inv) notFound("Invitation");
  if (inv.accepted_at) fail(409, "invite_used", "This invitation was already used");
  if (inv.email !== user.email.toLowerCase()) fail(403, "wrong_account", `This invitation is for ${inv.email}`);
  await new Tx(db, { tenantId: inv.tenant_id, actor: user.id })
    .assert("EXISTS (SELECT 1 FROM staff_invites WHERE code = ? AND accepted_at IS NULL)", [code], 409, "invite_used", "This invitation was already used")
    .run(
      "INSERT INTO staff (user_id, tenant_id, email, name, role, branch_ids, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, tenant_id) DO UPDATE SET role = excluded.role, branch_ids = excluded.branch_ids",
      user.id,
      inv.tenant_id,
      user.email.toLowerCase(),
      inv.name || user.name,
      inv.role,
      inv.branch_ids,
      Date.now(),
    )
    .run("UPDATE staff_invites SET accepted_at = ? WHERE code = ?", Date.now(), code)
    .event({ stream: streams.tenant(inv.tenant_id), type: "staff.joined", data: { userId: user.id, role: inv.role } })
    .commit();
  return { tenantId: inv.tenant_id, role: inv.role };
}

export async function listStaff(db: D1Database, tenantId: string) {
  const [staff, invites] = await db.batch([
    db.prepare("SELECT user_id, email, name, role, branch_ids, created_at FROM staff WHERE tenant_id = ? ORDER BY created_at").bind(tenantId),
    db.prepare("SELECT code, email, name, role, branch_ids, created_at FROM staff_invites WHERE tenant_id = ? AND accepted_at IS NULL ORDER BY created_at DESC").bind(tenantId),
  ]);
  return {
    staff: (staff.results as { user_id: string; email: string; name: string; role: Role; branch_ids: string }[]).map((s) => ({ userId: s.user_id, email: s.email, name: s.name, role: s.role, branchIds: JSON.parse(s.branch_ids) })),
    invites: (invites.results as { code: string; email: string; name: string; role: Role; branch_ids: string }[]).map((i) => ({ code: i.code, email: i.email, name: i.name, role: i.role, branchIds: JSON.parse(i.branch_ids) })),
  };
}

export async function updateStaff(db: D1Database, by: Staff, userId: string, input: { role: Role; branchIds: string[] } | null) {
  const target = await db.prepare("SELECT role, branch_ids FROM staff WHERE user_id = ? AND tenant_id = ?").bind(userId, by.tenantId).first<{ role: Role; branch_ids: string }>();
  if (!target) notFound("Staff member");
  if (userId === by.userId) fail(400, "self", "You can't change your own role");
  checkGrant(by, target.role, JSON.parse(target.branch_ids)); // may manage this person at all
  if (input) checkGrant(by, input.role, input.branchIds);
  const tx = new Tx(db, { tenantId: by.tenantId, actor: by.userId });
  if (input) tx.run("UPDATE staff SET role = ?, branch_ids = ? WHERE user_id = ? AND tenant_id = ?", input.role, JSON.stringify(input.branchIds), userId, by.tenantId);
  else {
    tx.assert("(SELECT COUNT(*) FROM staff WHERE tenant_id = ? AND role = 'owner' AND user_id <> ?) > 0 OR ? <> 'owner'", [by.tenantId, userId, target.role], 409, "last_owner", "A restaurant needs at least one owner");
    tx.run("DELETE FROM staff WHERE user_id = ? AND tenant_id = ?", userId, by.tenantId);
  }
  tx.event({ stream: streams.tenant(by.tenantId), type: input ? "staff.updated" : "staff.removed", data: { userId, ...(input ?? {}) } });
  await tx.commit();
}

export const DEFAULTS = DEFAULT_BRANCH_CONFIG;

/** Active branches matching a search (restaurant, branch, cuisine or address), filtered in SQL so the limit never hides matches. */
export async function searchBranches(db: D1Database, query: string, limit = 50) {
  const q = `%${query.trim().toLowerCase().replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
  return (
    await db
      .prepare(
        `SELECT b.id, b.slug, b.name, b.address, t.slug AS tenant_slug, t.name AS tenant_name, t.cuisine FROM branches b JOIN tenants t ON t.id = b.tenant_id
         WHERE b.active = 1 AND lower(t.name || ' ' || b.name || ' ' || COALESCE(t.cuisine, '') || ' ' || COALESCE(b.address, '')) LIKE ? ESCAPE '\\'
         ORDER BY t.name, b.name LIMIT ?`,
      )
      .bind(q, limit)
      .all<{ id: string; slug: string; name: string; address: string; tenant_slug: string; tenant_name: string; cuisine: string }>()
  ).results;
}
