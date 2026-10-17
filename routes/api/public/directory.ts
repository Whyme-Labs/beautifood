// Every restaurant & branch with live queue info: customers can compare queues across branches.
import { api } from "../../../src/server/http";
import { edgeCached } from "../../../src/server/routing";
import { getBranch } from "../../../src/server/domain/context";
import { publicStatus } from "../../../src/server/domain/floor";

export const GET = api((c) =>
  edgeCached(c, 5, async () => {
    const q = (c.req.query("q") ?? "").toLowerCase();
    const rows = (
      await c.env.DB.prepare(
        "SELECT b.id, b.slug, b.name, b.address, t.slug AS tenant_slug, t.name AS tenant_name, t.cuisine FROM branches b JOIN tenants t ON t.id = b.tenant_id WHERE b.active = 1 ORDER BY t.name, b.name LIMIT 200",
      ).all<{ id: string; slug: string; name: string; address: string; tenant_slug: string; tenant_name: string; cuisine: string }>()
    ).results.filter((r) => !q || `${r.tenant_name} ${r.name} ${r.cuisine} ${r.address}`.toLowerCase().includes(q));
    const out = await Promise.all(
      rows.map(async (r) => {
        const st = await publicStatus(c.env.DB, await getBranch(c.env.DB, r.id));
        return {
          branchId: r.id,
          ref: `${r.tenant_slug}~${r.slug}`,
          restaurant: r.tenant_name,
          cuisine: r.cuisine,
          branch: r.name,
          address: r.address,
          waiting: st.categories.reduce((s, x) => s + x.waiting, 0),
          categories: st.categories.map((x) => ({ code: x.code, label: x.label, waiting: x.waiting, estimateMinutes: x.estimateMinutes })),
          freeTables: st.tables.free,
          nowCalling: st.nowCalling.map((n) => n.number),
        };
      }),
    );
    return { branches: out };
  }),
);
