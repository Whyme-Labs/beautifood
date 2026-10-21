// A branch's taste brief: its menu and best sellers from D1, its area from its address, and Qloo
// through the taste service. Kept for 12 hours in the Worker's cache (the service caches each Qloo
// call for a day too), so opening the page or asking an agent twice costs no extra Qloo calls.
import type { BranchCtx } from "../domain/context";
import { menuAt } from "../domain/menu";
import { tasteBrief, tasteLocation, type TasteBrief } from "./brief";
import { tasteEnabled, tasteRunner, type TasteEnv } from "./client";

export { tasteEnabled };

export async function branchTasteBrief(db: D1Database, env: TasteEnv, ctx: BranchCtx, opts: { location?: string; refresh?: boolean } = {}): Promise<TasteBrief> {
  const location = opts.location?.trim() || tasteLocation(ctx.branch.address);
  const day = new Date().toISOString().slice(0, 10);
  const key = new Request(`https://taste-brief.internal/${ctx.branch.id}/${encodeURIComponent(location)}/${day}`);
  const cache = typeof caches !== "undefined" ? (caches as unknown as { default: Cache }).default : null;
  if (cache && !opts.refresh) {
    const hit = await cache.match(key).catch(() => undefined);
    if (hit) return (await hit.json()) as TasteBrief;
  }
  const since = Date.now() - 30 * 86_400_000;
  const [menu, sellers] = await Promise.all([
    menuAt(db, ctx),
    db
      .prepare("SELECT name, SUM(qty) AS qty FROM order_items WHERE branch_id = ? AND created_at > ? AND status <> 'void' GROUP BY item_id ORDER BY qty DESC LIMIT 5")
      .bind(ctx.branch.id, since)
      .all<{ name: string; qty: number }>(),
  ]);
  const catName = new Map(menu.categories.map((c) => [c.id, c.name]));
  const brief = await tasteBrief(tasteRunner(env), {
    restaurant: ctx.tenant.name,
    cuisine: ctx.tenant.cuisine,
    location,
    menu: menu.items.map((i) => ({ name: i.name, description: i.description, category: catName.get(i.categoryId) })),
    bestSellers: sellers.results,
  });
  // a brief with nothing in it (the service down, the key missing) isn't worth keeping
  if (cache && brief.findings.length) await cache.put(key, new Response(JSON.stringify(brief), { headers: { "content-type": "application/json", "cache-control": "max-age=43200" } })).catch(() => {});
  return brief;
}
