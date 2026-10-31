// A typed reading of one guest turn: what kind of turn it is, and each change it makes to the order,
// in this menu's own dishes and add-ons. A reader (the browser model, ./convReader's successor) gives
// it; `applyTurn` makes the changes to the order so far, exactly, and refuses a change that doesn't
// fit (a dish the menu lacks, an add-on that isn't that dish's, a line that isn't on the order). The
// teacher's training data is checked the same way: a labelled turn whose changes don't produce the
// order it says they do is dropped.
import { same, type Dish } from "./understand";

/** What a turn is doing (one or more). */
export const TURN_ACTS = ["order", "change", "ask_total", "ask_price", "split", "ask_dish", "diet", "chat"] as const;
export type TurnAct = (typeof TURN_ACTS)[number];

/**
 * One change to the order:
 * - new: a line ordered ("2 nasi lemak with egg");
 * - more: more of a dish already ordered ("one more teh tarik");
 * - set_count: its count changed ("make it 2 only");
 * - remove: a dish taken off, all of it or `count` of it ("cancel the satay", "minus one kopi");
 * - swap_out / swap_in: a dish replaced by another, all of it or `count` of it ("change one laksa to asam laksa");
 * - modify: a line's add-ons changed ("make the teh tarik iced", "no need the egg");
 * - split_off: `count` of a line given other add-ons ("one of them iced");
 * - assign: whose a line is ("I had the ikan penyet", "my friend the soto").
 */
export const CHANGES = ["new", "more", "set_count", "remove", "swap_out", "swap_in", "modify", "split_off", "assign"] as const;
export type Change = (typeof CHANGES)[number];

export interface TurnItem {
  change: Change;
  /** The dish, by its menu name. */
  dish: string;
  count?: number;
  /** Add-ons put on, and taken off, by their menu names (for remove, swap_out and assign: the add-ons of the line meant). */
  options?: string[];
  removeOptions?: string[];
  owner?: string;
}
export interface TurnReading {
  acts: TurnAct[];
  items: TurnItem[];
}
export interface OrderLineT {
  dish: string;
  count: number;
  options: string[];
  owner?: string;
}

const key = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const sorted = (xs: string[]) => [...xs].sort();
const sameLine = (a: OrderLineT, b: OrderLineT) => a.dish === b.dish && sorted(a.options).join("|") === sorted(b.options).join("|") && (a.owner ?? "") === (b.owner ?? "");
/** Lines with the same dish, add-ons and owner are one line. */
export function mergeLines(lines: OrderLineT[]): OrderLineT[] {
  const out: OrderLineT[] = [];
  for (const l of lines) {
    if (l.count <= 0) continue;
    const had = out.find((x) => sameLine(x, l));
    if (had) had.count += l.count;
    else out.push({ ...l, options: [...l.options] });
  }
  return out;
}

/** `options` with `name` put on, in its group's place (a group that takes one keeps one). */
function putOption(d: Dish, options: string[], name: string): string[] {
  const g = (d.modifiers ?? []).find((x) => x.options.some((o) => o.name === name));
  if (!g) return options;
  const kept = (g.max ?? 1) <= 1 ? options.filter((x) => !g.options.some((o) => o.name === x)) : options;
  return kept.includes(name) || kept.filter((x) => g.options.some((o) => o.name === x)).length >= (g.max ?? 1) ? kept : [...kept, name];
}

/**
 * The order after `reading`'s changes, or why it can't be had. Names must be the menu's: a dish
 * on it, add-ons of that dish's own groups; a change to a dish must find its line on the order.
 */
