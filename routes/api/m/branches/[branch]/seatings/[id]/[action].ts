// add_tables | transfer | merge | close | link (dynamic QR for this seating)
import { z } from "zod";
import { api, body } from "../../../../../../../src/server/http";
import { actorOf, kick, staffBranch } from "../../../../../../../src/server/routing";
import { addTablesToSeating, closeSeating, getSeating, mergeSeatings, transferSeating } from "../../../../../../../src/server/domain/floor";
import { appEnv } from "../../../../../../../src/server/appenv";
import { fail } from "../../../../../../../src/server/errors";
import { sign } from "../../../../../../../src/server/sign";

const Ids = z.object({ tableIds: z.array(z.string()).min(1).max(8) });

export const POST = api(async (c) => {
  const { staff, ctx } = await staffBranch(c, "queue.operate");
  const id = c.req.param("id")!;
  const actor = actorOf(staff);
  switch (c.req.param("action")) {
    case "add_tables":
      return addTablesToSeating(c.env.DB, ctx, actor, id, (await body(c, Ids)).tableIds);
    case "transfer":
      await transferSeating(c.env.DB, ctx, actor, id, (await body(c, Ids)).tableIds);
      return { ok: true };
    case "merge":
      return mergeSeatings(c.env.DB, ctx, actor, id, (await body(c, z.object({ fromSeatingId: z.string() }))).fromSeatingId);
    case "close": {
      const { force } = await body(c, z.object({ force: z.boolean().optional() }));
      if (force && !["owner", "admin", "branch_manager"].includes(staff.role)) fail(403, "forbidden", "Only managers can close an unpaid table");
      const r = await closeSeating(c.env.DB, ctx, actor, id, !!force);
      kick(c);
      return r;
    }
    case "link": {
      const s = await getSeating(c.env.DB, id);
      if (s.status !== "open") fail(409, "seating_closed", "Seating is closed");
      const token = await sign(appEnv().TOKEN_SECRET, { k: "session", id: s.session_id, b: ctx.branch.id });
      return { sessionId: s.session_id, token, url: `/s/${s.session_id}?k=${encodeURIComponent(token)}` };
    }
    default:
      fail(404, "not_found", "Unknown action");
  }
});
