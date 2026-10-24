// The menu brain: the guest assistant that runs on our own Worker at no cost. It understands the
// question (./understand), remembers the conversation (constraints the guest set earlier, the
// dishes it just showed), decides what to do, picks dishes from the restaurant's data (signatures,
// what guests order, what they order together) and writes the answer from templates, so every
// dish, price and allergen it states comes from the menu.
import { ALLERGENS, ALLERGEN_LABELS, type Allergen } from "../../../shared/allergens";
import { localizeItem } from "../../../shared/menuI18n";
import type { MenuItem } from "../../../shared/types";
import { clockLabel, scheduleName, weekdayNames, type TimedMenu } from "../../../shared/schedule";
import { formatters, translator, type MessageKey } from "../../../i18n/core";
import { normalize } from "../../../shared/brain/text";
import type { Intent } from "../../../shared/brain/intentModel";
import { allergyNote, type AssistantContext, type AssistantReply } from "../local";
import type { TasteHint } from "../../taste/bridge";
import { conceptsOf, conceptTerms, dishConceptLift, type ConceptId } from "./concepts";
import { courseDishes, intentModel, isDessert, isDrink, read, understand, type Course, type Diet, type Dish, type Understanding } from "./understand";

type Item = AssistantContext["items"][number];

export interface BrainReply extends AssistantReply {
  intent: Intent;
  /** For the log: the intent model's confidence and the question as it read it. */
  confidence?: number;
  delexicalized?: string;
}

/** What the guest has told us so far, and what we last showed them. */
export interface DialogueState {
  avoid: Allergen[];
  diet: Diet[];
  maxSpice: number | null;
  /** "no alcohol" said earlier. */
  noAlcohol: boolean;
  /** Dishes the last answer named, in its order. */
  shown: Item[];
  /** The dish being talked about. */
  focus: Item | null;
}

/** Dishes an answer names, in the order it names them (by name or by the guest's-language label). */
export function dishesIn(ctx: AssistantContext, text: string): Item[] {
  const t = text.toLowerCase();
  const n = ` ${normalize(text)} `;
  return ctx.items
    .map((i) => {
      const names = [i.name, ...Object.values(i.translations ?? {}).map((x) => x?.name ?? "")].filter((x) => x.length > 1);
      const at = Math.min(...names.map((x) => (/[a-z]/i.test(x) ? n.indexOf(` ${normalize(x.replace(/\(.*?\)/g, ""))} `) : t.indexOf(x.toLowerCase()))).map((x) => (x < 0 ? Infinity : x)));
      return { i, at };
    })
    .filter((x) => Number.isFinite(x.at))
    .sort((a, b) => a.at - b.at)
    .map((x) => x.i);
}

export function dialogueState(ctx: AssistantContext, history: { role: "user" | "assistant"; content: string }[]): DialogueState {
  const s: DialogueState = { avoid: [], diet: [], maxSpice: null, noAlcohol: false, shown: [], focus: null };
  for (const h of history) {
    if (h.role === "user") {
      const u = read(ctx.items as Dish[], h.content);
      s.avoid = [...new Set([...s.avoid, ...u.avoid])];
      s.diet = [...new Set([...s.diet, ...u.diet])];
      if (u.maxSpice !== null) s.maxSpice = u.maxSpice;
      if (u.noAlcohol) s.noAlcohol = true;
      if (u.minSpice !== null) s.maxSpice = null;
      if (u.dishes.length === 1) s.focus = u.dishes[0] as Item;
    } else {
      const named = dishesIn(ctx, h.content);
      if (named.length) {
        s.shown = named;
        if (named.length === 1) s.focus = named[0];
      }
    }
  }
  return s;
}

// ---- picking dishes ----

const RICH = /coconut|santan|lemak|curry|kari|fried|goreng|sambal|cream|cheese|butter|rendang|chilli|chili|spicy|pedas|peanut sauce|gravy|deep|crispy|bacon|fatty|oil/i;
const REFRESHING = /lime|lemon|limau|calamansi|barley|iced|\bice\b|ais|juice|jus|soda|cucumber|mint|coconut water|air kelapa|sirap|sparkling|water|green tea|cold/i;
const HEAVY = /rice|nasi|fried|goreng|lemak|curry|kari|rendang|burger|steak|noodle|mee|pasta|pizza|biryani|set|platter|chicken|ayam|beef|lamb|pork|duck/i;
const LIGHT = /salad|soup|broth|fruit|steamed|rojak|toast|egg|side|kuih|sushi|sashimi|tofu|vegetable|greens|cucumber|light|small|bun|dumpling|spring roll/i;

/** How filling a dish looks from its name, description and course (higher is heavier). */
export function heaviness(i: Dish): number {
  const text = `${i.name} ${i.description ?? ""} ${i.category ?? ""}`;
  let h = 0;
  h += (text.match(new RegExp(HEAVY, "gi")) ?? []).length;
  h -= 1.2 * (text.match(new RegExp(LIGHT, "gi")) ?? []).length;
  if (/side|starter|snack|appeti|small/i.test(i.category ?? "")) h -= 1.5;
  if (/main|rice|nasi|noodle|mee/i.test(i.category ?? "")) h += 1;
  return h;
}

const popularityScore = (i: Item) => {
  const p = i.popularity ?? 0;
  // smoothed: a dish ordered twice isn't twice as good as one ordered once
  return p / (p + 5);
};
const baseScore = (i: Item, ctx?: AssistantContext) => (i.isSignature ? 1 : 0) + popularityScore(i) + (ctx ? chatBoost(ctx, i) : 0) - i.sort * 0.001;

interface Constraints {
  avoid: Allergen[];
  diet: Diet[];
  maxSpice: number | null;
  minSpice: number | null;
  budget: number | null;
  noAlcohol?: boolean;
}

const ALCOHOL = /\b(beer|lager|stout|ale|sake|soju|wine|whisky|whiskey|highball|cocktail|gin|vodka|rum|tequila|shochu|umeshu|cider|alcohol|alcoholic)\b|啤酒|清酒|烧酒|葡萄酒|鸡尾酒|威士忌|梅酒/i;
export const isAlcoholic = (i: Dish) => ALCOHOL.test(`${i.name} ${i.description ?? ""} ${i.category ?? ""}`) || Object.values(i.translations ?? {}).some((x) => /酒/.test(x?.name ?? ""));

