// What a guest's question means, as structured facts: the dishes it names (a fuzzy gazetteer over
// the restaurant's own menu, so typos and partial names work), the constraints it sets (allergens,
// diet, spice, budget, party size, a course, appetite) with negation handled ("not spicy", "tak
// pedas", "不辣"), and what it refers back to ("those", "that one"). The intent comes from the
// neural model, reading the question with the dishes replaced by §dish so it works for any menu.
import type { Allergen } from "../../../shared/allergens";
import { classify, loadModel, type Intent, type IntentGuess, type IntentModel, type IntentWeights } from "../../../shared/brain/intentModel";
import { editDistance, normalize, tokens } from "../../../shared/brain/text";
import { WEIGHTS } from "../../../shared/brain/weights.gen";
import { mentionedAllergens } from "../local";

export interface Dish {
  id: string;
  name: string;
  category?: string;
  description?: string;
  price: number;
  allergens: string[];
  dietary: string[];
  spiceLevel: number;
  isSignature: boolean;
  translations?: Record<string, { name?: string; description?: string } | undefined>;
}

export type Diet = "vegetarian" | "vegan" | "halal";
export type Course = "drinks" | "desserts" | "noodles" | "rice" | "sides" | "soup" | "food";
export type Superlative = "cheapest" | "priciest" | "spiciest" | "mildest" | "popular";

export interface Understanding {
  intent: Intent;
  confidence: number;
  guess: IntentGuess;
  /** The question as the model read it (dishes as §dish, numbers as §num). */
  delexicalized: string[];
  /** Dishes named, in the order named. */
  dishes: Dish[];
  /** Allergens the guest is avoiding. */
  avoid: Allergen[];
  /** Allergens named at all (asked about, or avoided). */
  allergens: Allergen[];
  /** An allergen or ingredient question ("does it have", "is it safe", "含不含"). */
  asksContents: boolean;
  diet: Diet[];
  /** Spice limits: "not spicy" is max 0, "a bit spicy" max 1, "spicy" min 1, "very spicy" min 2. */
  maxSpice: number | null;
  minSpice: number | null;
  budget: number | null;
  /** Any amount of money named ("RM100 for 4 of us"): a group's total when no "under" made it a per-dish cap. */
  amount: number | null;
  party: number | null;
  courses: Course[];
  appetite: "light" | "hearty" | null;
  superlative: Superlative | null;
  /** "those", "that one", "it", "那个": the question is about what was just said. */
  refersBack: boolean;
}

let model: IntentModel | null = null;
export const intentModel = () => (model ??= loadModel(WEIGHTS));

/** Swap the intent model (the training gate scores candidate weights against the shipped ones). */
export function useWeights(w: IntentWeights) {
  model = loadModel(w);
}

// ---- dishes ----

/** Food words too common to identify a dish on their own ("chicken" is not Hainanese Chicken Rice). */
const GENERIC = new Set(
  "chicken ayam beef daging lamb kambing pork babi fish ikan prawn udang rice nasi noodle noodles mee mi meehoon bihun fried goreng rebus bakar grilled steamed iced ice ais hot cold panas sejuk juice jus tea teh coffee kopi special set soup sup curry kari spicy sweet sour fresh the and with of a an in on sauce kuah sambal egg telur vegetable vegetables sayur tofu small large big vegetarian vegan veggie halal signature classic original house mini regular plain mild extra".split(" "),
);

interface DishIndex {
  items: Dish[];
  names: string[][];
  df: Map<string, number>;
}

const indexes = new WeakMap<Dish[], DishIndex>();

function dishIndex(items: Dish[]): DishIndex {
  let ix = indexes.get(items);
  if (ix) return ix;
  const names = items.map((i) => tokens(normalize(i.name.replace(/\(.*?\)/g, " ")), true));
  const df = new Map<string, number>();
  for (const n of names) for (const w of new Set(n)) df.set(w, (df.get(w) ?? 0) + 1);
  ix = { items, names, df };
  indexes.set(items, ix);
  return ix;
}

