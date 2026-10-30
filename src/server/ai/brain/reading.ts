// A reading: what a guest's latest message orders, as lines of the menu's own dishes and add-ons,
// whoever read it. The rules (./understand, ./lines) are one reader; a language model can be another
// (./modelReader). Either way the reading only says what was asked for: the menu brain prices it,
// checks it and writes the answer, and what a guest avoids (allergens, diet, spice, alcohol) is
// read by the rules alone. A model's reading is checked against the live menu first (`checkReading`):
// a dish or add-on the menu doesn't have never reaches a bill; it is kept as `unmatched`.
import { normalize } from "../../../shared/brain/text";
import type { ModifierOption } from "../../../shared/types";
import { linesOf } from "./lines";
import { read, same, type Dish } from "./understand";

/** One line as a reader returns it: a dish by its catalogue key or name, how many, the add-ons asked for and taken off. */
export interface RawLine {
  dish: string;
  count?: number;
  options?: string[];
  off?: string[];
}
/** A reader's output, before it is checked. */
export interface RawOrderReading {
  lines?: RawLine[];
  /** Words for dishes or add-ons that the reader couldn't place on the menu. */
  unmatched?: string[];
  /** Whether the guest asks for the total, what each person pays. */
  total?: boolean;
  each?: boolean;
}

export interface ReadingLine {
  dish: Dish;
  count: number;
  options: ModifierOption[];
  off: ModifierOption[];
}
export interface OrderReading {
  source: "rules" | "model";
  lines: ReadingLine[];
  unmatched: string[];
  total: boolean;
  each: boolean;
  /** What was dropped in checking it, and why: for the log and the bench. */
  dropped: string[];
}

const MAX_COUNT = 20;
const key = (s: string) => normalize(s.replace(/[()（）]/g, " "));

/** The catalogue key a dish has in a model's prompt: its place on the menu, "D1", "D2", … */
export const dishKey = (k: number) => `D${k + 1}`;

/**
 * Whether `message` itself backs `dish`: a word of its name only it has on this menu (or all its
 * words), in any spelling the rules accept ("kari ayam" for chicken curry), or two characters of its
 * Chinese name. A reader may find a dish the rules missed, but not one the guest never named.
 */
export function grounded(dish: Dish, message: string, dishes: Dish[]): boolean {
  const zh = Object.values(dish.translations ?? {}).map((t) => t?.name ?? "").filter((n) => /[\u4e00-\u9fff]/.test(n));
  if (zh.some((n) => [...n].some((_, k) => k + 2 <= n.length && /[\u4e00-\u9fff]{2}/.test(n.slice(k, k + 2)) && message.includes(n.slice(k, k + 2))))) return true;
  const toks = normalize(message).split(" ").filter(Boolean);
  const words = (d: Dish) => normalize(d.name.replace(/[()]/g, " ")).split(" ").filter((w) => w.length >= 3);
  const said = (w: string) => toks.some((t) => same(t, w));
  const own = words(dish).filter((w) => !dishes.some((o) => o !== dish && words(o).includes(w)));
  return own.some(said) || (words(dish).length > 0 && words(dish).every(said));
}

/**
 * `raw` checked against `dishes` (the menu as it is now): each line's dish must be on it, orderable
 * and named in `message` (`grounded`), each add-on one of that dish's own, no more of a group than
 * it takes, and a count from 1 to 20. What fails is dropped, never guessed at.
 */
export function checkReading(raw: RawOrderReading, dishes: Dish[], orderable: (d: Dish) => boolean, message?: string): OrderReading {
  const dropped: string[] = [];
  const unmatched = (raw.unmatched ?? []).filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()).slice(0, 8);
  const lines: ReadingLine[] = [];
  for (const l of (raw.lines ?? []).slice(0, 12)) {
    if (!l || typeof l.dish !== "string") continue;
    const k = /^D(\d{1,3})$/i.exec(l.dish.trim());
    const dish = k ? dishes[Number(k[1]) - 1] : dishes.find((d) => key(d.name) === key(l.dish) || Object.values(d.translations ?? {}).some((t) => t?.name === l.dish.trim()));
    if (!dish) {
      dropped.push(`no dish "${l.dish}"`);
      unmatched.push(l.dish);
      continue;
    }
    if (!orderable(dish)) {
      dropped.push(`${dish.name} can't be ordered now`);
      continue;
    }
    if (message !== undefined && !grounded(dish, message, dishes)) {
      dropped.push(`${dish.name} isn't named in the message`);
      continue;
    }
    const count = Number.isInteger(l.count) && l.count! >= 1 && l.count! <= MAX_COUNT ? l.count! : l.count === undefined ? 1 : NaN;
    if (Number.isNaN(count)) {
      dropped.push(`${dish.name}: count ${l.count}`);
      continue;
    }
    const all = (dish.modifiers ?? []).flatMap((g) => g.options);
    const pick = (names: unknown) => {
      const out: ModifierOption[] = [];
      for (const n of Array.isArray(names) ? names : []) {
        if (typeof n !== "string") continue;
        const o = all.find((x) => key(x.name) === key(n));
        if (!o) dropped.push(`${dish.name} has no "${n}"`);
        else if (!out.includes(o)) out.push(o);
      }
      return out;
    };
    let options = pick(l.options);
    // (no more of a group than it takes: two sizes is a misreading, so the group's choice is dropped)
    for (const g of dish.modifiers ?? []) {
      const chosen = options.filter((o) => g.options.includes(o));
      if (chosen.length > (g.max ?? 1)) {
        dropped.push(`${dish.name}: ${chosen.length} of ${g.name} (takes ${g.max ?? 1})`);
        if ((g.max ?? 1) <= 1) options = options.filter((o) => !chosen.includes(o));
      }
    }
    lines.push({ dish, count, options, off: pick(l.off).filter((o) => !options.includes(o)) });
  }
  return { source: "model", lines, unmatched: [...new Set(unmatched)], total: raw.total === true, each: raw.each === true, dropped };
}

/** The same lines, as the dish ids and add-on names they hold (to compare two readers). */
export const linesKey = (lines: { dish: { id: string }; count: number; options?: { name: string }[] }[]) =>
  lines
    .map((l) => `${l.count}x${l.dish.id}[${(l.options ?? []).map((o) => o.name).sort().join(",")}]`)
    .sort()
    .join(" ");

/** The rules' reading of the same message, as lines (to tell when a model read it differently). */
export function rulesLines(dishes: Dish[], message: string) {
  const u = read(dishes, message);
  return linesOf(u.toks, u.spots, u.breaks).map((l) => ({ dish: l.dish, count: l.count, options: l.options }));
}
