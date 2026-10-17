import { z } from "zod";
import { api, body } from "../../../../../../src/server/http";
import { customerToken } from "../../../../../../src/server/routing";
import { getBranch } from "../../../../../../src/server/domain/context";
import { cartView, updateLine } from "../../../../../../src/server/domain/orders";
import { Participant } from "../../../../../../src/server/schemas";

const Patch = z.object({ participant: Participant, qty: z.number().int().min(0).max(50).optional(), notes: z.string().max(200).optional() });

export const PATCH = api(async (c) => {
  const id = c.req.param("id")!;
  const tok = await customerToken(c, "session", id);
  const input = await body(c, Patch);
  await updateLine(c.env.DB, await getBranch(c.env.DB, tok.b), id, input.participant, c.req.param("line")!, { qty: input.qty, notes: input.notes });
  return cartView(c.env.DB, id);
});
