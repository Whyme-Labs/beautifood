// A guest changed the order card of a bill the assistant worked out: their order, kept beside the one
// it read, for the learning loop (a labelled turn: what was said, what it read, what they meant).
import { z } from "zod";
import { api, body } from "../../../../../../src/server/http";
import { getBranch } from "../../../../../../src/server/domain/context";
import { OrderLinesSchema, recordCorrection } from "../../../../../../src/server/ai/brain/log";
import { assistantContext } from "../../../../../../src/server/ai";

const Corrected = z.object({ turn: z.string().min(1).max(64), lines: OrderLinesSchema });

export const POST = api(async (c) => {
  const { turn, lines } = await body(c, Corrected);
  const ctx = await getBranch(c.env.DB, c.req.param("branch")!);
  const menu = await assistantContext(c.env.DB, ctx);
  return { kept: await recordCorrection(c.env.DB, ctx.branch.id, turn, lines, new Set(menu.items.map((i) => i.id))) };
});