/** The words the brain reads constraints from, for correcting typos ("vegeterian", "spicey", "desert"). */
const KEYWORDS = (
  "vegetarian vegan halal spicy pedas allergic allergy alergi peanuts peanut shellfish seafood gluten dairy lactose sesame recommend recommendation suggest " +
  "signature popular famous dessert desserts cakes pastry drinks beverage noodles snacks starters cheapest cheaper expensive budget people difference compare " +
  "versus restaurant ingredients contain contains without hungry starving filling healthy something anything"
).split(" ");

/** Real words that are one letter off a keyword ("there" and "these", "daily" and "dairy"): never "corrected". */
const REAL = new Set("there their three these those where while daily dally spice price prices sweet light drink drunk peoples comparing contained budgets hunger starter".split(" "));

/** A misspelt word put right, when it is one or two letters off a keyword (SymSpell-style, on a small lexicon). */
export function correct(word: string): string {
  if (word.length < 5 || KEYWORDS.includes(word) || REAL.has(word)) return word;
  const max = word.length >= 8 ? 2 : 1;
  let best: [string, number] | null = null;
  for (const k of KEYWORDS) {
    if (k[0] !== word[0]) continue;
    const d = editDistance(word, k, max);
    if (d <= max && (!best || d < best[1])) best = [k, d];
  }
  return best?.[0] ?? word;
}

/**
 * A question word `a` naming dish word `b`: the same, a plural, or one letter off. A word the
 * intent model already knows ("better") is never a typo of a dish word ("butter").
 */
const same = (a: string, b: string) =>
  a === b || a === `${b}s` || b === `${a}s` || (a.length >= 5 && b.length >= 5 && a[0] === b[0] && !intentModel().vocab?.has(a) && editDistance(a, b, 1) <= 1);

interface Mention {
  dish: Dish;
  at: number;
  covered: number[];
  score: number;
}

/**
 * Dishes named in the question: the whole name, most of it, or one word only that dish has
 * ("laksa", "cendol"), with one-letter typos forgiven. `skip` marks words that can't be dish
 * words (the allergen in "alergi kacang").
 */
export function findDishes(items: Dish[], raw: string, toks: string[], skip = new Set<number>()): Mention[] {
  const ix = dishIndex(items);
  const found: Mention[] = [];
  items.forEach((dish, n) => {
    // a translated name (炒粿条) anywhere in the question
    for (const tr of Object.values(dish.translations ?? {}))
      if (tr?.name && tr.name.length > 1 && raw.includes(tr.name)) return void found.push({ dish, at: raw.indexOf(tr.name) / 100, covered: [], score: 2 });
    const name = ix.names[n].filter((w) => w.length > 1 || /\d/.test(w));
    if (!name.length) return;
    const covered: number[] = [];
    let weight = 0;
    let total = 0;
    let unique = false;
    let strong = false;
    for (const w of name) {
      const idf = 1 / (ix.df.get(w) ?? 1);
      const g = GENERIC.has(w) ? 0.3 : 1;
      total += idf * g;
      const at = toks.findIndex((t, i) => !skip.has(i) && !covered.includes(i) && same(t, w));
      if (at < 0) continue;
      covered.push(at);
      weight += idf * g;
      if (!GENERIC.has(w) && w !== "kacang" && !mentionedAllergens(w).length) strong = true;
      // an allergen word ("kacang" in Ais Kacang) alone names the allergen, not the dish
      if (ix.df.get(w) === 1 && !GENERIC.has(w) && w.length >= 4 && w !== "kacang" && !mentionedAllergens(w).length) unique = true;
    }
    if (!covered.length) return;
    const coverage = weight / total;
    const all = covered.length === name.length;
    // a long name needs its words close together, not scattered across the question
    const spread = Math.max(...covered) - Math.min(...covered) + 1;
    // a partial match needs a word that names this dish, not just "ais" or an allergen like "kacang"
    if (!(all || ((coverage >= 0.6 || unique) && strong)) || spread > name.length + 2) return;
    found.push({ dish, at: Math.min(...covered), covered, score: (all ? 1 : coverage) + covered.length * 0.01 });
  });
  // two dishes claiming the same words: the better match keeps them
  found.sort((a, b) => b.score - a.score);
  const claimed = new Set<number>();
  const kept = found.filter((m) => {
    if (m.covered.length && m.covered.every((i) => claimed.has(i))) return false;
    if (m.covered.some((i) => claimed.has(i)) && m.score < 1) return false;
    m.covered.forEach((i) => claimed.add(i));
    return true;
  });
  return kept.sort((a, b) => a.at - b.at);
}

