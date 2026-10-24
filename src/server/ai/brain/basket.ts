// An order the guest spells out, item by item: "one ramen and one drink for RM35", "one meat two
// veg", "toast, eggs and two kopi", "food and a drink". Each item is a course word ("drink",
// "veg", "dessert") or a word from the menu's own dish names ("ramen", "kopi"), with a count.
import { normalize } from "../../../shared/brain/text";
import { isDessert, isDrink, type Dish } from "./understand";

export interface Slot {
  count: number;
  /** As the guest said it, singular ("ramen", "drink"). */
  term: string;
  /** A course word: "two veg" is two different dishes, where "two kopi" is the same one twice. */
  course: boolean;
  /** A number was said ("two veg", "one ramen"), not just the item. */
  counted: boolean;
  fits: (d: Dish) => boolean;
}

const NUMBER: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, sebiji: 1, secawan: 1 };
const SEP = /^(and|dan|n|plus|with|also|then)$/;
const STOP = /^(and|the|with|dan|for|from|our|house|style|set|special)$/;

const VEG_CATEGORY = /\b(veg|vegetables?|sayur|sayuran|greens)\b/i;
const MEAT_CATEGORY = /\b(meat|meats|daging|poultry|chicken|ayam)\b/i;
const veg = (d: Dish) => d.dietary.includes("vegetarian") || d.dietary.includes("vegan");
const food = (d: Dish) => !isDrink(d) && !isDessert(d);
/** Course words, and what each takes from the menu. */
const COURSE_WORDS: [RegExp, (d: Dish) => boolean][] = [
  [/^(drinks?|beverages?|minuman|minum)$/, isDrink],
  [/^(desserts?|sweets?|pencuci mulut)$/, isDessert],
  [/^(dish|dishes|mains?|meals?|food|makanan|lauk)$/, food],
  // "one meat two veg" at an economy-rice stall: from the meat and vegetable trays (a stated diet is
  // a constraint of its own); on a menu without them, by what's in the dish
  [/^(meat|meats|daging|protein)$/, (d) => food(d) && !veg(d)],
  [/^(veg|veggie|veggies|vegetables?|sayur|sayuran)$/, (d) => food(d) && (VEG_CATEGORY.test(d.category ?? "") || veg(d)) && !/\b(rice|nasi|noodles?|mee|bread|roti|toast)\b/i.test(d.name)],
  [/^(sides?|starters?|snacks?|appetisers?|appetizers?)$/, (d) => food(d) && /side|starter|snack|small|appeti/i.test(d.category ?? "")],
];

const singular = (w: string) => w.replace(/(ies)$/, "y").replace(/(?<=[^s])s$/, "");

/** The order spelled out in the question, when there is one (two items or more). */
export function basketOf(question: string, items: Dish[]): Slot[] | null {
  const hasVeg = items.some((d) => VEG_CATEGORY.test(d.category ?? ""));
  const hasMeat = items.some((d) => MEAT_CATEGORY.test(d.category ?? ""));
  const byTray = (term: string, fits: (d: Dish) => boolean) =>
    /^(veg|veggie|vegetable|sayur|sayuran)$/.test(term) && hasVeg ? (d: Dish) => VEG_CATEGORY.test(d.category ?? "")
    : /^(meat|daging)$/.test(term) && hasMeat ? (d: Dish) => MEAT_CATEGORY.test(d.category ?? "")
    : fits;
  let text = ` ${normalize(question.replace(/[,，、+&]/g, " and "))} `;
  // a dish whose own name has "and" in it (Fish and Chips) is one item, not two
  for (const d of items) {
    const n = normalize(d.name);
    if (/ and /.test(n) && text.includes(` ${n} `)) text = text.replace(` ${n} `, ` ${n.replace(/ and /g, "_")} `);
  }
  const nameWords = new Map<string, Dish[]>();
  for (const d of items) for (const w of normalize(d.name).split(" ")) if (w.length >= 3 && !STOP.test(w)) nameWords.set(singular(w), [...(nameWords.get(singular(w)) ?? []), d]);
  const toks = text.trim().split(/\s+/);
  const slotAt = (i: number): { slot: Slot; next: number } | null => {
    let count = 1;
    let j = i;
    const n = NUMBER[toks[j]] ?? (/^\d$/.test(toks[j]) ? Number(toks[j]) : undefined);
    if (n !== undefined) (count = n), j++;
    const w = toks[j];
    if (!w) return null;
    // "not spicy", "no pork", "tak nak udang": what they don't want isn't an item
    if (/^(no|not|without|non|tak|x|bukan|tanpa|jangan|less|kurang)$/.test(toks[j - 1] ?? "")) return null;
    const course = COURSE_WORDS.find(([re]) => re.test(w));
    // "sayur apa sesuai?", "which drink?": a question about the course, not an item ordered
    if (course && /^(apa|what|which|mana|yang|yg)$/.test(toks[j + 1] ?? "")) return null;
    if (course) return { slot: { count, term: singular(w), course: true, counted: n !== undefined, fits: byTray(singular(w), course[1]) }, next: j + 1 };
    const dishes = nameWords.get(singular(w.replace(/_/g, " ")));
    if (dishes) return { slot: { count, term: singular(w), course: false, counted: n !== undefined, fits: (d) => dishes.includes(d) }, next: j + 1 };
    return null;
  };
  let best: Slot[] = [];
  for (let i = 0; i < toks.length; i++) {
    const run: Slot[] = [];
    let j = i;
    let joined = true;
    while (j < toks.length && joined) {
      const s = slotAt(j);
      if (!s) break;
      run.push(s.slot);
      j = s.next;
      // the next item: after "and", or straight after a counted one ("one meat two veg")
      if (SEP.test(toks[j] ?? "")) j++;
      else joined = NUMBER[toks[j]] !== undefined || /^\d$/.test(toks[j] ?? "");
    }
    // a list of one course word and a dish word, or two counted ones; not "nasi lemak and teh" when
    // neither is counted nor a course (those are dishes named, for the other rules)
    const counted = run.filter((s) => s.course || s.count > 1).length;
    if (run.length >= 2 && (counted >= 1 || run.length >= 3) && run.length > best.length) best = run;
  }
  return best.length >= 2 ? best : null;
}

/**
 * One dish per item, the best ranked first, within the budget when there is one: an item takes
 * its best dish only if the cheapest choices for the items after it still fit.
 */
export function compose<T extends Dish>(asked: Slot[], ranked: T[], budget: number | null): { dish: T; count: number }[] | null {
  const slots = asked.flatMap((s) => (s.course ? Array.from({ length: s.count }, () => ({ ...s, count: 1 })) : [s]));
  const chosen: { dish: T; count: number }[] = [];
  const left = (k: number) => slots.slice(k).reduce((sum, s) => sum + s.count * Math.min(...ranked.filter((d) => s.fits(d)).map((d) => d.price)), 0);
  let spent = 0;
  for (let k = 0; k < slots.length; k++) {
    const s = slots[k];
    const rest = left(k + 1);
    const pick = ranked.find((d) => s.fits(d) && !chosen.some((c) => c.dish === d) && (budget === null || spent + d.price * s.count + rest <= budget));
    if (!pick) return null;
    chosen.push({ dish: pick, count: s.count });
    spent += pick.price * s.count;
  }
  return chosen;
}