function allowed(i: Item, c: Constraints) {
  if (c.avoid.some((a) => i.allergens.includes(a))) return false;
  if (c.diet.includes("vegan") && !i.dietary.includes("vegan")) return false;
  if (c.diet.includes("vegetarian") && !i.dietary.includes("vegetarian") && !i.dietary.includes("vegan")) return false;
  if (c.diet.includes("halal") && !i.dietary.includes("halal") && !i.dietary.includes("halal_friendly")) return false;
  if (c.maxSpice !== null && i.spiceLevel > c.maxSpice) return false;
  if (c.minSpice !== null && i.spiceLevel < c.minSpice) return false;
  if (c.budget !== null && i.price > c.budget) return false;
  if (c.noAlcohol && isAlcoholic(i)) return false;
  return true;
}

const conceptMemo = new WeakMap<object, ConceptId[]>();
const conceptsFor = (i: Item) => {
  let c = conceptMemo.get(i);
  if (!c) conceptMemo.set(i, (c = conceptsOf(i)));
  return c;
};

/**
 * How much likelier guests are to order `b` with `a` than at all (lift), from the most specific
 * evidence there is: this branch's orders, shrunk towards what guests do across every restaurant
 * (by dish concept), which is itself shrunk towards the teacher's prior. With no orders anywhere,
 * the prior decides; as orders build up, they take over.
 */
export function pairLift(ctx: AssistantContext, a: Item, b: Item): { lift: number; together: number; source: "branch" | "platform" | "prior" | "none" } {
  const concept = dishConceptLift(conceptsFor(a), conceptsFor(b), ctx.platform);
  const together = ctx.together?.[a.id]?.[b.id] ?? 0;
  const na = ctx.orderCounts?.[a.id] ?? 0;
  const nb = ctx.orderCounts?.[b.id] ?? 0;
  const total = ctx.totalOrders ?? 0;
  const fallback = { lift: concept.lift, together, source: concept.lift > 1 ? (concept.learnt ? "platform" : "prior") : "none" } as const;
  if (!total || !na || !nb) return fallback;
  const pb = nb / total;
  const alpha = 8;
  const lift = (together + alpha * concept.lift * pb) / (na + alpha) / pb;
  return { lift, together, source: together >= 3 ? "branch" : fallback.source };
}

/** A small, smoothed boost for dishes guests add from the chat more often than most (learning to rank). */
function chatBoost(ctx: AssistantContext, i: Item): number {
  const shown = ctx.chatShown?.[i.id] ?? 0;
  if (shown < 10) return 0;
  const shownAll = Object.values(ctx.chatShown ?? {}).reduce((s, n) => s + n, 0);
  const addedAll = Object.values(ctx.chatAdded ?? {}).reduce((s, n) => s + n, 0);
  const base = shownAll ? addedAll / shownAll : 0;
  const k = 20;
  const rate = ((ctx.chatAdded?.[i.id] ?? 0) + k * base) / (shown + k);
  return Math.max(-0.3, Math.min(0.3, (rate - base) * 3));
}

// ---- searching ----

// Words that never make a search ("what", "please", "do you have"): a search word is what's left
const NOT_SEARCH = new Set(
  "a an the of to for in on at and or with is are was be it its i im me my we our you your u do does did can could would should will have has had got get any anything something some what which who how when where why there here this that these those one ones please pls thanks thank ok okay ah lah leh la ya yeah hi hello hey eh so just only also really very much more menu food dish dishes eat drink serve sell selling sold today now available ada tak x ke ni tu apa mana boleh nak mau yang yg dan atau ka kah tak ada punya jual tiada takde whats what's good best nice great tasty delicious yummy sedap popular famous recommend recommendation suggest suggestion try tried want wanna like love need give show tell about else other another kat sini ini itu should must let lets us them they he she".split(" "),
);
// the words a guest searches by, in the menu's language
const SYNONYMS: Record<string, string[]> = {
  ayam: ["chicken"], chicken: ["ayam"], ikan: ["fish"], fish: ["ikan"], udang: ["prawn", "shrimp"], prawn: ["udang", "shrimp"], shrimp: ["prawn", "udang"],
  sotong: ["squid", "calamari"], squid: ["sotong", "calamari"], daging: ["beef"], beef: ["daging"], kambing: ["mutton", "lamb"], mutton: ["kambing", "lamb"], lamb: ["kambing", "mutton"],
  telur: ["egg"], egg: ["telur"], sayur: ["vegetable", "vegetables", "greens"], tauhu: ["tofu"], tofu: ["tauhu"], mee: ["noodle", "noodles", "mi"], mi: ["mee", "noodle"], noodle: ["mee", "mi"],
  nasi: ["rice"], rice: ["nasi"], keju: ["cheese"], cheese: ["keju"], keledek: ["sweet potato"], babi: ["pork"], pork: ["babi"], ketam: ["crab"], crab: ["ketam"], kopi: ["coffee"], coffee: ["kopi"],
  teh: ["tea"], tea: ["teh"], kelapa: ["coconut"], coconut: ["kelapa"], mangga: ["mango"], mango: ["mangga"], pisang: ["banana"], banana: ["pisang"],
};
const ZH_WORDS: [RegExp, string[]][] = [[/鸡/, ["chicken", "ayam"]], [/鱼/, ["fish", "ikan"]], [/虾/, ["prawn", "shrimp", "udang"]], [/豆腐/, ["tofu", "tauhu"]], [/牛/, ["beef"]], [/猪/, ["pork"]], [/羊/, ["mutton", "lamb"]], [/蛋/, ["egg"]], [/芒果/, ["mango"]], [/咖啡/, ["coffee", "kopi"]], [/椰/, ["coconut"]]];

const words = (i: Item) => new Set(normalize(`${i.name} ${i.description ?? ""} ${i.category ?? ""}`).split(" ").flatMap((w) => [w, w.replace(/(es|s)$/, "")]));
const hasTerm = (i: Item, w: string) => {
  const ws = words(i);
  return [w, ...(SYNONYMS[w] ?? [])].some((x) => (x.includes(" ") ? normalize(`${i.name} ${i.description ?? ""}`).includes(x) : ws.has(x) || ws.has(x.replace(/(es|s)$/, ""))));
};
const zhName = (i: Item) => Object.values(i.translations ?? {}).map((x) => x?.name ?? "").join(" ");

/**
 * A plain search of the menu: "chicken", "ayam", "do you have frappuccino?", "有没有披萨？".
 * Returns the dishes that have what was asked, and what of it the menu doesn't have.
 */