// ---- constraints ----

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, lapan: 8, sembilan: 9, sepuluh: 10,
  一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};
const num = (s: string) => (/^\d+$/.test(s) ? Number(s) : (NUMBER_WORDS[s] ?? (s.startsWith("十") ? 10 + (NUMBER_WORDS[s[1]] ?? 0) : null)));
const NUMS = "\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|satu|dua|tiga|empat|lima|enam|tujuh|lapan|sembilan|sepuluh";

const BER: Record<string, number> = { bertiga: 3, berempat: 4, berlima: 5, berenam: 6, bertujuh: 7, berlapan: 8 };

function partyOf(text: string, raw: string): number | null {
  const m =
    text.match(new RegExp(`\\b(?:we are|we re|were|we r|party of|table for|table of|group of|family of|there are|there will be|kami|we have)\\s+(${NUMS})\\b(?!\\s*(?:rm|ringgit|dollars?|minutes?|mins?|sticks?|pieces?|pcs))`)) ??
    text.match(new RegExp(`\\b(${NUMS})\\s+(?:of us|people|persons?|adults|orang|heads|guests|diners|pax|kids and adults)\\b`)) ??
    text.match(new RegExp(`\\bfor\\s+(${NUMS})\\b(?!\\s*(?:rm|ringgit|dollars?|minutes?|mins?|sticks?|pieces?|pcs|\\.))`));
  const z = raw.match(/([\d一二两三四五六七八九十]+)\s*(?:个人|个|位|人)/);
  const n = m ? num(m[1]) : z ? num(z[1]) : /\b(couple|two of us|the 2 of us|berdua|date night)\b/.test(text) || /两个人|俩/.test(raw) ? 2 : (BER[text.match(/\b(bertiga|berempat|berlima|berenam|bertujuh|berlapan)\b/)?.[1] ?? ""] ?? null);
  return n && n >= 2 && n <= 40 ? n : null;
}

function budgetOf(text: string, raw: string): number | null {
  const amount = "(?:rm|myr|\\$|s\\$)?\\s*(\\d+(?:\\.\\d+)?)\\s*(?:rm|ringgit|bucks|dollars?|myr)?";
  const m =
    text.match(new RegExp(`\\b(?:under|below|less than|lower than|max|maximum|budget|budget of|within|not more than|no more than|up to|at most|cheaper than|bawah|kurang dari|tak lebih|tak sampai|limit)\\s*${amount}`)) ??
    text.match(new RegExp(`${amount}\\s*(?:and below|or less|and under|or below|ke bawah|kebawah|max|budget)\\b`)) ??
    raw.match(/(?:不超过|低于|少于|预算)\s*(?:rm|马币)?\s*(\d+(?:\.\d+)?)/) ??
    raw.match(/(?:rm|马币)?\s*(\d+(?:\.\d+)?)\s*(?:块|令吉|元|马币)?\s*(?:以下|以内|之内)/);
  return m ? Math.round(parseFloat(m[1]) * 100) : null;
}

/** A total to spend for a group ("RM100 for 4 of us"), when no "under" says it's per dish. */
function groupBudgetOf(text: string): number | null {
  const m = text.match(/(?:rm|myr|\$)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:ringgit|rm\b)/);
  return m ? Math.round(parseFloat(m[1] ?? m[2]) * 100) : null;
}

const NEG = /^(not|no|non|less|without|tak|takde|kurang|bukan|jangan|tanpa|dont|cant|never|avoid|mild|cannot|nothing|zero|minus|hate)$/;

