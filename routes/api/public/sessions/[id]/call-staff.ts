// Diner taps "request bill" / "call waiter": recorded as an event the host stand sees.
import { z } from "zod";
import { api, body } from "../../../../../src/server/http";
import { customerToken } from "../../../../../src/server/routing";
import { getBranch, streams } from "../../../../../src/server/domain/context";
import { Tx } from "../../../../../src/server/tx";

export const POST = api(async (c) => {
  const id = c.req.param("id")!;
  const tok = await customerToken(c, "session", id);
  const { reason } = await body(c, z.object({ reason: z.enum(["bill", "waiter", "water", "help"]) }));
  const ctx = await getBranch(c.env.DB, tok.b);
  await new Tx(c.env.DB, { tenantId: ctx.tenant.id, branchId: ctx.branch.id, actor: "guest" })
    .assert("EXISTS (SELECT 1 FROM sessions WHERE id = ? AND status = 'open')", [id], 409, "cart_closed", "This table is closed")
    .event({ stream: streams.session(id), type: "session.staff_called", data: { reason, sessionId: id } })
    .commit();
  return { ok: true };
});
