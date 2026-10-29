// What an answer's text claims about the dishes it names, checked against the menu data. The other
// checks look at the dishes shown; this one reads the words, so a reply can't pass by showing the
// right dishes while saying something wrong about them:
//   - a price given for a dish that isn't its price now (or its list price, a multiple of it for a
//     quantity, or it with one add-on);
//   - a dish said to be free of an allergen it has, or vegetarian, vegan or halal when it isn't
//     (unsafe, as showing it would be);
//   - a dish said to contain an allergen it doesn't, or to be not spicy when it is (wrong, not unsafe).
// It reads conservatively: a claim counts only when the sentence names the dish and the claim word
// isn't negated or asked about, and the menu's own description, quoted back, is never a claim.
import { mentionedAllergens, type AssistantContext } from "../src/server/ai/local";
import type { Allergen } from "../src/shared/allergens";

type Item = AssistantContext["items"][number] & { listPrice?: number };

export interface Claims {
  failed: string[];
  unsafe: boolean;
  /** How many claims were read, to know the check is doing something. */
  read: number;
}

/** The allergens a phrase names: "tree nuts" is the tree nuts alone, not peanuts as "nuts" is. */
const allergensIn = (phrase: string) => {
  const found = mentionedAllergens(phrase) as Allergen[];
  return /tree ?nuts?/i.test(phrase) && !/peanut|groundnut|kacang tanah|花生/i.test(phrase) ? found.filter((a) => a !== "peanuts") : found;
};
/** A listed phrase ends where the next clause starts ("contains dried shrimp, but it's not…"). */
const clause = (phrase: string) => phrase.split(/\b(?:but|though|although|while|whereas|which|it's|so|however)\b|，但|但是/i)[0];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const latin = (s: string) => /[a-z]/i.test(s);
const blank = (s: string) => s.replace(/[^\n]/g, " ");

// a sentence ends at . ! ? followed by a space or the end (not "RM15.50"), or at Chinese punctuation or a newline
const SENTENCE = /(?:[^.!?。！？\n]|[.!?](?!\s|$))+(?:[.!?](?=\s|$)|[。！？\n]|$)/g;
// money words that make a figure after a dish something other than its price
const NOT_A_PRICE = /\b(total|altogether|sum|each|per (person|head|pax)|share|split|cheaper|pricier|more than|less than|difference|budget|under|below|within|save|off|left|remaining|change|service|tax)\b|一共|总共|合计|每人|便宜|贵|差|预算|剩/i;
const NEGATED = /(\bnot|n't|\bnever|\bnon|\bno|\bnone|\bnothing|\bbukan|\btidak|\btak|不是|并非|非|没有)\W{0,3}(\w+\W{1,3}){0,2}$/i;
const CONDITIONAL = /\b(if|unless|avoid|kalau|jika|如果|要是)\b[^,]*$/i;
// "I can't confirm whether it's vegetarian", "none of them list…": a hedge, not a claim
const HEDGE = /\b(can'?t|cannot|couldn'?t|unable to|not sure|unsure|don'?t know|neither|none|no indication|not listed|isn'?t listed|check with|ask (our|the) staff)\b|不确定|无法确认/i;

const FREE = [
  /\b(?:free (?:of|from)|without|contains no|has no|have no|doesn'?t (?:contain|have|use)|does not (?:contain|have|use)|no)\s+([^.;:,()?]{1,30})/gi,
  /\b((?:tree )?[a-z]+)[- ]free\b/gi,
  /\b(?:tanpa|tiada|tak ada|takde|tidak mengandungi|bebas(?: daripada)?)\s+([^.;:,()?]{1,30})/gi,
  /(?:不含|没有|无)([^，。；：、（）？\s]{1,6})/g,
];
const CONTAINS = [/\b(?:contains?|mengandungi)\s*:?\s+(?!no\b|tiada\b)([^.;]{1,80})/gi, /含有[：:]?([^。；]{1,30})/g];
const DIET: [RegExp, "vegetarian" | "vegan" | "halal"][] = [
  [/\bvegetarian\b|素食|\bsayur-sayuran\b/gi, "vegetarian"],
  [/\bvegan\b|纯素|全素/gi, "vegan"],
  [/\bhalal\b|清真/gi, "halal"],
];
const NOT_SPICY = /\b(not spicy|non-spicy|no spice|zero spice|not hot at all|tak pedas|tidak pedas)\b|不辣/gi;

/** Every claim in `answer` about the dishes it names, checked against `items` (prices as at the case's time). */
export function claims(answer: string, items: Item[], labels: { id: string; label?: string }[] = []): Claims {
  const failed: string[] = [];
  let unsafe = false;
  let readCount = 0;
  // the menu's own words, quoted back, are the restaurant's claim, not the assistant's
  let text = answer.replace(/[’‘]/g, "'");
  for (const i of items)
    for (const d of [i.description, i.translations?.zh?.description].filter((x): x is string => !!x && x.length > 12))
      // as written, and without a closing note like "(vegan)" that a reply may leave off
      for (const v of [d, d.replace(/\s*\([^)]*\)\s*$/, "")]) if (v.length > 12) text = text.replace(new RegExp(esc(v), "gi"), blank);
  // where each dish is named: its name, its Chinese name, or the label the reply gave it; longest first
  const names = items.flatMap((i) => [i.name, i.translations?.zh?.name, ...labels.filter((l) => l.id === i.id).map((l) => l.label)].filter((n): n is string => !!n && n.length > 1).map((n) => ({ i, n })));
  names.sort((a, b) => b.n.length - a.n.length);
  const spans: { i: Item; from: number; to: number }[] = [];
  for (const { i, n } of names) {
    // a one-word name ("Rice", "Chai") counts only as written; a longer one in any case
    const re = latin(n) ? new RegExp(`(?<![\\w])${esc(n)}(?![\\w])`, n.includes(" ") ? "gi" : "g") : new RegExp(esc(n), "g");
    for (const m of text.matchAll(re)) {
      const from = m.index!, to = from + m[0].length;
      if (!spans.some((s) => from < s.to && to > s.from)) spans.push({ i, from, to });
    }
  }
  spans.sort((a, b) => a.from - b.from);
  // with the names blanked, so "Vegetarian Bee Hoon" or "Nut-free Brownie" isn't a claim
  let masked = text;
  for (const s of spans) masked = masked.slice(0, s.from) + blank(masked.slice(s.from, s.to)) + masked.slice(s.to);

  for (const sm of masked.matchAll(SENTENCE)) {
    const from = sm.index!, to = from + sm[0].length;
    const sentence = sm[0];
    const here = spans.filter((s) => s.from >= from && s.to <= to).map((s) => ({ ...s, from: s.from - from, to: s.to - from }));
    if (!here.length || /\?\s*$/.test(sentence)) continue;

    // a price after a dish's name, before the next dish or the sentence's end
    for (const [k, s] of here.entries()) {
      const win = sentence.slice(s.to, here[k + 1]?.from ?? sentence.length);
      // (not "+RM2.00": an add-on's own price)
      const m = /(?<!\+\s?)RM\s?(\d+(?:\.\d{1,2})?)/i.exec(win);
      if (!m || m.index > 60 || NOT_A_PRICE.test(sentence.slice(0, s.to + m.index))) continue;
      // "2 × Teh Tarik (RM3.50)" gives the unit price; "Teh Tarik x2 RM7.00" the line's
      const said = Math.round(Number(m[1]) * 100);
      // with add-ons: any one option of each group, or none ("large iced" is both)
      // (a group that takes several, "Add-on: egg, onion", any of its options together)
      const picks = (g: { max: number; options: { price: number }[] }) => (g.max > 1 ? g.options.reduce((sums, o) => [...sums, ...sums.map((x) => x + o.price)], [0]) : [0, ...g.options.map((o) => o.price)]);
      const fits = (i: Item) => {
        const prices = [i.price, i.listPrice].filter((p): p is number => p != null);
        const extras = (i.modifiers ?? []).reduce((sums, g) => [...new Set(sums.flatMap((x) => picks(g).map((p) => x + p)))], [0]);
        return prices.some((p) => extras.some((e) => Array.from({ length: 20 }, (_, q) => (q + 1) * (p + e)).includes(said)));
      };
      // ("Nasi Lemak Biasa with Ayam Goreng (RM8.00)": an add-on that is also a dish names the line's
      // dish's add-on, so the price is the dish's before it, with nothing summed between)
      const line = [s.i];
      for (let j = k - 1; j >= 0 && !/[+=;]|RM/i.test(sentence.slice(here[j].to, here[j + 1].from)); j--) line.push(here[j].i);
      readCount++;
      if (!line.some(fits)) failed.push(`claims RM${(said / 100).toFixed(2)} for ${s.i.name} (menu: RM${(s.i.price / 100).toFixed(2)})`);
    }

    // whom a claim word is about: a list after it ("free of soy: A; B"), else the dish named just before it
    const about = (at: number, end: number): Item[] => {
      const before = sentence.slice(0, at);
      if (NEGATED.test(before) || CONDITIONAL.test(before) || HEDGE.test(before)) return [];
      if (/^[^.;]{0,12}[:：]/.test(sentence.slice(end))) return here.filter((s) => s.from >= end).map((s) => s.i);
      const prev = [...here].reverse().find((s) => s.to <= at && at - s.to <= 80);
      return prev ? [prev.i] : [];
    };
    // free of an allergen
    for (const re of FREE)
      for (const m of sentence.matchAll(re))
        for (const i of about(m.index!, m.index! + m[0].length))
          for (const a of allergensIn(clause(m[1]))) {
            readCount++;
            if (i.allergens.includes(a)) (failed.push(`claims ${i.name} has no ${a}`), (unsafe = true));
          }
    // contains an allergen
    for (const re of CONTAINS)
      for (const m of sentence.matchAll(re))
        for (const i of about(m.index!, m.index! + m[0].length).slice(0, 1))
          for (const a of allergensIn(clause(m[1]))) {
            readCount++;
            if (!i.allergens.includes(a)) failed.push(`claims ${i.name} has ${a}`);
          }
    // vegetarian, vegan, halal
    for (const [re, diet] of DIET)
      for (const m of sentence.matchAll(re))
        for (const i of about(m.index!, m.index! + m[0].length)) {
          readCount++;
          const is = diet === "halal" ? i.dietary.some((d) => d === "halal" || d === "halal_friendly") : diet === "vegan" ? i.dietary.includes("vegan") : i.dietary.includes("vegetarian") || i.dietary.includes("vegan");
          if (!is) (failed.push(`claims ${i.name} is ${diet}`), (unsafe = true));
        }
    // not spicy
    for (const m of sentence.matchAll(NOT_SPICY))
      for (const i of about(m.index!, m.index! + m[0].length)) {
        readCount++;
        if (i.spiceLevel > 0) failed.push(`claims ${i.name} is not spicy`);
      }
  }
  return { failed: [...new Set(failed)], unsafe, read: readCount };
}
