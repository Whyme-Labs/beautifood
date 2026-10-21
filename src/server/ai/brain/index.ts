// The menu brain: the guest assistant that runs on our own Worker at no cost. It understands the
// question (./understand), remembers the conversation (constraints the guest set earlier, the
// dishes it just showed), decides what to do, picks dishes from the restaurant's data (signatures,
// what guests order, what they order together) and writes the answer from templates, so every
// dish, price and allergen it states comes from the menu.
import { ALLERGEN_LABELS, type Allergen } from "../../../shared/allergens";
import { localizeItem } from "../../../shared/menuI18n";
import type { MenuItem } from "../../../shared/types";
import { formatters, translator, type MessageKey } from "../../../i18n/core";
import { normalize } from "../../../shared/brain/text";
import type { Intent } from "../../../shared/brain/intentModel";
import { allergyNote, type AssistantContext, type AssistantReply } from "../local";
import { conceptsOf, dishConceptLift, type ConceptId } from "./concepts";
import { courseDishes, isDessert, isDrink, read, understand, type Course, type Diet, type Dish, type Understanding } from "./understand";

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
  const s: DialogueState = { avoid: [], diet: [], maxSpice: null, shown: [], focus: null };
  for (const h of history) {
    if (h.role === "user") {
      const u = read(ctx.items as Dish[], h.content);
      s.avoid = [...new Set([...s.avoid, ...u.avoid])];
      s.diet = [...new Set([...s.diet, ...u.diet])];
      if (u.maxSpice !== null) s.maxSpice = u.maxSpice;
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
}

function allowed(i: Item, c: Constraints) {
  if (c.avoid.some((a) => i.allergens.includes(a))) return false;
  if (c.diet.includes("vegan") && !i.dietary.includes("vegan")) return false;
  if (c.diet.includes("vegetarian") && !i.dietary.includes("vegetarian") && !i.dietary.includes("vegan")) return false;
  if (c.diet.includes("halal") && !i.dietary.includes("halal") && !i.dietary.includes("halal_friendly")) return false;
  if (c.maxSpice !== null && i.spiceLevel > c.maxSpice) return false;
  if (c.minSpice !== null && i.spiceLevel < c.minSpice) return false;
  if (c.budget !== null && i.price > c.budget) return false;
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

// ---- answering ----

export function answerGuest(ctx: AssistantContext, history: { role: "user" | "assistant"; content: string }[], locale = "en"): BrainReply {
  const question = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const earlier = history.slice(0, history.map((h) => h.content).lastIndexOf(question));
  const state = dialogueState(ctx, earlier);
  const u = understand(ctx.items as Dish[], question);
  return { ...respond(ctx, u, state, locale), confidence: u.confidence, delexicalized: u.delexicalized.join(" ") };
}

export function respond(ctx: AssistantContext, u: Understanding, state: DialogueState, locale: string): BrainReply {
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
  const line = (i: Item) => `${name(i)} (${money(i.price)})`;

  const live = ctx.items.filter((i) => i.active && !i.soldOut && i.servedNow !== false);
  const mentioned = u.dishes.map((d) => ctx.items.find((i) => i.id === d.id)!).filter(Boolean);
  const avoid = [...new Set([...state.avoid, ...u.avoid])];
  const c: Constraints = {
    avoid,
    diet: [...new Set([...state.diet, ...u.diet])],
    maxSpice: u.minSpice !== null ? null : (u.maxSpice ?? state.maxSpice),
    minSpice: u.minSpice,
    budget: u.budget,
  };
  const safety = avoid.length || u.allergens.length ? allyNote(locale) : undefined;
  const reply = (intent: Intent, answer: string, items: Item[], extra: Partial<AssistantReply> = {}): BrainReply => ({
    answer,
    items: items.slice(0, 6).map((i) => brief(i, reasonFor(i))),
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
    if (avoid.length) w.push(t("assistantReply.freeOf", { list: avoid.map((a) => (en ? ALLERGEN_LABELS[a].split(" (")[0].toLowerCase() : allergen(a))).join(t("assistantReply.and")) }));
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
  const focus = mentioned.length ? mentioned : u.refersBack && state.focus ? [state.focus] : [];

  // ---- decide ----
  let intent = u.intent;
  const unsure = u.confidence < 0.4;
  const hasFilters = !!(u.avoid.length || u.diet.length || u.maxSpice !== null || u.minSpice !== null || u.budget !== null || u.courses.length || u.appetite);
  // safety first: a dish and an allergen (or "is it safe", "does it contain") is a question about that dish
  if (focus.length && (u.allergens.length || u.asksContents) && !["compare", "pairing", "group"].includes(intent)) intent = "dish_allergen";
  if (intent === "compare" && focus.length + (mentioned.length ? 0 : state.shown.length) < 2) intent = focus.length ? "dish_info" : "recommend";
  if (intent === "pairing" && !focus.length) intent = state.focus && !mentioned.length ? "pairing" : "recommend";
  if ((intent === "dish_allergen" || intent === "dish_info") && !focus.length) intent = state.focus && u.refersBack ? intent : "recommend";
  if (intent === "refine" && !state.shown.length) intent = "recommend";
  if (u.superlative && state.shown.length && u.refersBack && intent !== "compare") intent = "refine";
  if (u.party && intent !== "dish_allergen") intent = "group";
  if (unsure && !["greeting", "thanks"].includes(intent)) intent = focus.length && !hasFilters ? "dish_info" : hasFilters || u.superlative ? "recommend" : intent;
  if ((intent === "out_of_scope" || intent === "about" || intent === "greeting") && hasFilters) intent = "recommend";

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
    if (!courses.length) return pool;
    const ids = new Set(courses.flatMap((k) => courseDishes(ctx.items as Dish[], k).map((d) => d.id)));
    return ids.size ? pool.filter((i) => ids.has(i.id)) : pool;
  };
  const none = () => reply(intent, t("assistantReply.noneFound", { filters: filterWords() || t("assistantReply.whatYouAsked") }), []);

  switch (intent) {
    case "greeting":
    case "out_of_scope":
    case "order_help": {
      const sig = ranked(live).slice(0, 3);
      const ordering = /\b(order|cart|add|pesan|checkout|send)\b/.test(normalize(u.delexicalized.join(" "))) || /点餐|下单|加单/.test(u.delexicalized.join(""));
      const key = intent === "greeting" ? "assistantReply.help" : intent === "order_help" ? (ordering ? "assistantReply.orderHelp" : "assistantReply.staffHelp") : "assistantReply.outOfScope";
      return reply(intent, t(key, { list: list(sig.map(name)) }), intent === "order_help" ? [] : sig, { confident: intent !== "out_of_scope" });
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
        if (!asked.length && desc(item)) s += `${sp}${t("assistantReply.madeWith", { description: desc(item) })}`;
        return s;
      });
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
      let pool = live.filter((i) => !anchors.includes(i) && allowed(i, c));
      if (wanted.length) pool = byCourse(pool, wanted);
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
      const total = u.budget === null ? u.amount : null;
      const pool = ranked(live.filter((i) => !isDrink(i) && allowed(i, { ...c, budget: u.budget })));
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
      let pool = state.shown.filter((i) => allowed(i, c));
      pool = byCourse(pool, u.courses);
      if (!pool.length) return none();
      const s = u.superlative;
      if (s) {
        const top = sorted(pool, s)[0];
        const key = `assistantReply.${s}Of` as MessageKey;
        return reply(intent, t(key, { dish: name(top), price: money(top.price), level: top.spiceLevel }), [top]);
      }
      const picks = ranked(pool).slice(0, 4);
      return reply(intent, `${t("assistantReply.ofThose", { filters: filterWords() || t("assistantReply.whatYouAsked") })}${sp}${picks.map(line).join(t("assistantReply.itemSep"))}${stop}`, picks);
    }

    case "recommend":
    default: {
      let pool = live.filter((i) => allowed(i, c));
      pool = byCourse(pool, u.courses);
      if (u.appetite === "light" && !u.courses.length) {
        const food = pool.filter((i) => !isDrink(i));
        const median = [...food].map((i) => i.price).sort((a, b) => a - b)[Math.floor(food.length / 2)] ?? Infinity;
        const light = food.filter((i) => heaviness(i) <= 0.5 && i.price <= median * 1.15);
        pool = (light.length ? light : food).sort((a, b) => heaviness(a) - heaviness(b) || a.price - b.price);
        const picks = pool.slice(0, 3);
        if (!picks.length) return none();
        return reply("recommend", `${t("assistantReply.lightPicks")}${sp}${picks.map(line).join(t("assistantReply.itemSep"))}${stop}`, picks);
      }
      if (u.appetite === "hearty" && !u.courses.length) pool = pool.filter((i) => !isDrink(i) && !isDessert(i)).sort((a, b) => heaviness(b) - heaviness(a) || baseScore(b, ctx) - baseScore(a, ctx));
      if (!pool.length) return none();
      const picks = (u.superlative ? sorted(pool, u.superlative) : u.appetite === "hearty" ? pool : ranked(pool)).slice(0, 4);
      const filters = filterWords();
      const signatures = picks.filter((p) => p.isSignature);
      const intro = filters
        ? t("assistantReply.suggestFiltered", { filters })
        : u.superlative
          ? t(`assistantReply.${u.superlative}Intro` as MessageKey)
          : u.courses.length && u.courses[0] !== "food"
            ? t("assistantReply.courseIntro")
            : t("assistantReply.knownFor", { restaurant: ctx.restaurant.name, list: list((signatures.length ? signatures : picks.slice(0, 1)).map(name)) });
      return reply("recommend", `${intro}${sp}${picks.map(line).join(t("assistantReply.itemSep"))}${stop}`, picks, { confident: !unsure || hasFilters });
    }
  }
}

const allyNote = (locale: string) => allergyNote(locale);
