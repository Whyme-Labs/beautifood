// Every restaurant & branch with live queue info: customers can compare queues across branches.
import { api } from "../../../src/server/http";
import { edgeCached } from "../../../src/server/routing";
import { getBranch } from "../../../src/server/domain/context";
import { publicStatus } from "../../../src/server/domain/floor";
import { searchBranches } from "../../../src/server/domain/tenants";

export const GET = api((c) =>
  edgeCached(c, 5, async () => {
    const rows = await searchBranches(c.env.DB, c.req.query("q") ?? "");
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