/** Spice limits from the question, with the negation in front of a spice word taken into account. */
function spiceOf(toks: string[], raw: string): { max: number | null; min: number | null } {
  if (/不辣|不要辣|不吃辣|别辣|免辣|无辣|不能吃辣|怕辣|走辣/.test(raw)) return { max: 0, min: null };
  if (/微辣|小辣|少辣|不太辣|一点点辣|中辣/.test(raw)) return { max: 1, min: null };
  if (/很辣|特辣|超辣|最辣|重辣|大辣|越辣越好/.test(raw)) return { max: null, min: 2 };
  let res: { max: number | null; min: number | null } = { max: null, min: null };
  toks.forEach((t, i) => {
    if (!/^(spic\w*|pedas|chil+i\w*|cili|heat|sambal|spice)$/.test(t)) return;
    const before = toks.slice(Math.max(0, i - 4), i);
    const after = toks.slice(i + 1, i + 3);
    if (before.some((w) => NEG.test(w)) || /^(cant|cannot)$/.test(before[0] ?? "")) {
      // "not too spicy", "tak pedas sangat": a little is fine
      res = before.includes("too") || before.includes("very") || after.includes("sangat") || after.includes("sgt") ? { max: 1, min: null } : { max: 0, min: null };
    } else if (before.some((w) => /^(little|bit|abit|slightly|medium|sikit|mild|bit)$/.test(w)) || after.some((w) => /^(sikit|sedikit)$/.test(w))) res = { max: 1, min: null };
    else if (before.some((w) => /^(very|extra|super|really|so|most|damn|sangat|paling)$/.test(w)) || after.some((w) => /^(gila|giler|sangat|sgt|nak mampus)$/.test(w)) || t === "spiciest") res = { max: null, min: 2 };
    else if (res.max === null) res = { max: null, min: 1 };
  });
  if (res.max === null && res.min === null && toks.some((t) => /^(mild|bland|kid|kids|child|children|toddler|baby|budak|anak)$/.test(t))) res = { max: 0, min: null };
  if (res.max === null && res.min === null && /小孩|孩子|宝宝/.test(raw)) res = { max: 0, min: null };
  if (res.min === null && res.max === null && /辣/.test(raw)) res = { max: null, min: 1 };
  return res;
}

interface CourseWords {
  course: Course;
  /** How a guest asks for it. */
  ask: RegExp;
  askZh: RegExp;
  /** How a menu names the category. */
  category: RegExp;
  /** Dish names that are this course, for menus without such a category. */
  dish: RegExp;
}

const COURSES: CourseWords[] = [
  { course: "drinks", ask: /\b(drinks?|beverages?|minum|minuman|juices?|thirsty|haus|dahaga|to drink|sip)\b/, askZh: /饮料|喝|饮品|饮/, category: /drink|beverage|minum|饮|juice|coffee|\btea\b|kopi|teh/i, dish: /juice|\btea\b|\bteh\b|kopi|coffee|latte|soda|lemonade|\bmilk\b|\bwater\b|smoothie|kombucha/i },
  { course: "desserts", ask: /\b(desserts?|sweets?|sweet things?|manis|pencuci mulut|kuih|after meal|cakes?|pastr(y|ies)|ice cream|pudding)\b/, askZh: /甜品|甜点|甜的|糖水|蛋糕/, category: /dessert|sweet|pencuci|甜|cake|pastr|kuih|ice cream|gelato|patisserie|bakery/i, dish: /cake|ice cream|pudding|cendol|ais kacang|sago|mochi|\btart\b|brownie|cookie|kuih|panna cotta|tiramisu|gelato/i },
  { course: "noodles", ask: /\b(noodles?|mee|mi|meehoon|bihun|kuey teow|kway teow|ramen|udon|soba|pasta|spaghetti)\b/, askZh: /面|粉/, category: /noodle|mee|ramen|pasta|面/i, dish: /noodle|\bmee\b|\bmi\b|kway teow|kuey teow|laksa|ramen|udon|soba|pasta|spaghetti|penne|aglio/i },
  { course: "rice", ask: /\b(rice|nasi)\b/, askZh: /饭/, category: /rice|nasi|饭/i, dish: /\brice\b|\bnasi\b|biryani|briyani|don\b|risotto/i },
  { course: "sides", ask: /\b(sides?|snacks?|starters?|appeti[sz]ers?|small plates?|finger food|small bites?|side dish)\b/, askZh: /小吃|前菜|配菜/, category: /side|snack|starter|appeti|small plate|小吃|前菜/i, dish: /fries|salad|\bbread\b|wings/i },
  { course: "soup", ask: /\b(soups?|sup)\b/, askZh: /汤/, category: /soup|汤/i, dish: /soup|\bsup\b|broth/i },
  { course: "food", ask: /\b(food|makanan|something to eat|eat|mains?|main course|meal)\b/, askZh: /吃的|主食|主菜/, category: /./, dish: /./ },
];

