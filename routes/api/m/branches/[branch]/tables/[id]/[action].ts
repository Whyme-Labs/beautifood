// split | unsplit | clean | block | unblock | delete | qr
import { api } from "../../../../../../../src/server/http";
import { actorOf, staffBranch } from "../../../../../../../src/server/routing";
import { deleteTable, setTableStatus, splitTable, unsplitTable } from "../../../../../../../src/server/domain/floor";
import { fail } from "../../../../../../../src/server/errors";

export const POST = api(async (c) => {
  const action = c.req.param("action")!;
  const { staff, ctx } = await staffBranch(c, action === "clean" ? "queue.operate" : "table.manage");
  const id = c.req.param("id")!;
  const actor = actorOf(staff);
  switch (action) {
    case "split":
      return { children: await splitTable(c.env.DB, ctx, actor, id) };
    case "unsplit":
      await unsplitTable(c.env.DB, ctx, actor, id);
      return { ok: true };
    case "clean":
    case "unblock":
      await setTableStatus(c.env.DB, ctx, actor, id, "free");
      return { ok: true };
    case "block":
      await setTableStatus(c.env.DB, ctx, actor, id, "blocked");
      return { ok: true };
    case "delete":
      await deleteTable(c.env.DB, ctx, actor, id);
      return { ok: true };
    default:
      fail(404, "not_found", "Unknown action");
  }
});