function search(question: string, live: Item[], knownWord: (w: string) => boolean, base: (i: Item) => number): { hits: Item[]; missing: string | null } | null {
  const zh = /[\u4e00-\u9fff]/.test(question);
  if (zh) {
    const m = question.match(/有没有(?:卖)?([^?？!！，。,]+?)[吗呢]?[?？!！。]*$/) ?? question.match(/^(?:有)?([^?？!！，。,]+?)有(?:没有|吗)[?？]*$/) ?? question.match(/^有([^?？!！，。,]+?)吗[?？]*$/);
    if (!m) return null;
    const thing = m[1].trim();
    if (!thing || /什么|哪|推荐/.test(thing)) return null;
    const byName = live.filter((i) => zhName(i).includes(thing) || i.name.includes(thing));
    if (byName.length) return { hits: byName.sort((a, b) => base(b) - base(a)), missing: null };
    // a kind of food ("鸡", "鱼") by its ingredient words
    const kind = ZH_WORDS.filter(([re]) => re.test(thing) && thing.length <= 2).flatMap(([, ws]) => ws);
    const hits = kind.length ? live.filter((i) => kind.some((w) => hasTerm(i, w))) : [];
    return { hits: hits.sort((a, b) => base(b) - base(a)), missing: hits.length ? null : thing };
  }
  const toks = normalize(question).split(" ").filter(Boolean);
  const content = toks.filter((w) => !NOT_SEARCH.has(w) && !/^\d/.test(w) && w.length > 1);
  if (!content.length || content.length > 4) return null;
  // a search is a short question or one that asks for something by name ("do you have", "got", "ada")
  const cue = /\b(do you have|have you got|got|ada|any|serve|sell|jual)\b/.test(toks.join(" "));
  if (toks.length > 3 && !cue) return null;
  const found = content.filter((w) => w.length >= 3 && live.some((i) => hasTerm(i, w)));
  // a word the menu doesn't have counts as asked for only if it names a food ("pizza") or is
  // unknown to the brain ("frappuccino"); "whats", "good" are just words
  const missing = content.filter((w) => !found.includes(w) && (conceptTerms(w).length || !knownWord(w)));
  if (!found.length && !missing.length) return null;
  // the dish's own name says it best, then its description, then its course
  const score = (i: Item) => found.reduce((s, w) => s + (hasTerm({ ...i, description: "", category: "" }, w) ? 2 : hasTerm({ ...i, category: "" }, w) ? 1 : 0.5 * Number(hasTerm(i, w))), 0);
  const hits = found.length ? live.filter((i) => score(i) > 0).sort((a, b) => score(b) - score(a) || base(b) - base(a)) : [];
  if (!missing.length) return { hits, missing: null };
  // "coffee frappuccino with caramel drizzle": say what isn't on the menu, in their words
  const from = toks.indexOf(content[0]);
  const to = toks.lastIndexOf(content[content.length - 1]);
  return { hits: hits.filter((i) => score(i) === Math.max(...hits.map(score))), missing: toks.slice(from, to + 1).join(" ") };
}

// ---- answering ----

export function answerGuest(ctx: AssistantContext, history: { role: "user" | "assistant"; content: string }[], locale = "en", taste?: TasteHint | null): BrainReply {
  const question = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const earlier = history.slice(0, history.map((h) => h.content).lastIndexOf(question));
  const state = dialogueState(ctx, earlier);
  const u = understand(ctx.items as Dish[], question);
  return { ...respond(ctx, u, state, locale, taste ?? undefined), confidence: u.confidence, delexicalized: u.delexicalized.join(" ") };
}

/**
 * `taste` is what fans of something the guest loves tend to like (from Qloo, ../../taste/bridge):
 * a boost on dishes, applied after every filter, so it changes the order, never what's safe.
 */
