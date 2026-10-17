// Cheap change feed for staff screens: "anything new since event #N?" (poll every 1-2s).
import { api } from "../../../../../src/server/http";
import { staffBranch } from "../../../../../src/server/routing";

export const GET = api(async (c) => {
  const { ctx } = await staffBranch(c, null);
  const since = Number(c.req.query("since") ?? 0);
  const rows = (
    await c.env.DB.prepare("SELECT id, type FROM events WHERE branch_id = ? AND id > ? ORDER BY id LIMIT 200").bind(ctx.branch.id, since).all<{ id: number; type: string }>()
  ).results;
  const cursor = rows.length ? rows[rows.length - 1].id : since;
  return { cursor, types: [...new Set(rows.map((r) => r.type))], scopes: [...new Set(rows.map((r) => r.type.split(".")[0]))] };
});