export function applyTurn(order: OrderLineT[], reading: TurnReading, dishes: Dish[]): { order: OrderLineT[]; errors: string[] } {
  const errors: string[] = [];
  let lines = order.map((l) => ({ ...l, options: [...l.options] }));
  const dishOf = (name: string) => dishes.find((d) => d.name === name) ?? dishes.find((d) => key(d.name) === key(name));
  const ownOptions = (d: Dish, names: string[] | undefined, what: string) => {
    const all = (d.modifiers ?? []).flatMap((g) => g.options.map((o) => o.name));
    const out: string[] = [];
    for (const n of names ?? []) {
      const o = all.find((x) => x === n) ?? all.find((x) => key(x) === key(n));
      if (o) out.push(o);
      else errors.push(`${d.name} has no ${what} "${n}"`);
    }
    return out;
  };
  const withOptions = (d: Dish, base: string[], on: string[], off: string[]) => on.reduce((acc, n) => putOption(d, acc, n), base.filter((x) => !off.includes(x)));
  const linesOf = (d: Dish) => lines.filter((l) => l.dish === d.name);
  // (take `n` of a dish off its lines, all of it without `n`: the lines with the add-ons named if
  // any are, the newest first; for whose it is, the oldest not yet anyone's first)
  const takeOff = (d: Dish, n?: number, named: string[] = [], oldest = false) => {
    let left = n ?? Infinity;
    const taken: OrderLineT[] = [];
    const pool = linesOf(d).filter((l) => named.every((x) => l.options.includes(x)));
    const from = oldest ? [...pool].sort((a, b) => Number(!!a.owner) - Number(!!b.owner)) : [...pool].reverse();
    for (const l of from) {
      if (left <= 0) break;
      const k = Math.min(l.count, left);
      l.count -= k;
      left -= k;
      taken.push({ ...l, count: k });
    }
    return taken;
  };
  let swapped: { count: number; owner?: string } | null = null;
  for (const it of reading.items) {
    const d = dishOf(it.dish);
    if (!d) {
      errors.push(`no dish "${it.dish}"`);
      continue;
    }
    const count = it.count === undefined ? undefined : Number.isInteger(it.count) && it.count >= 1 && it.count <= 50 ? it.count : NaN;
    if (Number.isNaN(count)) {
      errors.push(`${d.name}: count ${it.count}`);
      continue;
    }
    const before = errors.length;
    const on = ownOptions(d, it.options, "add-on");
    const off = ownOptions(d, it.removeOptions, "add-on");
    // (a change that doesn't fit is refused whole, not made without the part that doesn't)
    if (errors.length > before) continue;
    const had = linesOf(d);
    const needs = (ok: boolean) => (ok ? true : (errors.push(`${d.name} isn't on the order (${it.change})`), false));
    switch (it.change) {
      case "new":
        lines.push({ dish: d.name, count: count ?? 1, options: withOptions(d, [], on, []), ...(it.owner ? { owner: it.owner } : {}) });
        break;
      case "more":
        if (had.length) lines.push({ ...had[had.length - 1], count: count ?? 1, options: withOptions(d, had[had.length - 1].options, on, off) });
        else lines.push({ dish: d.name, count: count ?? 1, options: withOptions(d, [], on, []) });
        break;
      case "set_count":
        if (!needs(had.length > 0) || count === undefined) break;
        {
          const total = had.reduce((n, l) => n + l.count, 0);
          if (count < total) takeOff(d, total - count);
          else had[had.length - 1].count += count - total;
        }
        break;
      case "remove":
        if (needs(had.length > 0)) takeOff(d, count, on);
        break;
      case "swap_out":
        if (needs(had.length > 0)) {
          const taken = takeOff(d, count, on);
          swapped = { count: taken.reduce((n, l) => n + l.count, 0), owner: taken[0]?.owner };
        }
        break;
      case "swap_in":
        lines.push({ dish: d.name, count: count ?? swapped?.count ?? 1, options: withOptions(d, [], on, []), ...(it.owner ?? swapped?.owner ? { owner: it.owner ?? swapped?.owner } : {}) });
        swapped = null;
        break;
      case "modify":
        if (needs(had.length > 0)) for (const l of had) l.options = withOptions(d, l.options, on, off);
        break;
      case "split_off":
        if (needs(had.length > 0)) {
          const from = had[had.length - 1];
          const n = Math.min(count ?? 1, from.count);
          from.count -= n;
          lines.push({ ...from, count: n, options: withOptions(d, from.options, on, off) });
        }
        break;
      case "assign":
        if (needs(had.length > 0) && it.owner) {
          if (count === undefined) for (const l of had) l.owner = it.owner;
          else {
            const taken = takeOff(d, count, on, true);
            for (const t of taken) lines.push({ ...t, owner: it.owner });
          }
        }
        break;
    }
    lines = mergeLines(lines);
  }
  return { order: mergeLines(lines), errors };
}

/** Whether two orders are the same lines (in any order). */
export function sameOrder(a: OrderLineT[], b: OrderLineT[]): boolean {
  const k = (ls: OrderLineT[]) => mergeLines(ls).map((l) => `${l.count}x${l.dish}[${sorted(l.options).join(",")}]@${l.owner ?? ""}`).sort().join(" ");
  return k(a) === k(b);
}

/** Whether `text` appears in `message`, as the teacher must quote it (any case, any spacing). */
export const quoted = (text: string, message: string) => !!text && message.toLowerCase().replace(/\s+/g, " ").includes(text.toLowerCase().replace(/\s+/g, " "));

/** (re-exported for the checks: a word of a dish's name said as the rules would accept it) */
export { same };
