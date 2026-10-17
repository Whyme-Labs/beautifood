// Host stand: queue with ETAs, strategy suggestions, floor, open seatings and diner requests.
import { api } from "../../../../../src/server/http";
import { staffBranch } from "../../../../../src/server/routing";
import { queueBoard } from "../../../../../src/server/domain/floor";

export const GET = api(async (c) => {
  const { ctx } = await staffBranch(c, "queue.operate");
  const [board, calls, cursor] = await Promise.all([
    queueBoard(c.env.DB, ctx),
    c.env.DB.prepare("SELECT data, at FROM events WHERE branch_id = ? AND type = 'session.staff_called' AND at > ? ORDER BY id DESC LIMIT 30").bind(ctx.branch.id, Date.now() - 30 * 60_000).all<{ data: string; at: number }>(),
    c.env.DB.prepare("SELECT COALESCE(MAX(id), 0) AS id FROM events WHERE branch_id = ?").bind(ctx.branch.id).first<{ id: number }>(),
  ]);
  return { ...board, config: ctx.config, staffCalls: calls.results.map((r) => ({ ...JSON.parse(r.data), at: r.at })), cursor: cursor?.id ?? 0 };
});
