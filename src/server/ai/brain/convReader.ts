// A conversation reader: a small model that reads one guest turn at a time and gives back the order
// as it now stands, given the order so far (as it last gave it), the assistant's last reply and the
// guest's message. The edits a guest makes across turns ("remove the extra patty", "make it 2 only,
// one of them iced", "one of the laksa change to asam laksa", "the first one, large", "I only had
// the X") are its to read; the brain still prices, checks and answers (./reading `checkBasket`, and
// the bill in ./index). Off unless a server for it is set.
//
// The prompt lists only the dishes the conversation could mean (`candidates`): the order's, and those
// whose name the message or the last reply has a word or two characters of. The model answers in
// lines, one per order line: "2 x D3: Large; Extra egg @me" (count, dish key, add-ons, whose).
import { normalize } from "../../../shared/brain/text";
import { dishKey, type RawOrderReading } from "./reading";
import { same, type Dish } from "./understand";

export interface BasketLine {
  dish: Dish;
  count: number;
  /** Add-on names, as the menu has them. */
  options: string[];
  owner?: string;
}

/** At most this many dishes in a prompt. */
const MAX_MENU = 12;
const NOTHING = "(nothing)";

const nameWords = (d: Dish) => normalize(d.name.replace(/[()]/g, " ")).split(" ").filter((w) => w.length >= 3);
const zhOf = (d: Dish) => Object.values(d.translations ?? {}).map((t) => t?.name ?? "").filter((n) => /[一-鿿]/.test(n));

/**
 * The dishes a turn could mean, in menu order: those on the order so far, then those whose name the
 * texts share a word with (in any spelling the rules accept, so a typo too) or two characters of
 * its Chinese name, most words first.
 */
export function candidates(dishes: Dish[], texts: string[], order: Dish[]): Dish[] {
  const toks = [...new Set(texts.flatMap((t) => normalize(t).split(" ")).filter((w) => w.length >= 3))];
  const han = texts.join(" ");
  // (a word many dishes share, "fish" or "rice", says less than one only a few have, "kopi")
  const df = new Map<string, number>();
  for (const d of dishes) for (const w of new Set(nameWords(d))) df.set(w, (df.get(w) ?? 0) + 1);
  const score = (d: Dish) => {
    const words = nameWords(d).filter((w) => toks.some((t) => same(t, w))).reduce((n, w) => n + 1 / (df.get(w) ?? 1), 0);
    const zh = zhOf(d).reduce((n, z) => n + [...z].filter((_, k) => k + 2 <= z.length && han.includes(z.slice(k, k + 2))).length, 0);
    return words + zh;
  };
  const scored = dishes.map((d) => ({ d, s: score(d) })).filter((x) => x.s > 0 && !order.includes(x.d)).sort((a, b) => b.s - a.s);
  const keep = new Set([...order, ...scored.slice(0, Math.max(0, MAX_MENU - order.length)).map((x) => x.d)]);
  return dishes.filter((d) => keep.has(d));
}

const menuLine = (d: Dish, k: number) =>
  `${dishKey(k)} | ${d.name} | ${zhOf(d)[0] ?? ""} | ${(d.modifiers ?? []).map((g) => `${g.name}: ${g.options.map((o) => o.name).join(", ")}`).join("; ")}`;

/** One order line as the model reads and writes it: "2 x D3: Large; Extra egg @me". */
export function basketLineText(l: BasketLine, menu: Dish[]): string {
  // (add-ons in the menu's order, so one order has one way to be written)
  const all = (l.dish.modifiers ?? []).flatMap((g) => g.options.map((o) => o.name));
  const options = [...l.options].sort((a, b) => all.indexOf(a) - all.indexOf(b));
  return `${l.count} x ${dishKey(menu.indexOf(l.dish))}${options.length ? `: ${options.join("; ")}` : ""}${l.owner ? ` @${l.owner}` : ""}`;
}

/** The prompt for one turn, and the dishes in it (their keys are their places in `menu`). */
export function basketPrompt(dishes: Dish[], order: BasketLine[], reply: string, message: string): { prompt: string; menu: Dish[] } {
  const menu = candidates(dishes, [message, reply], [...new Set(order.map((l) => l.dish))]);
  const said = (s: string) => s.replace(/\s+/g, " ").trim();
  const prompt = [
    "Menu:",
    ...menu.map(menuLine),
    "Order so far:",
    ...(order.length ? order.map((l) => basketLineText(l, menu)) : [NOTHING]),
    `Assistant: ${said(reply).slice(0, 240) || "-"}`,
    `Guest: ${said(message).slice(0, 300)}`,
    "Order now:",
    "",
  ].join("\n");
  return { prompt, menu };
}

/** The model's answer as order lines, by the full menu's keys (for `checkBasket`); a line it can't read is left out. */
export function parseBasket(text: string, menu: Dish[], dishes: Dish[]): RawOrderReading {
  const lines: NonNullable<RawOrderReading["lines"]> = [];
  for (const raw of text.split("\n")) {
    const m = /^\s*(\d{1,2})\s*x\s*D(\d{1,3})\s*(?::\s*([^@]*?))?\s*(?:@\s*([\p{L} ]{1,20}))?\s*$/u.exec(raw);
    if (!m) {
      if (raw.trim() && raw.trim() !== NOTHING) break;
      continue;
    }
    const dish = menu[Number(m[2]) - 1];
    if (!dish) continue;
    lines.push({ dish: dishKey(dishes.indexOf(dish)), count: Number(m[1]), options: (m[3] ?? "").split(";").map((x) => x.trim()).filter(Boolean), ...(m[4] ? { owner: m[4].trim() } : {}) });
  }
  return { lines };
}

/** Sends a prompt to the model and returns its text (a completion, greedy). */
export type BasketCall = (prompt: string) => Promise<string>;

/** A llama.cpp server's completion endpoint (`llama-server -m reader.gguf`). */
export const llamaBasketCall = (baseUrl: string, timeoutMs = 4000): BasketCall => async (prompt) => {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/completion`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt, n_predict: 160, temperature: 0, stop: ["\n\n", "Guest:", "Menu:"], cache_prompt: true }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`reader ${res.status}`);
  return ((await res.json()) as { content?: string }).content ?? "";
};

/** The order after `message`, as the model reads it (null if it can't be had). */
export async function readBasket(call: BasketCall, dishes: Dish[], order: BasketLine[], reply: string, message: string): Promise<RawOrderReading | null> {
  const { prompt, menu } = basketPrompt(dishes, order, reply, message);
  try {
    return parseBasket(await call(prompt), menu, dishes);
  } catch {
    return null;
  }
}
