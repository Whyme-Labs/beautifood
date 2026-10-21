// An optional language model behind the guest assistant, for what the menu brain (./brain) can't
// place (off-topic or unclear questions). Any provider with an OpenAI-style chat
// API works: Workers AI (a binding on our own Cloudflare account, e.g. Gemma 4), DeepSeek,
// OpenRouter, and so on; Anthropic goes through ./claude. It sees only the restaurant's menu: in
// the prompt for a normal menu (one call), or through the menu tools for a very large one.
//
// Off unless ASSISTANT_PROVIDER says otherwise (or an Anthropic key is set, as before): a model goes
// live only after it has been scored on the guest cases (src/shared/assistantEval.ts, test/eval).
import type { AssistantContext, AssistantReply } from "./local";
import { MENU_TOOLS, runTool, systemPrompt } from "./claude";
import type { Usage } from "./usage";

export const DEFAULT_WORKERS_MODEL = "@cf/google/gemma-4-26b-a4b-it";
export const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-5-5";

export interface AiBinding {
  run: (model: string, input: Record<string, unknown>) => Promise<unknown>;
}

export interface GuestModelEnv {
  ASSISTANT_PROVIDER?: string;
  ASSISTANT_MODEL?: string;
  ASSISTANT_BASE_URL?: string;
  ASSISTANT_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  AI?: AiBinding;
}

export type GuestModel =
  | { provider: "workers-ai"; model: string; ai: AiBinding }
  | { provider: "openai"; model: string; baseUrl: string; apiKey: string }
  | { provider: "anthropic"; model: string };

/** The configured model, or null (the menu brain answers alone). */
export function guestModel(env: GuestModelEnv): GuestModel | null {
  const p = env.ASSISTANT_PROVIDER?.trim().toLowerCase();
  const model = env.ASSISTANT_MODEL?.trim();
  if (p === "workers-ai") return env.AI ? { provider: "workers-ai", model: model || DEFAULT_WORKERS_MODEL, ai: env.AI } : null;
  if (p === "openai") return env.ASSISTANT_BASE_URL && env.ASSISTANT_API_KEY && model ? { provider: "openai", model, baseUrl: env.ASSISTANT_BASE_URL.replace(/\/$/, ""), apiKey: env.ASSISTANT_API_KEY } : null;
  if (p === "anthropic" || (!p && env.ANTHROPIC_API_KEY)) return env.ANTHROPIC_API_KEY ? { provider: "anthropic", model: model || DEFAULT_ANTHROPIC_MODEL } : null;
  return null;
}

// ---- OpenAI-style chat with tools ----

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

type Msg = { role: "system" | "user" | "assistant"; content: string | null; tool_calls?: ToolCall[] } | { role: "tool"; tool_call_id: string; content: string };

const TOOLS = MENU_TOOLS.map((t) => ({ type: "function" as const, function: { name: t.name, description: t.description, parameters: t.input_schema } }));

interface Turn {
  content: string | null;
  toolCalls: ToolCall[];
  usage: { input: number; output: number };
}

