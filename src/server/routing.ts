// Shared route plumbing: branch + permission resolution, customer tokens,
// side-effect kick, and edge caching for public reads.
import { inBranchScope, type Permission } from "../shared/rbac";
import { appEnv } from "./appenv";
import { getBranch, type BranchCtx } from "./domain/context";
import { fail } from "./errors";
import { requirePerm, requireStaff, type Ctx, type Staff } from "./http";
import { processPending } from "./pipeline";
import { verify, type TokenPayload } from "./sign";

export async function staffBranch(c: Ctx, perm: Permission | null, branchRef?: string): Promise<{ staff: Staff; ctx: BranchCtx }> {
  const ctx = await getBranch(c.env.DB, branchRef ?? c.req.param("branch")!);
  const staff = await requireStaff(c, ctx.tenant.id);
  if (perm) requirePerm(staff, perm, ctx.branch.id);
  else if (!inBranchScope(staff, ctx.branch.id)) fail(403, "forbidden", "This branch is outside your access");
  return { staff, ctx };
}

/** Tenant-level staff access (menu, members, campaigns, staff admin). */
export async function staffTenant(c: Ctx, perm: Permission | null): Promise<Staff> {
  const staff = await requireStaff(c);
  if (perm) requirePerm(staff, perm);
  return staff;
}

export const actorOf = (s: Staff) => `${s.via === "token" ? "agent" : "staff"}:${s.userId}`;

/** Run the side-effect pipeline (receipts, loyalty, notifications) after the response. */
export function kick(c: Ctx) {
  const run = processPending(c.env.DB, appEnv()).catch((e) => console.error("pipeline", e));
  try {
    c.executionCtx.waitUntil(run);
  } catch {
    /* no execution context (tests): fire-and-forget */
  }
}

export async function customerToken<K extends TokenPayload["k"]>(c: Ctx, kind: K, id?: string): Promise<Extract<TokenPayload, { k: K }>> {
  const tok = c.req.query("k") ?? c.req.header("x-token") ?? null;
  const p = await verify(appEnv().TOKEN_SECRET, tok, kind);
  if (!p) fail(401, "invalid_token", "This link is invalid or has expired");
  if (id && "id" in p && p.id !== id) fail(403, "wrong_token", "This link is for something else");
  return p;
}

export async function memberFromRequest(c: Ctx) {
  const h = c.req.header("authorization");
  const tok = h?.startsWith("Member ") ? h.slice(7) : c.req.query("m");
  return verify(appEnv().TOKEN_SECRET, tok, "member");
}

/**
 * Cache a public JSON read at the edge for `ttl` seconds. A thousand phones
 * refreshing the queue board cost one database read per location per TTL.
 */
export async function edgeCached(c: Ctx, ttl: number, compute: () => Promise<unknown>): Promise<Response> {
  const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  const key = new Request(new URL(c.req.url).toString(), { method: "GET" });
  if (cache) {
    const hit = await cache.match(key);
    if (hit) {
      const r = new Response(hit.body, hit);
      r.headers.set("x-cache", "HIT");
      return r;
    }
  }
  const body = JSON.stringify(await compute());
  const res = new Response(body, { headers: { "content-type": "application/json", "cache-control": `public, max-age=${ttl}`, "x-cache": "MISS" } });
  if (cache) {
    try {
      c.executionCtx.waitUntil(cache.put(key, res.clone()));
    } catch {
      await cache.put(key, res.clone());
    }
  }
  return res;
}

export function today(ctx: BranchCtx) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ctx.config.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
