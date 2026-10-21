// Scoring models on the guest cases with the Worker's own Workers AI binding (no extra token).
// Answers one question about the sample restaurant with the given model, and what the rules engine
// and the deployed assistant (engine first, model for the rest, allergen guard) would say. Only
// with the one-off key the eval workflow sets (EVAL_KEY); without it this route doesn't exist.
import { z } from "zod";
import { env } from "void/env";
import { api, body } from "../../../src/server/http";
import { fail } from "../../../src/server/errors";
import { answerWithModel, type AiBinding } from "../../../src/server/ai/guestModel";
import { answerLocally, type AssistantReply } from "../../../src/server/ai/local";
import { guard } from "../../../src/server/ai";
import { sampleContext } from "../../../src/server/ai/evalFixture";
import type { Usage } from "../../../src/server/ai/usage";

function sameKey(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export const POST = api(async (c) => {
  const key = env.EVAL_KEY;
  if (!key || key.length < 32 || !sameKey(c.req.header("x-eval-key") ?? "", key)) fail(404, "not_found", "Not found");
  const ai = (c.env as { AI?: AiBinding }).AI;
  if (!ai) fail(503, "no_ai", "This deployment has no Workers AI binding");
  const input = await body(
    c,
    z.object({
      model: z.string().regex(/^@cf\/[\w.\-/]+$/, "Workers AI models only"),
      question: z.string().min(1).max(500),
      lang: z.enum(["en", "zh"]),
      mode: z.enum(["inline", "tools"]).optional(),
      before: z.array(z.object({ question: z.string().max(500), answer: z.string().max(2000) })).max(4).optional(),
    }),
  );
  const ctx = sampleContext();
  const history = [...(input.before ?? []).flatMap((b) => [{ role: "user" as const, content: b.question }, { role: "assistant" as const, content: b.answer }]), { role: "user" as const, content: input.question }];
  const uses: Usage[] = [];
  const t0 = Date.now();
  let model: AssistantReply;
  let error: string | null = null;
  try {
    model = await answerWithModel({ provider: "workers-ai", model: input.model, ai }, ctx, history, input.lang, (u) => uses.push(u), { mode: input.mode });
  } catch (e) {
    error = (e as Error).message;
    model = { answer: `(error) ${error}`, items: [], engine: "model" };
  }
  const ms = Date.now() - t0;
  const local = answerLocally(ctx, input.question, input.lang);
  const deployed = local.confident || error ? local : guard(ctx, input.question, model, local, input.lang);
  return { model, deployed, uses, ms, error };
});