/** Read either Workers AI's own reply shape or the OpenAI one. */
export function readTurn(raw: unknown): Turn {
  const r = raw as {
    response?: string | null;
    tool_calls?: { id?: string; name?: string; arguments?: unknown; function?: { name: string; arguments: unknown } }[];
    choices?: { message?: { content?: string | null; tool_calls?: { id?: string; function: { name: string; arguments: unknown } }[] } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const msg = r.choices?.[0]?.message;
  const calls = msg?.tool_calls ?? r.tool_calls ?? [];
  return {
    content: (msg ? msg.content : r.response) ?? null,
    toolCalls: calls.map((c, n) => {
      const fn = "function" in c && c.function ? c.function : { name: (c as { name?: string }).name ?? "", arguments: (c as { arguments?: unknown }).arguments };
      return { id: c.id ?? `call_${n}`, type: "function", function: { name: fn.name, arguments: typeof fn.arguments === "string" ? fn.arguments : JSON.stringify(fn.arguments ?? {}) } };
    }),
    usage: { input: r.usage?.prompt_tokens ?? 0, output: r.usage?.completion_tokens ?? 0 },
  };
}

async function complete(m: Exclude<GuestModel, { provider: "anthropic" }>, messages: Msg[], inline = false): Promise<Turn> {
  const body = { messages, ...(inline ? {} : { tools: TOOLS }), max_tokens: 600, temperature: 0.3 };
  if (m.provider === "workers-ai") return readTurn(await m.ai.run(m.model, body));
  const res = await fetch(`${m.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${m.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model: m.model, ...body }),
  });
  if (!res.ok) throw new Error(`model ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return readTurn(await res.json());
}

/** The menu as compact lines for the prompt: what's served now, with the facts that matter. */
export function menuForPrompt(ctx: AssistantContext): string {
  return ctx.items
    .filter((i) => i.active && !i.soldOut && i.servedNow !== false)
    .map((i) =>
      [
        i.name,
        `RM${(i.price / 100).toFixed(2)}`,
        i.category ?? "",
        i.isSignature ? "signature" : "",
        i.spiceLevel ? `spice ${i.spiceLevel}/3` : "not spicy",
        i.dietary.length ? i.dietary.join(", ") : "",
        `allergens: ${i.allergens.length ? i.allergens.join(", ") : "none listed"}`,
        i.description ? `— ${i.description.slice(0, 120)}` : "",
      ]
        .filter(Boolean)
        .join(" | "),
    )
    .join("\n");
}

/** Menus up to this many dishes go into the prompt (one fast call); bigger ones are looked up through tools. */
const INLINE_MAX = 120;

/**
 * Answer with an OpenAI-style model. A normal menu goes into the prompt so it's one call; a very
 * large one is looked up through the menu tools.
 */
export async function answerWithModel(
  m: Exclude<GuestModel, { provider: "anthropic" }>,
  ctx: AssistantContext,
  history: { role: "user" | "assistant"; content: string }[],
  locale: string,
  onUsage: (u: Usage) => void,
  opts: { mode?: "inline" | "tools" } = {},
): Promise<AssistantReply> {
  const inline = (opts.mode ?? (ctx.items.length <= INLINE_MAX ? "inline" : "tools")) === "inline";
  const system = inline
    ? `${systemPrompt(ctx, locale)}\nThe menu (only these dishes exist; allergens are as listed, never assume more or less):\n${menuForPrompt(ctx)}\nWrite dish names exactly as on the menu.`
    : systemPrompt(ctx, locale);
  const messages: Msg[] = [{ role: "system", content: system }, ...history.slice(-10).map((h) => ({ role: h.role, content: h.content }))];
  const referenced = new Set<string>();
  for (let turn = 0; turn < 5; turn++) {
    const t = await complete(m, messages, inline);
    onUsage({ model: m.model, ...t.usage });
    if (t.toolCalls.length && !inline) {
      const calls = t.toolCalls.map((call) => {
        let args: unknown = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          /* small models sometimes send broken JSON: run with defaults */
        }
        return { call, args };
      });
      // send back arguments as valid JSON, or the API refuses the whole conversation
      messages.push({ role: "assistant", content: t.content ?? "", tool_calls: calls.map(({ call, args }) => ({ ...call, function: { name: call.function.name, arguments: JSON.stringify(args ?? {}) } })) });
      for (const { call, args } of calls) messages.push({ role: "tool", tool_call_id: call.id, content: runTool(ctx, call.function.name, args, referenced) });
      continue;
    }
    const text = (t.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    if (!text) break;
    for (const it of ctx.items) if (text.toLowerCase().includes(it.name.toLowerCase())) referenced.add(it.id);
    return {
      answer: text,
      items: [...referenced]
        .map((id) => ctx.items.find((i) => i.id === id)!)
        .filter(Boolean)
        .slice(0, 4)
        .map((i) => ({ id: i.id, name: i.name, price: i.price })),
      engine: "model",
    };
  }
  throw new Error("no answer from model");
}

/** A Workers AI binding over the REST API, for scoring models outside a Worker (test/eval). */
export function workersAiRest(accountId: string, token: string): AiBinding {
  return {
    run: async (model, input) => {
      let r: Response | null = null;
      // some models allow only a few requests a minute: wait and retry on 429
      for (let attempt = 0; attempt < 6; attempt++) {
        r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify(input),
        });
        if (r.status !== 429) break;
        await new Promise((ok) => setTimeout(ok, 4000 * (attempt + 1)));
      }
      const j = (await r!.json().catch(() => ({}))) as { result?: unknown; errors?: { message: string }[] };
      if (!r!.ok) throw new Error(`workers ai ${r!.status}: ${j.errors?.[0]?.message ?? ""}`);
      return j.result;
    },
  };
}
