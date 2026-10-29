// The add-ons and sizes a guest asks for in their own words ("both iced", "with oat milk", "roti
// canai tambah telur", "large", "走冰"), read against each dish's own options. Only priced options
// matter to a bill; a free one ("hot", "fresh milk") changes nothing.
import { normalize } from "../../../shared/brain/text";
import type { ModifierOption } from "../../../shared/types";

type WithOptions = { name: string; modifiers?: { name: string; options: ModifierOption[] }[] };

// a guest's words for an option's own words (as menus name them: "Ais (iced)", "Oat milk", "Besar (large)")
const ALSO: Record<string, string[]> = {
  ais: ["ice", "iced", "cold", "peng", "sejuk"], iced: ["ice", "ais", "cold", "peng", "sejuk"],
  besar: ["large", "big", "upsize", "bigger"], large: ["besar", "big", "upsize", "bigger"],
  telur: ["egg"], egg: ["telur"], bawang: ["onion"], onion: ["bawang"],
  oat: ["oat", "oatmilk"], almond: ["badam", "almond"], shot: ["shot", "double"],
  kuah: ["kuah", "sauce", "peanut sauce"], laksa: ["laksa", "curry"], chilli: ["chilli", "chili", "sambal"],
};
const ALSO_ZH: Record<string, RegExp> = {
  ais: /冰|凍|冻/, iced: /冰|凍|冻/, besar: /大杯|大份|加大|大的/, large: /大杯|大份|加大|大的/, telur: /加蛋|蛋/, egg: /加蛋|蛋/, bawang: /洋葱/, onion: /洋葱/,
  oat: /燕麦/, almond: /杏仁/, shot: /加浓|浓缩|多一份咖啡/, laksa: /叻沙|咖喱汤/, curry: /咖喱/, chilli: /辣椒酱|加辣|辣椒/, kuah: /花生酱|沙爹酱|花生酱汁/,
  salmon: /三文鱼|烟熏三文鱼/, bacon: /培根/, poached: /水波蛋/, dry: /干捞|干的/, soup: /汤的|汤底/,
};
// words that say nothing of which option ("milk" is every milk option, "extra" every add-on)
const GENERIC = new Set(["milk", "extra", "add", "on", "the", "a", "with", "and", "of", "sauce", "set", "piece", "pieces", "smoked", "beef", "susu", "regular", "biasa", "fresh", "normal"]);
// "no ice", "without ice", "tak nak ais", "kurang ais", "走冰": an option taken off
const OFF = /\b(no|without|tak nak|tak mau|xnak|x nak|tanpa|kosong|hold the|less)\s+(\w+)/g;
const OFF_ZH = /走(冰|蛋)|不要(冰|蛋)|去冰/g;

const keyWords = (o: ModifierOption) => {
  const n = normalize(o.name.replace(/[()]/g, " "));
  return [...new Set(n.split(" ").filter((w) => w.length > 1 && !GENERIC.has(w)))];
};
const said = (w: string, words: Set<string>, raw: string) => words.has(w) || (ALSO[w] ?? []).some((x) => (x.includes(" ") ? ` ${[...words].join(" ")} `.includes(` ${x} `) : words.has(x))) || !!ALSO_ZH[w]?.test(raw);

/** The priced options of `dish` that `text` asks for, and the option words it takes off ("no ice"). */
export function optionsSaid(text: string, dish: WithOptions, free = false): { add: ModifierOption[]; off: ModifierOption[] } {
  const t = normalize(text);
  const offWords = new Set([...t.matchAll(OFF)].map((m) => m[2]));
  const offZh = [...text.matchAll(OFF_ZH)].map((m) => m[1]);
  const words = new Set(t.split(" ").filter((w) => !offWords.has(w)));
  const priced = (dish.modifiers ?? []).flatMap((g) => g.options).filter((o) => free || o.price > 0);
  const add: ModifierOption[] = [];
  const off: ModifierOption[] = [];
  for (const o of priced) {
    const ks = keyWords(o);
    if (!ks.length) continue;
    const isOff = ks.some((k) => offWords.has(k) || (ALSO[k] ?? []).some((x) => offWords.has(x)) || offZh.some((z) => ALSO_ZH[k]?.test(z)));
    if (isOff) off.push(o);
    else if (ks.some((k) => said(k, words, text.replace(/走冰|走蛋|不要冰|去冰/g, "")))) add.push(o);
  }
  return { add, off };
}

/** The options a question names on any dish ("Ada susu badam? Berapa tambah?"), with the dishes that have them. */
export function optionsAsked<T extends WithOptions>(text: string, dishes: T[]): { option: ModifierOption; dishes: T[] }[] {
  const out = new Map<string, { option: ModifierOption; dishes: T[] }>();
  for (const d of dishes)
    for (const o of optionsSaid(text, d).add) {
      const k = normalize(o.name);
      if (!out.has(k)) out.set(k, { option: o, dishes: [] });
      out.get(k)!.dishes.push(d);
    }
  return [...out.values()];
}

/** An option's name as a guest reads it: "Ais (iced)" is "iced", "Oat milk" stays. */
export const optionLabel = (o: ModifierOption) => o.name.match(/\(([^)]+)\)/)?.[1] ?? o.name;

/** A dish's choices as a guest reads them: "Base: Soup, Dry, Curry Laksa (+RM2.00)". */
export function choicesText(dish: WithOptions, money: (n: number) => string): string {
  return (dish.modifiers ?? []).map((g) => `${g.name}: ${g.options.map((o) => `${optionLabel(o)}${o.price ? ` (+${money(o.price)})` : ""}`).join(", ")}`).join("; ");
}
/** The option words a text uses for any of `dishes`' options (to keep "extra chilli sauce" from naming a chilli dish). */
export function optionWordsSaid(text: string, dishes: WithOptions[]): Set<string> {
  const out = new Set<string>();
  for (const d of dishes) for (const o of optionsSaid(text, d, true).add) for (const w of keyWords(o)) out.add(w);
  return out;
}
