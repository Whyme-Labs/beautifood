// The model reader: a language model reads a guest's latest message into a reading (./reading),
// the dishes and add-ons it orders, as lines of this menu. It reads; it never answers. The menu
// brain prices what it read, checks it and writes the reply, and a reading that names anything the
// menu doesn't have is cut back by `checkReading` before it gets there. What a guest avoids is read
// by the rules alone, so a model can't make an answer less safe.
//
// Off unless READER_PROVIDER is set (it takes the same providers as ../guestModel: "workers-ai" or an
// OpenAI-style endpoint, READER_BASE_URL / READER_API_KEY / READER_MODEL), and only after it has
// been scored on the benchmark (bench/run.ts --reader).
import { optionLabel } from "./modifiers";
import { checkReading, dishKey, type RawOrderReading, type OrderReading } from "./reading";
import type { Dish } from "./understand";
import type { AiBinding } from "../guestModel";

/** One call to a model: the system prompt, the user message and the JSON schema; the text it returns. */
export type ReaderCall = (system: string, user: string, schema: Record<string, unknown>) => Promise<string>;

export interface ReaderEnv {
  READER_PROVIDER?: string;
  READER_MODEL?: string;
  READER_BASE_URL?: string;
  READER_API_KEY?: string;
  AI?: AiBinding;
}

const GUIDE = `You read a restaurant guest's chat message into the lines it orders or asks about, using only the menu below.
Each menu line is: KEY | dish name | Chinese name | its choices ("Group: option, option").
Return JSON only:
- lines: one per dish the message names, with "dish" the menu KEY, "count" how many (1 if not said), "options" the menu's own option names it asks for, and "off" the options it takes off. When the guest splits one dish ("2 nasi lemak, one with egg, the other large"), give a line for each part.
- unmatched: words for dishes or add-ons the guest names that this menu doesn't have.
- total: true if they ask for the total or the bill. each: true if they ask what each person pays.
Guests write English, Malay, Manglish and Chinese, with typos and short forms ("ais" is iced, "kurang manis" is less sweet, "tapau" is takeaway, "besar" is large, "一杯" is one cup). Don't add dishes or options the message doesn't name. Don't read a word as a dish just because it is a food word in another language.

Example menu:
D1 | Nasi Lemak | 椰浆饭 | Size: Regular, Large (+RM2.00); Add-ons: Fried egg (+RM1.50), Extra sambal (+RM1.00)
D2 | Teh Tarik | 拉茶 | Temperature: Hot, Iced (+RM0.30); Sugar: Normal, Less sweet
D3 | Roti Canai | 印度煎饼 |
Message: 2 nasi lemak, one with fried egg, the other one large. 3 teh tarik ais kurang manis and a mee rebus, total?
JSON: {"lines":[{"dish":"D1","count":1,"options":["Fried egg"],"off":[]},{"dish":"D1","count":1,"options":["Large"],"off":[]},{"dish":"D2","count":3,"options":["Iced","Less sweet"],"off":[]}],"unmatched":["mee rebus"],"total":true,"each":false}
Message: 两份椰浆饭，一份加蛋，一杯冰拉茶
JSON: {"lines":[{"dish":"D1","count":1,"options":[],"off":[]},{"dish":"D1","count":1,"options":["Fried egg"],"off":[]},{"dish":"D2","count":1,"options":["Iced"],"off":[]}],"unmatched":[],"total":false,"each":false}
Message: is the roti canai spicy?
JSON: {"lines":[{"dish":"D3","count":1,"options":[],"off":[]}],"unmatched":[],"total":false,"each":false}`;

/** The menu as the reader sees it: a key per dish, its names and its choices (the same bytes every time, so a provider can cache it). */
export function readerMenu(dishes: Dish[], money: (n: number) => string): string {
  return dishes
    .map((d, k) => {
      const zh = Object.values(d.translations ?? {}).map((t) => t?.name ?? "").find((n) => /[一-鿿]/.test(n)) ?? "";
      const groups = (d.modifiers ?? []).map((g) => `${g.name}: ${g.options.map((o) => `${o.name}${o.price ? ` (+${money(o.price)})` : ""}`).join(", ")}`).join("; ");
      return `${dishKey(k)} | ${d.name} | ${zh} | ${groups}`;
    })
    .join("\n");
}

/** The JSON a reader must return; the dish is one of this menu's keys. */
export function readerSchema(dishes: Dish[]): Record<string, unknown> {
  const strings = { type: "array", items: { type: "string" } };
  return {
    type: "object",
    properties: {
      lines: { type: "array", items: { type: "object", properties: { dish: { type: "string", enum: dishes.map((_, k) => dishKey(k)) }, count: { type: "integer" }, options: strings, off: strings }, required: ["dish", "count", "options", "off"] } },
      unmatched: strings,
      total: { type: "boolean" },
      each: { type: "boolean" },
    },
    required: ["lines", "unmatched", "total", "each"],
  };
}

/** The system prompt for a menu (the guide, then the menu). */
export const readerSystem = (dishes: Dish[], money: (n: number) => string) => `${GUIDE}\n\nThe menu:\n${readerMenu(dishes, money)}`;

/**
 * The latest message read by a model, checked against the menu. `dishes` is what can be ordered
 * now, in a fixed order (its keys are their places). Null when the model fails or returns no JSON:
 * the rules then read it alone.
 */
export async function readWithModel(call: ReaderCall, dishes: Dish[], message: string, money: (n: number) => string): Promise<OrderReading | null> {
  let text: string;
  try {
    text = await call(readerSystem(dishes, money), `Message: ${message}\nJSON:`, readerSchema(dishes));
  } catch {
    return null;
  }
  const json = text.replace(/<think>[\s\S]*?<\/think>/g, "").match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  let raw: RawOrderReading;
  try {
    raw = JSON.parse(json) as RawOrderReading;
  } catch {
    return null;
  }
  return checkReading(raw, dishes, () => true, message);
}

/** A reader call to an OpenAI-style endpoint (llama.cpp's server, OpenRouter, …), with the JSON schema enforced. */
export const openAiReader = (baseUrl: string, apiKey: string, model: string): ReaderCall => async (system, user, schema) => {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature: 0, max_tokens: 400, response_format: { type: "json_schema", json_schema: { name: "reading", schema } } }),
  });
  if (!res.ok) throw new Error(`reader ${res.status}`);
  const r = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return r.choices?.[0]?.message?.content ?? "";
};

/** A reader call through the Workers AI binding, in its JSON mode. */
export const workersAiReader = (ai: AiBinding, model: string): ReaderCall => async (system, user, schema) => {
  const r = (await ai.run(model, { messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature: 0, max_tokens: 400, response_format: { type: "json_schema", json_schema: schema } })) as { response?: unknown };
  return typeof r.response === "string" ? r.response : JSON.stringify(r.response ?? {});
};

/** The configured reader, or null (the rules read alone). */
export function modelReader(env: ReaderEnv): ReaderCall | null {
  const p = env.READER_PROVIDER?.trim().toLowerCase();
  const model = env.READER_MODEL?.trim();
  if (p === "workers-ai" && env.AI && model) return workersAiReader(env.AI, model);
  if (p === "openai" && env.READER_BASE_URL && model) return openAiReader(env.READER_BASE_URL, env.READER_API_KEY ?? "none", model);
  return null;
}

/** An option as the guest reads it, for logs. */
export const optionNames = (r: OrderReading) => r.lines.map((l) => `${l.count}× ${l.dish.name}${l.options.length ? ` (${l.options.map(optionLabel).join(", ")})` : ""}`);
