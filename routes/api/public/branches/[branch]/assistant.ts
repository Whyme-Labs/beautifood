// The in-app AI menu assistant (signatures, allergens, dish stories, budget & diet filters).
import { z } from "zod";
import { api, body } from "../../../../../src/server/http";
import { appEnv } from "../../../../../src/server/appenv";
import { getBranch } from "../../../../../src/server/domain/context";
import { customerChat } from "../../../../../src/server/ai";
import { fail } from "../../../../../src/server/errors";
import { requestLocale } from "../../../../../src/server/locale";

const Chat = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) })).min(1).max(20),
});

export const POST = api(async (c) => {
  const { messages } = await body(c, Chat);
  const ctx = await getBranch(c.env.DB, c.req.param("branch")!);
  if (!ctx.config.modules.aiAssistant) fail(409, "assistant_off", "The menu assistant is turned off here");
  return customerChat(c.env.DB, appEnv(), ctx, messages, requestLocale(c.req));
});
