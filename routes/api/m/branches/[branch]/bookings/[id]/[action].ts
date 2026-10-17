// check_in | cancel | no_show
import { z } from "zod";
import { api, body } from "../../../../../../../src/server/http";
import { actorOf, staffBranch } from "../../../../../../../src/server/routing";
import { checkIn, setBookingStatus } from "../../../../../../../src/server/domain/bookings";
import { fail } from "../../../../../../../src/server/errors";

export const POST = api(async (c) => {
  const { staff, ctx } = await staffBranch(c, "booking.manage");
  const id = c.req.param("id")!;
  switch (c.req.param("action")) {
    case "check_in": {
      const { tableIds } = await body(c, z.object({ tableIds: z.array(z.string()).optional() }));
      return checkIn(c.env.DB, ctx, actorOf(staff), id, tableIds);
    }
    case "cancel":
    case "no_show":
      await setBookingStatus(c.env.DB, ctx, actorOf(staff), id, c.req.param("action") === "cancel" ? "cancelled" : "no_show");
      return { ok: true };
    default:
      fail(404, "not_found", "Unknown action");
  }
});
