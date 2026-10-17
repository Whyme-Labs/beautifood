// Host actions on a ticket: call | seat | cancel | no_show | requeue
import { z } from "zod";
import { api, body } from "../../../../../../../src/server/http";
import { actorOf, kick, staffBranch } from "../../../../../../../src/server/routing";
import { callTicket, cancelTicket, requeueTicket, seatTicket, toTicket } from "../../../../../../../src/server/domain/floor";
import { fail } from "../../../../../../../src/server/errors";

const Seat = z.object({ tableIds: z.array(z.string()).min(1).max(8), split: z.object({ parentId: z.string(), childSuffixes: z.array(z.string()).min(1) }).nullable().optional() });

export const POST = api(async (c) => {
  const { staff, ctx } = await staffBranch(c, "queue.operate");
  const id = c.req.param("id")!;
  const actor = actorOf(staff);
  let out: unknown;
  switch (c.req.param("action")) {
    case "call": {
      const { holdTableIds } = await body(c, z.object({ holdTableIds: z.array(z.string()).max(8).optional() }));
      out = toTicket(await callTicket(c.env.DB, ctx, actor, id, holdTableIds ?? []));
      break;
    }
    case "seat":
      out = await seatTicket(c.env.DB, ctx, actor, id, await body(c, Seat));
      break;
    case "cancel":
      await cancelTicket(c.env.DB, ctx, actor, id, "cancelled");
      out = { ok: true };
      break;
    case "no_show":
      await cancelTicket(c.env.DB, ctx, actor, id, "no_show");
      out = { ok: true };
      break;
    case "requeue":
      await requeueTicket(c.env.DB, ctx, actor, id);
      out = { ok: true };
      break;
    default:
      fail(404, "not_found", "Unknown action");
  }
  kick(c);
  return out;
});
