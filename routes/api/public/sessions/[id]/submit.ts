// Send the shared cart to the kitchen (optimistic concurrency on the cart version; idempotent by msgId).
import { z } from "zod";
import { api, body } from "../../../../../src/server/http";
import { customerToken, kick } from "../../../../../src/server/routing";
import { getBranch } from "../../../../../src/server/domain/context";
import { cartView, submitCart } from "../../../../../src/server/domain/orders";
import { Participant } from "../../../../../src/server/schemas";

const Submit = z.object({ participant: Participant, expectedVersion: z.number().int().min(0), msgId: z.string().min(8).max(80) });

export const POST = api(async (c) => {
  const id = c.req.param("id")!;
  const tok = await customerToken(c, "session", id);
  const input = await body(c, Submit);
  const result = await submitCart(c.env.DB, await getBranch(c.env.DB, tok.b), id, input.participant, input.expectedVersion, input.msgId);
  kick(c);
  return { ...result, cart: await cartView(c.env.DB, id) };
});
