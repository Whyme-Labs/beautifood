// The browser reader's output, made a typed turn reading (./turnReading). The model (GLiNER2.5-multi's
// encoder with our heads, scripts/reader/train_gl.py) marks the guest's own words: which name a dish of
// this menu or point at one ("the first one", "that"), the count, add-ons and owner said with each, and
// what each does to the order. What's left is plain: a count said in words or Chinese numerals is a
// number; a pointer is the dish it points at in the assistant's last reply (or the order, for "that");
// "I"/"saya"/"我" is "me". `applyTurn` then makes the changes, and refuses what doesn't fit.
import { normalize } from "../../../shared/brain/text";
import { applyTurn, type OrderLineT, type TurnAct, type TurnItem, type TurnReading } from "./turnReading";
import type { Dish } from "./understand";

/** One reading as the model gives it (the guest's words for each part, names as the menu's). */
export interface GlItem {
  dish?: string;
  pointer?: boolean;
  text: string;
  change: TurnItem["change"];
  count?: string;
  owner?: string;
  options?: string[];
  removeOptions?: string[];
}
export interface GlReading {
  acts: string[];
  items: GlItem[];
  /** How sure the model was of its least sure decision (0.5-1). */
  sure?: number;
}
/** Sends a message (with the menu and the dishes on the order) to the reader; resolves to its reading. */
export type GlCall = (text: string, menu: { name: string; zh?: string; groups: { name: string; options: string[] }[] }[], order: string[]) => Promise<GlReading>;

const WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, satu: 1, se: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, lapan: 8, sembilan: 9, sepuluh: 10, both: 2 };
const ZH: Record<string, number> = { 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

/** "2", "two", "dua", "两", "十二", "x3": a number, or undefined. */
export function countOf(said?: string): number | undefined {
  if (!said) return undefined;
  const digits = said.match(/\d+/);
  if (digits) return Number(digits[0]);
  for (const w of normalize(said).split(" ")) if (WORDS[w] !== undefined) return WORDS[w];
  const zh = [...said].filter((c) => ZH[c] !== undefined);
  if (!zh.length) return undefined;
  if (zh[0] === "十") return 10 + (ZH[zh[1]] ?? 0);
  return zh.length >= 2 && zh[1] === "十" ? ZH[zh[0]] * 10 + (ZH[zh[2]] ?? 0) : ZH[zh[0]];
}

const ORDINALS: [RegExp, number][] = [
  [/\b(first|1st|pertama)\b|第一|头一/i, 0], [/\b(second|2nd|kedua)\b|第二/i, 1], [/\b(third|3rd|ketiga)\b|第三/i, 2],
  [/\b(fourth|4th|keempat)\b|第四/i, 3], [/\b(fifth|5th|kelima)\b|第五/i, 4],
];
/** The dishes a reply names, in the order it names them (by name or Chinese name). */
export function listed(reply: string, dishes: Dish[]): Dish[] {
  const at = (d: Dish) => {
    const names = [d.name, ...Object.values(d.translations ?? {}).map((t) => t?.name ?? "")].filter((n) => n.length > 1);
    const hits = names.map((n) => reply.toLowerCase().indexOf(n.toLowerCase())).filter((k) => k >= 0);
    return hits.length ? Math.min(...hits) : -1;
  };
  return dishes.map((d) => [d, at(d)] as const).filter(([, k]) => k >= 0).sort((a, b) => a[1] - b[1]).map(([d]) => d);
}
/** The dish "the first one", "the last one", "that", "the other one" points at: in the last reply's list, else the order. */
export function pointedDish(words: string, reply: string, order: OrderLineT[], dishes: Dish[]): string | undefined {
  const shown = listed(reply, dishes);
  for (const [re, k] of ORDINALS) if (re.test(words)) return shown[k]?.name;
  if (/\b(last|terakhir)\b|最后/i.test(words)) return shown[shown.length - 1]?.name;
  if (shown.length === 1) return shown[0].name;
  // ("that", "the other one", "same"): what was last ordered
  return order[order.length - 1]?.dish ?? shown[shown.length - 1]?.name;
}
const owner = (said?: string) => {
  if (!said) return undefined;
  const w = normalize(said);
  if (/^(i|me|myself|mine|my|saya|aku|i m|i ll)$/.test(w) || /^我/.test(said.trim())) return "me";
  const last = w.split(" ").filter((x) => !/^(my|the|saya|aku|punya)$/.test(x)).pop();
  return last && last.length <= 20 ? last : undefined;
};

/** The model's reading as a typed turn reading (dish names resolved, counts numbers, owners named). */
export function toTurnReading(r: GlReading, reply: string, order: OrderLineT[], dishes: Dish[]): TurnReading {
  const items: TurnItem[] = [];
  for (const it of r.items) {
    const dish = it.pointer ? pointedDish(it.text, reply, order, dishes) : it.dish;
    if (!dish) continue;
    items.push({
      change: it.change, dish,
      ...(countOf(it.count) !== undefined ? { count: countOf(it.count) } : {}),
      ...(it.options?.length ? { options: it.options } : {}),
      ...(it.removeOptions?.length ? { removeOptions: it.removeOptions } : {}),
      ...(owner(it.owner) ? { owner: owner(it.owner) } : {}),
    });
  }
  return { acts: r.acts as TurnAct[], items };
}

/** The menu as the reader takes it. */
export const readerMenu = (dishes: Dish[]) => dishes.map((d) => ({ name: d.name, zh: d.translations?.zh?.name, groups: (d.modifiers ?? []).map((g) => ({ name: g.name, options: g.options.map((o) => o.name) })) }));

/** The order after `message` as the browser reader reads it, or null (it failed, or a change didn't fit: the rules answer). */
export async function readTurn(call: GlCall, dishes: Dish[], order: OrderLineT[], reply: string, message: string, minSure = 0): Promise<{ order: OrderLineT[]; reading: TurnReading } | null> {
  try {
    const raw = await call(message, readerMenu(dishes), order.map((l) => l.dish));
    // (unsure: the rules answer)
    if ((raw.sure ?? 1) < minSure) return null;
    const reading = toTurnReading(raw, reply, order, dishes);
    const r = applyTurn(order, reading, dishes);
    return r.errors.length ? null : { order: r.order, reading };
  } catch {
    return null;
  }
}
