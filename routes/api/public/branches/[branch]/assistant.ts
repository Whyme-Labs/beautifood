// The in-app AI menu assistant (signatures, allergens, dish stories, budget & diet filters).
import { z } from "zod";
import { env } from "void/env";
import { api, body } from "../../../../../src/server/http";
import { appEnv } from "../../../../../src/server/appenv";
import { getBranch } from "../../../../../src/server/domain/context";
import { customerChat } from "../../../../../src/server/ai";
import type { AiBinding } from "../../../../../src/server/ai/guestModel";
import { fail } from "../../../../../src/server/errors";
import { requestLocale } from "../../../../../src/server/locale";
import { cleanHint } from "../../../../../src/shared/brain/avoidHint";

const Chat = z.object({
  // (a model's reading of what the guest avoids, from the hybrid reader in the browser: only added to the rules', never trusted beyond its fixed vocabulary)
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000), hint: z.unknown().optional() })).min(1).max(20),
});

export const POST = api(async (c) => {
  const { messages: said } = await body(c, Chat);
  const messages = said.map((m) => ({ role: m.role, content: m.content, ...(m.role === "user" && m.hint ? { hint: cleanHint(m.hint) } : {}) }));
  const ctx = await getBranch(c.env.DB, c.req.param("branch")!);
  if (!ctx.config.modules.aiAssistant) fail(409, "assistant_off", "The menu assistant is turned off here");
  return customerChat(c.env.DB, { ...appEnv(), TASTE_URL: env.TASTE_URL, TASTE_SECRET: env.TASTE_SECRET, AI: (c.env as { AI?: AiBinding }).AI }, ctx, messages, requestLocale(c.req));
});
