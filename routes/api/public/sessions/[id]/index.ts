// The shared table cart. Clients poll with ?since=<version>: an unchanged cart answers 204 (cheap).
import { api } from "../../../../../src/server/http";
import { customerToken } from "../../../../../src/server/routing";
import { getBranch } from "../../../../../src/server/domain/context";
import { cartView } from "../../../../../src/server/domain/orders";
import { getMenu } from "../../../../../src/server/domain/menu";

export const GET = api(async (c) => {
  const id = c.req.param("id")!;
  const tok = await customerToken(c, "session", id);
  const since = c.req.query("since");
  if (since !== undefined) {
    const v = await c.env.DB.prepare("SELECT version FROM sessions WHERE id = ?").bind(id).first<{ version: number }>();
    if (v && String(v.version) === since) return new Response(null, { status: 204, headers: { "x-version": String(v.version) } });
  }
  const view = await cartView(c.env.DB, id);
  if (c.req.query("menu") === "1") {
    const ctx = await getBranch(c.env.DB, tok.b);
    const meta = await c.env.DB.prepare("SELECT kind, ref_id FROM sessions WHERE id = ?").bind(id).first<{ kind: string; ref_id: string | null }>();
    let tables: string[] = [];
    if (meta?.kind === "table" && meta.ref_id) {
      const s = await c.env.DB.prepare("SELECT table_ids FROM seatings WHERE id = ?").bind(meta.ref_id).first<{ table_ids: string }>();
      const ids = s ? (JSON.parse(s.table_ids) as string[]) : [];
      if (ids.length) tables = (await c.env.DB.prepare(`SELECT label FROM floor_tables WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all<{ label: string }>()).results.map((r) => r.label);
    }
    return {
      ...view,
      tables,
      branch: { id: ctx.branch.id, name: ctx.branch.name, restaurant: ctx.tenant.name, currency: ctx.config.currency, serviceChargePct: ctx.config.serviceChargePct, taxPct: ctx.config.taxPct, taxInclusive: ctx.config.taxInclusive, cashRounding: ctx.config.cashRounding },
      menu: await getMenu(c.env.DB, ctx.tenant.id, ctx.branch.id),
    };
  }
  return view;
});