/** The menu's dishes for a course: by its category's name, or the dish's own name. */
export function courseDishes(items: Dish[], course: Course): Dish[] {
  if (course === "food") return items.filter((i) => !isDrink(i));
  const c = COURSES.find((x) => x.course === course)!;
  const byCategory = items.filter((i) => c.category.test(i.category ?? ""));
  return byCategory.length ? byCategory : items.filter((i) => c.dish.test(i.name));
}

const DRINK = COURSES[0].category;
const DESSERT = COURSES[1].category;
export const isDrink = (i: Dish) => DRINK.test(i.category ?? "");
export const isDessert = (i: Dish) => DESSERT.test(i.category ?? "");

const ASKS_CONTENTS = /\b(allerg\w*|alergi|contain\w*|ingredients?|inside|safe|ada .{0,20}(tak|ke)|got .{0,20}(or not|inside)|does .{0,40}(have|got|use|come with)|is there|any .{0,15} in (it|this|that|the)|made with|cooked (in|with)|boleh makan|free from|\w+ free)\b/;
const AVOID_CUE = /\b(allerg\w*|alergi|no|without|tanpa|avoid|cant eat|cannot eat|can t eat|cant have|dont eat|don t eat|not eat|tak boleh makan|tak makan|tak nak|jangan|intolerant|intolerance|free|tak tahan|sensitive|no more|hate|exclude|except|minus|kecuali|tak boleh)\b/;

export type Reading = Omit<Understanding, "intent" | "confidence" | "guess">;

