// A guest added a dish from one of the assistant's answers: the outcome the learning loop ranks by.
import { z } from "zod";
import { api, body } from "../../../../../../src/server/http";
import { getBranch } from "../../../../../../src/server/domain/context";
import { recordAdd } from "../../../../../../src/server/ai/brain/log";

const Added = z.object({ turn: z.string().min(1).max(64), item: z.string().min(1).max(64) });

export const POST = api(async (c) => {
  const { turn, item } = await body(c, Added);
  const ctx = await getBranch(c.env.DB, c.req.param("branch")!);
  return { counted: await recordAdd(c.env.DB, ctx.branch.id, turn, item) };
});
