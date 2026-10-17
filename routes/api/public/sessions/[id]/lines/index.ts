import { z } from "zod";
import { api, body } from "../../../../../../src/server/http";
import { customerToken } from "../../../../../../src/server/routing";
import { getBranch } from "../../../../../../src/server/domain/context";
import { addLine, cartView } from "../../../../../../src/server/domain/orders";

import { Participant } from "../../../../../../src/server/schemas";

const Add = z.object({
  participant: Participant,
  itemId: z.string(),
  qty: z.number().int().min(1).max(50),
  modifiers: z.array(z.object({ group: z.string(), option: z.string() })).max(20).optional(),
  notes: z.string().max(200).optional(),
});

export const POST = api(async (c) => {
  const id = c.req.param("id")!;
  const tok = await customerToken(c, "session", id);
  const input = await body(c, Add);
  const lineId = await addLine(c.env.DB, await getBranch(c.env.DB, tok.b), id, input.participant, input);
  return c.json({ lineId, cart: await cartView(c.env.DB, id) }, 201);
});