export function respond(ctx: AssistantContext, u: Understanding, state: DialogueState, locale: string, taste?: TasteHint): BrainReply {
  const t = translator(locale);
  const f = formatters(locale);
  const en = locale === "en";
  const money = (n: number) => f.money(n, ctx.currency);
  const name = (i: MenuItem) => localizeItem(i, locale, ctx.menuLanguage ?? "en").name;
  const desc = (i: MenuItem) => {
    const d = localizeItem(i, locale, ctx.menuLanguage ?? "en");
    return (d.description || d.story || "").replace(/\s*\((signature|vegetarian|vegan|halal)\)/gi, "").trim();
  };
  const allergen = (a: string) => {
    if (en) return ALLERGEN_LABELS[a as Allergen] ?? a;
    const key = `allergens.${a}` as MessageKey;
    return t(key) === key ? a : t(key);
  };
  const list = (xs: string[]) => xs.join(t("assistantReply.listSep"));
  const stop = en ? "." : "。";
  const sp = en ? " " : "";
  const brief = (i: Item, reason?: string) => ({ id: i.id, name: i.name, price: i.price, reason });
  // a dish on a deal says so: "Teh Tarik (RM3.50, usually RM5.00)"
  const line = (i: Item) => `${name(i)} (${money(i.price)}${i.listPrice && i.listPrice > i.price ? `${t("assistantReply.listSep")}${t("assistantReply.usually", { price: money(i.listPrice) })}` : ""})`;
  // "from 3:00 pm today", "from Sat 7:00 am"
  const when = (n: { weekday: number; time: string; today: boolean }) =>
    n.today ? t("assistantReply.fromToday", { time: clockLabel(n.time, locale) }) : t("assistantReply.fromDay", { day: weekdayNames(locale)[n.weekday], time: clockLabel(n.time, locale) });
  const until = (time: string | null | undefined) => (time ? t("assistantReply.untilTime", { time: clockLabel(time, locale) }) : "");
  const menuName = (m: { name: string; translations?: TimedMenu["translations"] }) => scheduleName(m, locale);

  const live = ctx.items.filter((i) => i.active && !i.soldOut && i.servedNow !== false);
  const mentioned = u.dishes.map((d) => ctx.items.find((i) => i.id === d.id)!).filter(Boolean);
  const avoid = [...new Set([...state.avoid, ...u.avoid])];
  const c: Constraints = {
    avoid,
    diet: [...new Set([...state.diet, ...u.diet])],
    maxSpice: u.minSpice !== null ? null : (u.maxSpice ?? state.maxSpice),
    minSpice: u.minSpice,
    budget: u.budget,
    noAlcohol: u.noAlcohol || state.noAlcohol,
  };
  const safety = avoid.length || u.allergens.length ? allyNote(locale) : undefined;
  // a card is an "add to order" button: never one for a dish that breaks an allergy or diet the guest
  // stated, even when the text is warning them about it
  const said = { avoid: [...new Set([...state.avoid, ...u.stated])], diet: [...new Set([...state.diet, ...u.statedDiet])] };
  // ...and none for a dish that isn't served right now (it can't be ordered yet)
  const safeCard = (i: Item) => i.servedNow !== false && allowed(i, { ...said, maxSpice: null, minSpice: null, budget: null });
  const reply = (intent: Intent, answer: string, items: Item[], extra: Partial<AssistantReply> = {}): BrainReply => ({
    answer,
    items: items.filter(safeCard).slice(0, 6).map((i) => brief(i, reasonFor(i))),
    safetyNote: safety,
    engine: "local",
    confident: true,
    intent,
    ...extra,
  });
  const reasonFor = (i: Item) =>
    [
      i.isSignature ? t("assistantReply.signature") : (i.popularity ?? 0) > 0 ? t("assistantReply.popularToday") : "",
      i.spiceLevel ? t("diet.spicy", { count: i.spiceLevel }) : "",
      i.dietary.includes("vegetarian") || i.dietary.includes("vegan") ? t("assistantReply.vegetarian") : "",
    ]
      .filter(Boolean)
      .join(" · ") || undefined;

  // the filters as words, for "here's what's vegetarian, under RM15"
  const filterWords = () => {
    const w: string[] = [];
    if (avoid.length >= ALLERGENS.length - 1) w.push(t("assistantReply.freeOfAll"));
    else if (avoid.length) w.push(t("assistantReply.freeOf", { list: avoid.map((a) => (en ? ALLERGEN_LABELS[a].split(" (")[0].toLowerCase() : allergen(a))).join(t("assistantReply.and")) }));
    if (c.diet.includes("vegan")) w.push(t("assistantReply.vegan"));
    else if (c.diet.includes("vegetarian")) w.push(t("assistantReply.vegetarian"));
    if (c.diet.includes("halal")) w.push(t("assistantReply.halal"));
    if (c.maxSpice === 0) w.push(t("assistantReply.notSpicy"));
    else if (c.maxSpice === 1) w.push(t("assistantReply.mild"));
    else if (c.minSpice) w.push(t("assistantReply.spicy"));
    if (c.budget !== null) w.push(t("assistantReply.under", { price: money(c.budget) }));
    return w.join(t("assistantReply.filterSep"));
  };

  // what the question is about: named dishes, else the one we were talking about
  const nth = u.ordinal !== null && state.shown.length ? state.shown.at(u.ordinal) : undefined;
  const focus = mentioned.length ? mentioned : nth ? [nth] : u.refersBack && state.focus ? [state.focus] : [];

  // ---- decide ----
  let intent = u.intent;
  const unsure = u.confidence < 0.4;
  const hasFilters = !!(u.noAlcohol || u.avoid.length || u.diet.length || u.maxSpice !== null || u.minSpice !== null || u.budget !== null || u.courses.length || u.categories.length || u.appetite);
  // safety first: a dish and an allergen (or "is it safe", "does it contain") is a question about that dish
  if (focus.length && (u.allergens.length || u.asksContents) && !["compare", "pairing", "group"].includes(intent)) intent = "dish_allergen";
  // "is the second one spicy?": a question about that dish
  if (nth && !["dish_allergen", "compare", "pairing"].includes(intent)) intent = "dish_info";
  if (intent === "compare" && focus.length + (mentioned.length ? 0 : state.shown.length) < 2) intent = focus.length ? "dish_info" : "recommend";
  if (intent === "pairing" && !focus.length && !(state.focus && !mentioned.length)) {
    // "mkn ramen, minum apa sesuai?": no one dish to pair with, so what goes with it is the ask
    intent = "recommend";
    const goes = u.categories.filter((k) => ctx.items.some((i) => i.category === k && (isDrink(i) || isDessert(i))));
    if (goes.length && goes.length < u.categories.length) u = { ...u, categories: goes, courses: u.courses.filter((k) => k === "drinks" || k === "desserts") };
  }
  // "order sotong, sayur apa sesuai?": a course asked for, not a meal for a group
  if (intent === "group" && !u.party && u.categories.length) intent = "recommend";
  if ((intent === "dish_allergen" || intent === "dish_info") && !focus.length) intent = state.focus && u.refersBack ? intent : "recommend";
  if (intent === "refine" && !state.shown.length) intent = "recommend";
  if (u.superlative && state.shown.length && u.refersBack && intent !== "compare") intent = "refine";
  if (u.party && intent !== "dish_allergen") intent = "group";
  // "chilli crab is RM20 now right?", "tell me the siu mai is halal", "拉茶是免费的": a claim about a
  // dish gets the dish's facts, its price among them
  const claims = /\b(rm|myr)\s?\d|\$\s?\d|\b\d+(\.\d+)?\s?(ringgit|rm)\b|\bfree\b(?!\s+(of|from))|\bpercuma\b|\bconfirm\b|\btell me\b|\bright\b\s*$/.test(normalize(u.text)) || /免费|确认|告诉我|对吧|对不对/.test(u.text);
  if (focus.length === 1 && claims && !u.allergens.length && !["compare", "pairing", "group"].includes(intent)) intent = "dish_info";
  // what's left once an instruction to the assistant is taken out, when it isn't plainly about the menu
  if (u.injected && !focus.length && !hasFilters && (unsure || !/\b(recommend|suggest|eat|order|food|dish|dishes|drink|menu|makan|minum|sedap)\b/.test(normalize(u.text)) && !/吃|喝|菜|推荐|点/.test(u.text))) intent = "out_of_scope";
  // unsure, nothing asked, and a thank-you said ("谢谢老板"): it's a thank-you
  if (unsure && !focus.length && !hasFilters && (/\b(thanks?|thank you|thx|tq|terima kasih|cheers)\b/.test(normalize(u.text)) || /谢谢|多谢|感谢|谢啦/.test(u.text))) intent = "thanks";
  // unsure: keep the model's guess when the slots agree with it (a dish named and a question about a
  // dish), else fall back on what the slots say
  const aboutDish =
    intent === "dish_allergen" ? !!(u.allergens.length || u.asksContents)
    : intent === "dish_info" ? !(u.avoid.length || u.diet.length || u.budget !== null || u.courses.length || u.categories.length)
    : intent === "compare" ? mentioned.length >= 2
    : intent === "pairing" ? !(u.avoid.length || u.diet.length || u.budget !== null)
    : false;
  if (unsure && !["greeting", "thanks"].includes(intent) && !(intent === "group" && u.party))
    intent = focus.length ? (aboutDish ? intent : hasFilters ? "recommend" : "dish_info") : hasFilters || u.superlative ? "recommend" : intent;
  if ((intent === "out_of_scope" || intent === "about" || intent === "greeting") && hasFilters) intent = "recommend";
  // "Ebi tempura vs takoyaki, which one cheaper?", "acai bowl ke quinoa bowl, mana lg sihat?": two dishes weighed
  if (mentioned.length >= 2 && !["dish_allergen", "pairing", "group"].includes(intent) && (/\b(vs|versus|or|ke|atau|compare|which|mana|better|cheaper|difference|lagi|lg)\b/.test(normalize(u.text)) || /还是|或者|比较|哪个|哪一/.test(u.text))) intent = "compare";
  // "which one has no peanuts?", "any of those without dairy?", "哪个没有虾": narrow what was just shown
  if (u.choosing && !mentioned.length && !nth && state.shown.length >= 2 && hasFilters && !["compare", "pairing", "group"].includes(intent)) intent = "refine";
  // "I love BTS, what should I get?": a taste Qloo could place on this menu is a recommendation
  if (taste && ["out_of_scope", "about", "greeting"].includes(intent)) intent = "recommend";

  // "what are you known for?", "chef's specials": the signatures, not the story
  if (u.signatures && !mentioned.length && ["about", "out_of_scope", "greeting", "recommend", "dish_info", "dish_allergen", "compare"].includes(intent)) intent = "recommend";
  // ---- what's on when: deals, timed and seasonal menus, a dish not served now ----
  const rank = (pool: Item[]) => [...pool].sort((a, b) => baseScore(b, ctx) - baseScore(a, ctx));
  const notNowNote = (i: Item) => {
    const n = i.nextServed;
    if (i.servedNow !== false || !n) return "";
    const m = ctx.menus?.find((x) => x.id === n.menuId);
    return t("assistantReply.notNow", { dish: name(i), menu: m ? menuName(m) : n.menu, when: when(n) });
  };
  // "any promo?", "happy hour?", "优惠": the dishes on a deal now, or when the next one starts
  if (u.asksDeals && !mentioned.length) {
    const course = u.categories.length ? live.filter((i) => u.categories.includes(i.category ?? "")) : u.courses.length ? live.filter((i) => u.courses.some((k) => courseDishes(ctx.items as Dish[], k).some((d) => d.id === i.id))) : live;
    const dealt = course.filter((i) => i.deal && allowed(i, c));
    if (dealt.length) {
      const byDeal = new Map<string, Item[]>();
      for (const i of dealt) byDeal.set(i.deal!.id, [...(byDeal.get(i.deal!.id) ?? []), i]);
      const parts = [...byDeal].map(([id, xs]) => {
        const d = ctx.now?.deals.find((x) => x.id === id);
        return `${t("assistantReply.dealsNow", { deal: d?.name ?? xs[0].deal!.name, until: until(d?.until) })}${sp}${rank(xs).slice(0, 4).map(line).join(t("assistantReply.itemSep"))}${stop}`;
      });
      return reply("recommend", parts.join(sp), rank(dealt).slice(0, 6));
    }
    const next = [...(ctx.now?.dealsNext ?? [])].sort((a, b) => Number(b.today) - Number(a.today));
    const sig = rank(live.filter((i) => !isDrink(i) && allowed(i, c))).slice(0, 3);
    const ahead = next.length ? `${sp}${next.slice(0, 2).map((d) => t("assistantReply.dealsNext", { deal: d.name, when: when(d) })).join(sp)}` : "";
    return reply("recommend", `${t("assistantReply.dealsNone")}${ahead}${sp}${t("assistantReply.meanwhile", { list: list(sig.map(line)) })}`, sig);
  }
  // "breakfast?", "what's for supper?", "anything seasonal?", "早餐": a timed menu of this restaurant
  const timed = (ctx.menus ?? []).filter((m) => {
    if (u.asksSeasonal && /season|limited|festive|special|musim|raya|cny|durian|mooncake|季|限|节/i.test(m.name)) return true;
    const words = normalize(m.name).split(" ").filter((w) => w.length >= 4 && !/^(menu|hour|hours|time|bites|specials?|items?|daily)$/.test(w));
    const zh = Object.values(m.translations ?? {}).map((x) => x?.name ?? "").filter((x) => x.length >= 2);
    const text = normalize(u.text);
    const syn = (w: string) => ({ breakfast: /sarapan|早餐|早饭|morning/, lunch: /tengah ?hari|午餐|午饭/, dinner: /makan malam|晚餐|晚饭/, supper: /late night|lewat malam|宵夜|夜宵/ } as Record<string, RegExp>)[w];
    return words.some((w) => new RegExp(`\\b${w}s?\\b`).test(text) || syn(w)?.test(`${text} ${u.text}`)) || zh.some((z) => u.text.includes(z));
  });
  if (timed.length && !mentioned.length && !u.asksDeals) {
    const on = timed.filter((m) => ctx.now?.menus.some((x) => x.id === m.id));
    if (on.length) {
      const pool = rank(live.filter((i) => on.some((m) => (i.menuIds ?? []).includes(m.id)) && allowed(i, c)));
      if (!pool.length) return reply("recommend", t("assistantReply.noneFound", { filters: filterWords() || t("assistantReply.whatYouAsked") }), []);
      const m = on[0];
      const picks = pool.slice(0, Math.min(4, u.howMany ?? 4));
      return reply("recommend", `${t("assistantReply.fromMenu", { menu: menuName(m), until: until(ctx.now?.menus.find((x) => x.id === m.id)?.until) })}${sp}${picks.map(line).join(t("assistantReply.itemSep"))}${stop}`, picks);
    }
    const m = timed[0];
    const later = ctx.items.find((i) => (i.menuIds ?? []).includes(m.id) && i.nextServed?.menuId === m.id)?.nextServed;
    const sig = rank(live.filter((i) => !isDrink(i) && allowed(i, c))).slice(0, 3);
    if (later) return reply("recommend", t("assistantReply.menuLater", { menu: menuName(m), when: when(later), list: list(sig.map(line)) }), sig);
  }
  // a plain search of the menu ("chicken", "有没有披萨？"): what matches, or an honest "we don't have it"
  const searchable = !mentioned.length && !nth && !u.superlative && !u.party && !u.signatures && !u.choosing && !(u.avoid.length || u.diet.length || u.maxSpice !== null || u.minSpice !== null || u.budget !== null) &&
    // "有没有云吞面？" names a dish more exactly than its course (面) does
    (!(u.courses.length || u.categories.length) || /有没有|有.+吗/.test(u.text)) && !["thanks", "compare", "pairing", "refine", "group"].includes(intent);
  // constraints said earlier still hold ("no peanuts" two questions ago)
  const found = searchable && (intent !== "order_help" || conceptTerms(u.text).length) ? search(u.text, live.filter((i) => allowed(i, c)), // a staff request ("nk panggil waiter") is a search only for a food it names ("do you have pizza?")
    (w) => intent === "order_help" || !!intentModel().vocab?.has(w), (i) => baseScore(i, ctx)) : null;
  if (found && (found.hits.length || found.missing)) {
    const top = found.hits.slice(0, found.missing ? 2 : 4);
    if (!found.missing) return reply("recommend", `${t("assistantReply.weHave")}${sp}${top.map(line).join(t("assistantReply.itemSep"))}${stop}`, top);
    // nothing by that name: the closest is the course it belongs to
    if (!top.length && (u.categories.length || u.courses.length)) {
      const ids = new Set(u.courses.flatMap((k) => courseDishes(ctx.items as Dish[], k).map((d) => d.id)));
      top.push(...live.filter((i) => allowed(i, c) && (u.categories.includes(i.category ?? "") || ids.has(i.id))).sort((a, b) => baseScore(b, ctx) - baseScore(a, ctx)).slice(0, 2));
    }
    if (top.length) return reply("recommend", `${t("assistantReply.noHaveClosest", { thing: found.missing })}${sp}${top.map(line).join(t("assistantReply.itemSep"))}${stop}`, top);
    const sig = [...live.filter((i) => !isDrink(i) && allowed(i, c))].sort((a, b) => baseScore(b, ctx) - baseScore(a, ctx)).slice(0, 3);
    return reply("recommend", t("assistantReply.noHave", { thing: found.missing, list: list(sig.map(name)) }), sig);
  }
  // "allergic to everything": no menu data can answer that safely, so staff do
  if (u.manyAllergies) return { ...reply("recommend", t("assistantReply.allergyStaff"), []), safetyNote: allyNote(locale) };
  // an allergy we can't name: never a confident recommendation, ask which ingredient instead
  if (u.allergyUnread && !focus.length && !avoid.length) return { ...reply("recommend", t("assistantReply.whichAllergen"), []), safetyNote: allyNote(locale) };

  const ranked = (pool: Item[]) => [...pool].sort((a, b) => baseScore(b, ctx) - baseScore(a, ctx));
  const sorted = (pool: Item[], s: Understanding["superlative"]) =>
    s === "cheapest" ? [...pool].sort((a, b) => a.price - b.price)
    : s === "priciest" ? [...pool].sort((a, b) => b.price - a.price)
    : s === "spiciest" ? [...pool].sort((a, b) => b.spiceLevel - a.spiceLevel || baseScore(b, ctx) - baseScore(a, ctx))
    : s === "mildest" ? [...pool].sort((a, b) => a.spiceLevel - b.spiceLevel || baseScore(b, ctx) - baseScore(a, ctx))
    : s === "popular" ? [...pool].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0) || baseScore(b, ctx) - baseScore(a, ctx))
    : ranked(pool);
  // the course on this menu (so "desserts" with nothing dairy-free left is an honest "none", not mains)
  const byCourse = (pool: Item[], courses: Course[]) => {
    // the menu's own categories first ("bowls", "skewers", 奶茶): they say exactly what's meant
    if (u.categories.length) return pool.filter((i) => u.categories.includes(i.category ?? ""));
    if (!courses.length) return pool;
    const ids = new Set(courses.flatMap((k) => courseDishes(ctx.items as Dish[], k).map((d) => d.id)));
    return ids.size ? pool.filter((i) => ids.has(i.id)) : pool;
  };
  // spice as a guest means it: "spicy" is the hot ones (level 2 and up, or 1 when that's all there
  // is), "very spicy" the hottest, "the spiciest" only the top level; "not spicy" with nothing at
  // that level offers the mildest, and says so
  const bySpice = (from: Item[]): { pool: Item[]; mildest: boolean } => {
    const base = from.filter((i) => allowed(i, { ...c, maxSpice: null, minSpice: null }));
    // ("which is spicier?" weighs the options: all of them, hottest first)
    const weighs = u.choosing || /\b(which|mana)\b/.test(normalize(u.text)) || /哪个|哪一/.test(u.text);
    if (u.superlative === "spiciest" && c.maxSpice === null && !weighs) {
      const top = Math.max(0, ...base.map((i) => i.spiceLevel));
      return { pool: top > 0 ? base.filter((i) => i.spiceLevel === top) : base, mildest: false };
    }
    if (u.superlative === "spiciest" && c.maxSpice === null) return { pool: base.filter((i) => i.spiceLevel >= (c.minSpice ?? 0)), mildest: false };
    if (c.minSpice !== null && u.superlative !== "spiciest") {
      const hot = base.filter((i) => i.spiceLevel >= c.minSpice! + 1);
      return { pool: hot.length ? hot : base.filter((i) => i.spiceLevel >= c.minSpice!), mildest: false };
    }
    if (c.maxSpice !== null) {
      const ok = base.filter((i) => i.spiceLevel <= c.maxSpice!);
      if (ok.length || !base.length) return { pool: ok, mildest: false };
      const low = Math.min(...base.map((i) => i.spiceLevel));
      return low <= c.maxSpice + 1 ? { pool: base.filter((i) => i.spiceLevel === low), mildest: true } : { pool: [], mildest: false };
    }
    return { pool: base, mildest: false };
  };
  const none = () => reply(intent, t("assistantReply.noneFound", { filters: filterWords() || t("assistantReply.whatYouAsked") }), []);

  switch (intent) {
    case "greeting":
    case "out_of_scope":
    case "order_help": {
      const sig = ranked(live).slice(0, 3);
      const ordering = /\b(order|cart|add|pesan|checkout|send)\b/.test(normalize(u.delexicalized.join(" "))) || /点餐|下单|加单/.test(u.delexicalized.join(""));
      const key = intent === "greeting" ? "assistantReply.help" : intent === "order_help" ? (ordering ? "assistantReply.orderHelp" : "assistantReply.staffHelp") : "assistantReply.outOfScope";
      // the favourites are named, not shown as cards: a hello or an off-topic question isn't a request for dishes
      return reply(intent, t(key, { list: list(sig.map(name)) }), [], { confident: intent !== "out_of_scope" });
    }
    case "thanks":
      return reply(intent, t("assistantReply.thanks"), []);
    case "about":
      return reply(
        intent,
        ctx.restaurant.story || ctx.restaurant.description || t("assistantReply.serves", { restaurant: ctx.restaurant.name, cuisine: ctx.restaurant.cuisine || t("assistantReply.deliciousFood"), branch: ctx.branchName }),
        [],
      );

    case "dish_allergen": {
      const parts = focus.map((item) => {
        const asked = u.allergens;
        const conflict = asked.filter((a) => item.allergens.includes(a));
        let s = item.allergens.length ? t("assistantReply.contains", { dish: name(item), list: list(item.allergens.map(allergen)) }) : t("assistantReply.noAllergens", { dish: name(item) });
        if (asked.length) s += conflict.length ? t("assistantReply.notSuitable", { list: list(conflict.map(allergen)) }) : t("assistantReply.doesntList", { list: list(asked.map(allergen)) });
        // what's in it, in the menu's words: "belacan", "cashew paste", "butter", "oyster sauce"
        if (desc(item)) s += `${sp}${t("assistantReply.madeWith", { description: desc(item).replace(/[.。]+$/, "") })}`;
        return s;
      });
      for (const item of focus) if (notNowNote(item)) parts.push(notNowNote(item));
      // and, when they're avoiding it, what they can have instead
      const unsafe = focus.filter((i) => avoid.some((a) => i.allergens.includes(a)));
      if (unsafe.length) {
        const alt = ranked(live.filter((i) => !focus.includes(i) && i.category === unsafe[0].category && allowed(i, { ...c, avoid: [...new Set([...avoid, ...u.allergens])] }))).slice(0, 2);
        if (alt.length) parts.push(t("assistantReply.insteadTry", { list: list(alt.map(line)) }));
        return { ...reply(intent, parts.join(sp), [...focus, ...alt]), safetyNote: allyNote(locale) };
      }
      return { ...reply(intent, parts.join(sp), focus), safetyNote: allyNote(locale) };
    }

    case "dish_info": {
      const item = focus[0];
      const d = localizeItem(item, locale, ctx.menuLanguage ?? "en");
      const description = desc(item);
      const parts = [d.story || description || t("assistantReply.oneOf", { dish: d.name, category: item.category ?? t("assistantReply.dishes") })];
      if (d.story && description && !parts[0].includes(description)) parts[0] = `${d.name}: ${description}${stop}${sp}${d.story}`;
      else if (!parts[0].toLowerCase().includes(d.name.toLowerCase())) parts[0] = `${d.name}: ${parts[0]}`;
      if (!/[.!?。]$/.test(parts[0])) parts[0] += stop;
      if (item.isSignature) parts.push(t("assistantReply.isSignature", { restaurant: ctx.restaurant.name }));
      parts.push(`${money(item.price)}${stop}`);
      parts.push(item.spiceLevel ? t("assistantReply.spiceLevel", { level: item.spiceLevel }) : t("assistantReply.notSpicySentence"));
      if (item.allergens.length) parts.push(t("assistantReply.allergensLabel", { list: list(item.allergens.map(allergen)) }).trim());
      if (notNowNote(item)) parts.push(notNowNote(item));
      return { ...reply(intent, parts.join(sp), [item]), safetyNote: item.allergens.length || safety ? allyNote(locale) : undefined };
    }

    case "compare": {
      const pair = (mentioned.length >= 2 ? mentioned : [...focus, ...state.shown.filter((s) => !focus.includes(s))]).slice(0, 3);
      const parts = pair.map((i) => {
        const bits = [money(i.price), i.spiceLevel ? t("diet.spicy", { count: i.spiceLevel }) : t("assistantReply.notSpicy")];
        if (i.dietary.includes("vegetarian") || i.dietary.includes("vegan")) bits.push(t("assistantReply.vegetarian"));
        return `${name(i)}: ${desc(i) || t("assistantReply.favourite")} (${bits.join(", ")})${stop}`;
      });
      const [a, b] = pair;
      const diff: string[] = [];
      if (a.price !== b.price) diff.push(t("assistantReply.cheaper", { dish: name(a.price < b.price ? a : b), diff: money(Math.abs(a.price - b.price)) }));
      if (a.spiceLevel !== b.spiceLevel) diff.push(t("assistantReply.spicier", { dish: name(a.spiceLevel > b.spiceLevel ? a : b) }));
      const veg = (i: Item) => i.dietary.includes("vegetarian") || i.dietary.includes("vegan");
      if (veg(a) !== veg(b)) diff.push(t("assistantReply.onlyVegetarian", { dish: name(veg(a) ? a : b) }));
      const onlyA = a.allergens.filter((x) => !b.allergens.includes(x));
      const onlyB = b.allergens.filter((x) => !a.allergens.includes(x));
      if (onlyA.length) diff.push(t("assistantReply.onlyContains", { dish: name(a), list: list(onlyA.map(allergen)), other: name(b) }));
      if (onlyB.length) diff.push(t("assistantReply.onlyContains", { dish: name(b), list: list(onlyB.map(allergen)), other: name(a) }));
      return { ...reply(intent, [...parts, ...diff].join(sp), pair), safetyNote: onlyA.length || onlyB.length || safety ? allyNote(locale) : undefined };
    }

    case "pairing": {
      const anchors = focus.length ? focus : state.focus ? [state.focus] : [];
      const anchor = anchors[0];
      const wanted = u.courses.filter((k) => k !== "food");
      const wantedCats = u.categories.filter((c) => !anchors.some((a) => a.category === c));
      let pool = live.filter((i) => !anchors.includes(i) && allowed(i, c));
      if (wantedCats.length) pool = pool.filter((i) => wantedCats.includes(i.category ?? ""));
      else if (wanted.length) pool = byCourse(pool, wanted);
      else if (anchors.every(isDrink)) pool = pool.filter((i) => !isDrink(i));
      else if (u.courses.includes("food")) pool = pool.filter((i) => !isDrink(i) && !isDessert(i) && i.category !== anchor.category);
      else pool = pool.filter((i) => isDrink(i) || (isDessert(i) && !anchors.some(isDessert)));
      if (!pool.length) return none();
      const richAnchor = anchors.some((a) => RICH.test(`${a.name} ${a.description}`) || a.spiceLevel > 0);
      const scored = pool.map((i) => {
        const best = anchors.map((a) => pairLift(ctx, a, i)).sort((x, y) => y.lift - x.lift)[0];
        const refreshing = REFRESHING.test(`${i.name} ${i.description}`) && richAnchor;
        const score = Math.log(best.lift) * 2 + (refreshing ? 0.6 : 0) + (isDrink(i) ? 0.3 : 0) + baseScore(i, ctx) * 0.5;
        return { i, score, source: best.lift > 1.3 ? best.source : "none", refreshing };
      });
      scored.sort((x, y) => y.score - x.score);
      // one of each course at most when the guest didn't ask for one
      const picks: typeof scored = [];
      for (const s of scored) {
        if (picks.length >= 2) break;
        if (!wanted.length && picks.some((p) => isDrink(p.i) === isDrink(s.i))) continue;
        picks.push(s);
      }
      let answer = t("assistantReply.pairWith", { dish: list(anchors.map(name)), list: list(picks.map((p) => line(p.i))) });
      // say why, from the strongest evidence behind the picks
      const why = picks.some((p) => p.source === "branch") ? "assistantReply.pairOften"
        : picks.some((p) => p.source === "platform") ? "assistantReply.pairPlatform"
        : picks.some((p) => p.source === "prior") ? "assistantReply.pairClassic"
        : picks.some((p) => p.refreshing) ? "assistantReply.pairCool" : null;
      if (why) answer += `${sp}${t(why)}`;
      return reply(intent, answer, [...picks.map((p) => p.i), ...anchors]);
    }

    case "group": {
      const n = u.party ?? 3;
      // "budget RM40" for a group is the total; "under RM15" is each dish
      const totalAsked = u.budget === null || /\b(budget|bajet)\b/.test(normalize(u.text));
      const total = totalAsked ? u.amount : null;
      const perDish = totalAsked ? null : u.budget;
      const pool = ranked(live.filter((i) => !isDrink(i) && allowed(i, { ...c, budget: perDish })));
      // a dish each, near enough, spread over the courses: mains first, then a side and a sweet
      const want = Math.max(3, Math.min(n + (n >= 4 ? 0 : 1), 8));
      const picks: Item[] = [];
      const perCourse = new Map<string, number>();
      const cap = Math.max(1, Math.ceil(want / 3));
      for (const pass of [0, 1])
        for (const i of pool) {
          if (picks.length >= want) break;
          if (picks.includes(i)) continue;
          const k = i.category ?? "";
          if (pass === 0 && (perCourse.get(k) ?? 0) >= cap) continue;
          if (pass === 0 && isDessert(i) && picks.length < want - 1) continue;
          if (total !== null && picks.reduce((s, p) => s + p.price, 0) + i.price > total) continue;
          picks.push(i);
          perCourse.set(k, (perCourse.get(k) ?? 0) + 1);
        }
      if (!picks.length) return none();
      const sum = picks.reduce((s, p) => s + p.price, 0);
      const key = u.party ? "assistantReply.groupPlan" : "assistantReply.groupPlanNoCount";
      const filters = filterWords();
      return reply(intent, `${t(key, { count: n, list: list(picks.map(line)), total: money(sum) })}${filters ? `${sp}${t("assistantReply.allAre", { filters })}` : ""}`, picks);
    }

    case "refine": {
      const spiced = bySpice(state.shown);
      let pool = byCourse(spiced.pool, u.courses);
      if (!pool.length) return none();
      const s = u.superlative;
      if (s) {
        const top = sorted(pool, s)[0];
        const key = `assistantReply.${s}Of` as MessageKey;
        return reply(intent, t(key, { dish: name(top), price: money(top.price), level: top.spiceLevel }), [top]);
      }
      const picks = ranked(pool).slice(0, Math.min(4, u.howMany ?? 4));
      if (spiced.mildest) return reply(intent, `${t("assistantReply.mildestOfThose")}${sp}${picks.map(line).join(t("assistantReply.itemSep"))}${stop}`, picks);
      return reply(intent, `${t("assistantReply.ofThose", { filters: filterWords() || t("assistantReply.whatYouAsked") })}${sp}${picks.map(line).join(t("assistantReply.itemSep"))}${stop}`, picks);
    }

    case "recommend":
    default: {
      const spiced = bySpice(live);
      let pool = byCourse(spiced.pool, u.courses);
      if (u.signatures && pool.some((i) => i.isSignature)) pool = pool.filter((i) => i.isSignature);
      if (u.appetite === "light" && !u.courses.length && !u.categories.length) {
        const food = pool.filter((i) => !isDrink(i));
        const median = [...food].map((i) => i.price).sort((a, b) => a - b)[Math.floor(food.length / 2)] ?? Infinity;
        const light = food.filter((i) => heaviness(i) <= 0.5 && i.price <= median * 1.15);
        pool = (light.length ? light : food).sort((a, b) => heaviness(a) - heaviness(b) || a.price - b.price);
        const picks = pool.slice(0, 3);
        if (!picks.length) return none();
        return reply("recommend", `${t("assistantReply.lightPicks")}${sp}${picks.map(line).join(t("assistantReply.itemSep"))}${stop}`, picks);
      }
      if (u.appetite === "hearty" && !u.courses.length && !u.categories.length) pool = pool.filter((i) => !isDrink(i) && !isDessert(i)).sort((a, b) => heaviness(b) - heaviness(a) || baseScore(b, ctx) - baseScore(a, ctx));
      if (!pool.length) return none();
      if (taste) {
        const boosted = pool.filter((i) => taste.boost[i.id]).sort((a, b) => taste.boost[b.id] - taste.boost[a.id] || baseScore(b, ctx) - baseScore(a, ctx));
        if (boosted.length) {
          // a meal's worth and a drink, when fans' places point at both
          const food = boosted.filter((i) => !isDrink(i)).slice(0, 3);
          const drink = boosted.find((i) => isDrink(i));
          const picks = [...food, ...(drink ? [drink] : [])].slice(0, 4);
          const filters = filterWords();
          const intro = taste.because.length ? t("assistantReply.tasteIntro", { liked: taste.liked, because: list(taste.because) }) : t("assistantReply.tasteIntroPlain", { liked: taste.liked });
          return reply("recommend", `${intro}${filters ? `${sp}${t("assistantReply.allAre", { filters })}` : ""}${sp}${picks.map(line).join(t("assistantReply.itemSep"))}${stop}${sp}${t("assistantReply.tasteNote", { liked: taste.liked })}`, picks, { taste: { liked: taste.liked, because: taste.because, source: "Qloo" } });
        }
      }
      const order = u.superlative ? sorted(pool, u.superlative) : u.appetite === "hearty" ? pool : ranked(pool);
      // food first: drinks are ordered most, but "anything vegetarian?" means a dish (one drink at most)
      const wantsDrinks = u.courses.includes("drinks") || (u.categories.length > 0 && pool.every(isDrink));
      // "the cheapest thing", "the priciest": the whole menu, drinks too
      const literal = u.superlative === "cheapest" || u.superlative === "priciest";
      const picks = (wantsDrinks || literal || u.signatures ? order : [...order.filter((i) => !isDrink(i)), ...order.filter(isDrink).slice(0, 1)]).slice(0, Math.min(4, u.howMany ?? 4));
      const filters = filterWords();
      const signatures = picks.filter((p) => p.isSignature);
      const intro = spiced.mildest
        ? t("assistantReply.mildestInstead")
        : filters
        ? t("assistantReply.suggestFiltered", { filters })
        : u.superlative
          ? t(`assistantReply.${u.superlative}Intro` as MessageKey)
          : u.categories.length || (u.courses.length && u.courses[0] !== "food")
            ? t("assistantReply.courseIntro")
            : t("assistantReply.knownFor", { restaurant: ctx.restaurant.name, list: list((signatures.length ? signatures : picks.slice(0, 1)).map(name)) });
      return reply("recommend", `${intro}${sp}${picks.map(line).join(t("assistantReply.itemSep"))}${stop}`, picks, { confident: !unsure || hasFilters });
    }
  }
}

const allyNote = (locale: string) => allergyNote(locale);
