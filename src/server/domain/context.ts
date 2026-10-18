import { DEFAULT_BRANCH_CONFIG, DEFAULT_MODULES, type BranchConfig } from "../../shared/types";
import { notFound } from "../errors";

export interface TenantRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  cuisine: string;
  story: string;
  currency: string;
  timezone: string;
  loyalty: string;
  onboarding: string;
  menu_language: string;
  translations: string;
  created_at: number;
}

export interface BranchRow {
  id: string;
  tenant_id: string;
  slug: string;
  name: string;
  address: string;
  config: string;
  turn_model: string;
  active: number;
}

export interface LoyaltyConfig {
  enabled: boolean;
  earnPerUnit: number; // points per 1.00 of currency spent
  redeemValue: number; // minor units per point
  minRedeem: number;
  tiers: { name: string; minLifetime: number; multiplier: number }[];
}

export const DEFAULT_LOYALTY: LoyaltyConfig = {
  enabled: true,
  earnPerUnit: 1,
  redeemValue: 1,
  minRedeem: 100,
  tiers: [
    { name: "Bronze", minLifetime: 0, multiplier: 1 },
    { name: "Silver", minLifetime: 1000, multiplier: 1.25 },
    { name: "Gold", minLifetime: 5000, multiplier: 1.5 },
  ],
};

export function branchConfig(row: Pick<BranchRow, "config">, tenant?: Pick<TenantRow, "currency" | "timezone">): BranchConfig {
  const c = JSON.parse(row.config || "{}") as Partial<BranchConfig>;
  return {
    ...DEFAULT_BRANCH_CONFIG,
    ...(tenant ? { currency: tenant.currency, timezone: tenant.timezone } : {}),
    ...c,
    weights: { ...DEFAULT_BRANCH_CONFIG.weights, ...(c.weights ?? {}) },
    booking: { ...DEFAULT_BRANCH_CONFIG.booking, ...(c.booking ?? {}) },
    modules: { ...DEFAULT_MODULES, ...(c.modules ?? {}) },
    categories: c.categories?.length ? c.categories : DEFAULT_BRANCH_CONFIG.categories,
  };
}

export function loyaltyConfig(t: Pick<TenantRow, "loyalty">): LoyaltyConfig {
  const l = JSON.parse(t.loyalty || "{}") as Partial<LoyaltyConfig>;
  return { ...DEFAULT_LOYALTY, ...l, tiers: l.tiers?.length ? l.tiers : DEFAULT_LOYALTY.tiers };
}

export async function getTenant(db: D1Database, idOrSlug: string): Promise<TenantRow> {
  const t = await db.prepare("SELECT * FROM tenants WHERE id = ? OR slug = ?").bind(idOrSlug, idOrSlug).first<TenantRow>();
  return t ?? notFound("Restaurant");
}

export interface BranchCtx {
  branch: BranchRow;
  tenant: TenantRow;
  config: BranchConfig;
}

// Warm-isolate cache: branch config changes rarely, and every request needs it.
// Writes in this isolate invalidate immediately; other isolates see changes within the TTL.
const BRANCH_TTL_MS = 3000;
const branchCache = new Map<string, { at: number; ctx: BranchCtx }>();

export function invalidateBranch(id?: string) {
  if (!id) return branchCache.clear();
  for (const [k, v] of branchCache) if (v.ctx.branch.id === id || v.ctx.tenant.id === id) branchCache.delete(k);
}

/** Load a branch by id, or by "tenant-slug~branch-slug" (cached briefly per isolate). */
export async function getBranch(db: D1Database, ref: string, fresh = false): Promise<BranchCtx> {
  const hit = branchCache.get(ref);
  if (!fresh && hit && Date.now() - hit.at < BRANCH_TTL_MS) return hit.ctx;
  const ctx = await loadBranch(db, ref);
  if (branchCache.size > 500) branchCache.clear();
  branchCache.set(ref, { at: Date.now(), ctx });
  return ctx;
}

async function loadBranch(db: D1Database, ref: string): Promise<BranchCtx> {
  let row: (BranchRow & { t_json?: string }) | null;
  if (ref.includes("/") || ref.includes("~")) {
    const [ts, bs] = ref.split(/[/~]/);
    row = await db.prepare("SELECT b.* FROM branches b JOIN tenants t ON t.id = b.tenant_id WHERE t.slug = ? AND b.slug = ?").bind(ts, bs).first<BranchRow>();
  } else {
    row = await db.prepare("SELECT * FROM branches WHERE id = ?").bind(ref).first<BranchRow>();
  }
  if (!row) notFound("Branch");
  const tenant = await getTenant(db, row!.tenant_id);
  return { branch: row!, tenant, config: branchConfig(row!, tenant) };
}

export const streams = {
  queue: (branchId: string) => `branch:${branchId}:queue`,
  table: (id: string) => `table:${id}`,
  seating: (id: string) => `seating:${id}`,
  session: (id: string) => `session:${id}`,
  order: (id: string) => `order:${id}`,
  member: (id: string) => `member:${id}`,
  booking: (id: string) => `booking:${id}`,
  menu: (tenantId: string) => `tenant:${tenantId}:menu`,
  tenant: (tenantId: string) => `tenant:${tenantId}`,
  branch: (branchId: string) => `branch:${branchId}`,
  shift: (id: string) => `shift:${id}`,
};