/** Everything but the intent: the slots, and the question as the intent model reads it. */
export function read(items: Dish[], question: string): Reading {
  const raw = question.normalize("NFKC").toLowerCase();
  const ix = dishIndex(items);
  // fix typos in the words we read constraints from, but never in a word of a dish's name
  const toks = tokens(normalize(question), true).map((t) => (ix.df.has(t) ? t : correct(t)));
  // "saya alergi kacang", "allergic to nuts": the word after is an allergen, not a dish (Ais Kacang)
  const skip = new Set<number>();
  toks.forEach((t, i) => {
    if (!/^(alergi|allergic|allergy|allergies|alahan)$/.test(t)) return;
    for (let j = i + 1; j <= i + 3 && j < toks.length; j++) {
      if (/^(to|kepada|pada|dengan|a|an)$/.test(toks[j])) continue;
      if (mentionedAllergens(toks[j]).length || toks[j] === "kacang") skip.add(j);
      else break;
    }
  });
  const mentions = findDishes(items, raw, toks, skip);
  const dishWords = new Set(mentions.flatMap((m) => m.covered));
  // the question without its dish names: "vegetarian" in Vegetarian Mee Goreng is not a diet ask
  const rest = toks.filter((_, i) => !dishWords.has(i));
  const restText = rest.join(" ");
  let restRaw = raw;
  for (const m of mentions) for (const tr of Object.values(m.dish.translations ?? {})) if (tr?.name) restRaw = restRaw.split(tr.name).join(" ");

  const allergens = mentionedAllergens(`${restText} ${restRaw}`);
  const hasDish = mentions.length > 0;
  // "kacang" is nuts when they're avoiding it or asking about a dish ("satay ada kacang tak?")
  if (/\bkacang\b/.test(restText) && !allergens.includes("peanuts") && (AVOID_CUE.test(restText) || hasDish)) allergens.push("peanuts", "tree_nuts");
  const asksContents = ASKS_CONTENTS.test(restText) || /过敏|含有|含不含|有没有|成分|可以吃|能吃|有.{0,6}吗/.test(restRaw);
  const avoidCue = AVOID_CUE.test(restText) || /过敏|不要|不能吃|不吃|不含|无|戒|避免/.test(restRaw);
  // with no dish, any allergen named is one to avoid (the safe reading); with a dish, only when they say so
  const avoid = !hasDish || avoidCue ? allergens : [];

  const diet: Diet[] = [];
  if (/\b(vegan|plant based|plantbased)\b/.test(restText) || /纯素|全素/.test(restRaw)) diet.push("vegan");
  else if (/\b(vegetarian|veggie|vegetarians|vege|veg|no meat|meatless|meat free|tak makan daging|sayur sayuran|sayuran|vegetarian food)\b/.test(restText) || /素|斋/.test(restRaw)) diet.push("vegetarian");
  if (/\b(halal|no pork|tak makan babi|takde babi|muslim|muslims|pork free|non pork)\b/.test(restText) || /清真|无猪|不吃猪|没有猪/.test(restRaw)) diet.push("halal");

  const spice = spiceOf(rest, restRaw);
  const party = partyOf(restText, restRaw);
  const budget = budgetOf(restText, restRaw);
  const courses = COURSES.filter((c) => c.ask.test(restText) || c.askZh.test(restRaw)).map((c) => c.course);

  const light = /\b(light|lighter|not (very |that |so |too )?hungry|tak (berapa |begitu |sangat )?lapar|x lapar|peckish|small bite|something small|snack|ringan|tak nak kenyang|kecil|healthy|healthier|on a diet|diet)\b/.test(restText) || /清淡|不饿|不太饿|小份|轻食|健康/.test(restRaw);
  const hearty = !light && (/\b(hungry|starving|starved|famished|filling|heavy|big meal|lapar|kebulur|kenyang|hearty|full meal|very hungry)\b/.test(restText) || /很饿|饿死|吃饱|大份|饱/.test(restRaw));

  const superlative: Superlative | null =
    /\b(cheapest|least expensive|most affordable|lowest price|cheaper|murah sekali|paling murah|termurah|budget option|cheapest one)\b/.test(restText) || /最便宜|便宜一点|比较便宜/.test(restRaw)
      ? "cheapest"
      : /\b(most expensive|priciest|pricier|paling mahal|termahal|most premium)\b/.test(restText) || /最贵/.test(restRaw)
        ? "priciest"
        : /\b(spiciest|hottest|most spicy|spicier|paling pedas|terpedas)\b/.test(restText) || /最辣|比较辣/.test(restRaw)
          ? "spiciest"
          : /\b(mildest|least spicy|less spicy|paling tak pedas|tak berapa pedas)\b/.test(restText) || /最不辣|没那么辣/.test(restRaw)
            ? "mildest"
            : /\b(most popular|best seller|bestseller|paling laris|paling popular|top seller|most ordered)\b/.test(restText) || /最受欢迎|卖得最好|最多人点/.test(restRaw)
              ? "popular"
              : null;
  if (superlative === "spiciest" && spice.min === 2) spice.min = null;

  const refersBack = /\b(those|these|them|that one|this one|the first|the second|the last one|it|yang tu|yang itu|yang ini|yang mana|out of)\b/.test(restText) || /那个|这个|那些|这些|它|哪个|哪一个/.test(restRaw);

  const delexicalized: string[] = [];
  toks.forEach((t, i) => {
    if (dishWords.has(i)) {
      if (delexicalized[delexicalized.length - 1] !== "§dish") delexicalized.push("§dish");
    } else delexicalized.push(/^(rm|myr|\$)?\d+(\.\d+)?$/.test(t) ? "§num" : t);
  });
  // a translated dish name found by substring: mark it too
  if (mentions.some((m) => !m.covered.length)) delexicalized.unshift("§dish");
  return {
    delexicalized,
    dishes: mentions.map((m) => m.dish),
    avoid: [...new Set(avoid)],
    allergens: [...new Set(allergens)],
    asksContents,
    diet,
    maxSpice: spice.max,
    minSpice: spice.min,
    budget,
    amount: groupBudgetOf(restText),
    party,
    courses,
    appetite: light ? "light" : hearty ? "hearty" : null,
    superlative,
    refersBack,
  };
}

export function understand(items: Dish[], question: string): Understanding {
  const r = read(items, question);
  const guess = classify(intentModel(), modelTokens(r.delexicalized));
  return { ...r, intent: guess.intent, confidence: guess.confidence, guess };
}

/** The tokens the intent model sees. */
export const modelTokens = (delexicalized: string[]) => tokens(delexicalized.join(" "));
