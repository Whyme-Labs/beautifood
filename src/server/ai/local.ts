// The first, regex-based menu assistant, kept as the allergen vocabulary (mentionedAllergens), the
// guard on model answers, and the on-device lab's baseline. Guests are answered by the menu brain
// (./brain), which builds on it. Every fact comes from structured menu data, never invention.
import { ALLERGEN_LABELS, ALLERGENS, type Allergen } from "../../shared/allergens";
import type { Menu, MenuItem } from "../../shared/types";
import type { Clock, PriceRule, TimedMenu } from "../../shared/schedule";
import { localizeItem } from "../../shared/menuI18n";
import { formatters, translator, type MessageKey } from "../../i18n/core";
import type { PlatformPairs } from "./brain/concepts";
import type { OrderReading } from "./brain/reading";
import type { Halal } from "./halal";

export interface AssistantContext {
  restaurant: { name: string; cuisine: string; story: string; description: string };
  branchName: string;
  currency: string;
  items: (MenuItem & { category?: string; popularity?: number })[];
  /** What's on now: the timed menus and deals running, and when the others start (schedule.menuNow). */
  now?: Menu["now"];
  /** The timed menus at this branch (Breakfast, Happy hour bites, Durian season…). */
  menus?: TimedMenu[];
  /** The branch-local time the menu was read at (what NOW tells a model). */
  clock?: Clock;
  /** The price rules (deals) at this branch, on now or not. */
  rules?: PriceRule[];
  /** The menu's own language (dish names as written). */
  menuLanguage?: string;
  /** Recent orders: how many held each dish, how many held each pair, and how many there were. */
  orderCounts?: Record<string, number>;
  together?: Record<string, Record<string, number>>;
  totalOrders?: number;
  /** What guests order together across every restaurant, by dish concept. */
  platform?: PlatformPairs;
  /** From the assistant's own log: how often each dish was shown in the chat, and added from it. */
  chatShown?: Record<string, number>;
  chatAdded?: Record<string, number>;
  /** What the till adds to a bill at this branch (BranchConfig): service charge, tax, cash rounding. */
  charges?: { serviceChargePct: number; taxPct: number; taxInclusive: boolean; cashRounding: number };
  /** The branch's halal standing (certified by whom, Muslim-friendly, pork-free, or nothing declared). */
  halal?: Halal;
  /**
   * The latest message as a model read it (./brain/modelReader), checked against the menu, and how
   * the brain uses it for this turn's order lines: "replace" the rules' lines, "fill" only where the
   * rules found fewer dishes, or "merge" (the rules' dishes, with the model's counts and add-ons where
   * it read more of them). Absent: the rules read alone.
   */
  reading?: OrderReading;
  readerPolicy?: "replace" | "fill" | "merge";
}

export interface AssistantReply {
  answer: string;
  items: { id: string; name: string; price: number; reason?: string; /** The dish name in the guest's language. */ label?: string }[];
  safetyNote?: string;
  engine: "local" | "claude" | "model";
  /** When Qloo shaped the picks: whose fans' tastes, through which tags. */
  taste?: { liked: string; because: string[]; source: "Qloo" };
  /**
   * The rules engine's own view of its answer: false when it fell back to a generic reply or the
   * question is conversational (a comparison, a pairing, "those", "something light"), which a
   * language model answers better.
   */
  confident?: boolean;
}

/** Asks the rules engine can't really answer: comparisons, pairings, groups, moods, follow-ups. */
export const CONVERSATIONAL =
  /difference|compare|\bvs\.?\b|versus|\bbetter\b|go(es)? (well )?with|pair|\bshare\b|people|\bgroup\b|light|heavy|hungry|\bfull\b|which (of|one)|\bthose\b|\bthat one\b|cheapest|most expensive|instead|similar|like the|区别|比较|搭配|配什么|几个人|分享|清淡|不饿|哪个|那些|最便宜|beza|sesuai dengan|kongsi|ringan/i;

export const allergyNote = (locale = "en") => translator(locale)("assistantReply.safety");
export const ALLERGY_NOTE = allergyNote();

const ALLERGEN_WORDS: Record<Allergen, RegExp> = {
  gluten: /gluten|wheat|coeliac|celiac/i,
  crustaceans: /shellfish|crustacean|prawn|shrimp|crab|lobster|crayfish|langoustine|krill|belacan|shrimp paste/i,
  // "shellfish" is both: a shellfish allergy can be to prawns or to oysters and clams
  molluscs: /shellfish|mollusc|mollusk|squid|clam|oyster|mussel|scallop|octopus|cuttlefish|cockle|abalone|whelk|snail|escargot|geoduck/i,
  fish: /\bfish\b|seafood|anchov|\bbilis\b|salmon|\btuna\b|mackerel|sardine|bonito|\bcod\b|\beel\b|tilapia|grouper|seabass|sea bass/i,
  egg: /\beggs?\b/i,
  milk: /milk|dairy|lactose|cheese|cream/i,
  peanuts: /peanut/i,
  tree_nuts: /tree ?nut|\bnuts?\b|almond|cashew|walnut|hazelnut|pistachio/i,
  soy: /\bsoy|soya|tofu|\bnatto\b|edamame|\bmiso\b|tempeh/i,
  sesame: /sesame/i,
  celery: /celery/i,
  mustard: /mustard/i,
  sulphites: /sulphite|sulfite/i,
  lupin: /lupin/i,
};

// Malay (and Manglish) words for the common ones. "kacang" alone is beans or nuts (ais kacang has
// red beans), so it only counts as an allergen when the guest says they're allergic.
const ALLERGEN_WORDS_MS: Partial<Record<Allergen, RegExp>> = {
  gluten: /\b(gandum|tepung gandum)\b/i,
  crustaceans: /\b(udang|ketam|makanan laut)\b/i,
  molluscs: /\b(sotong|kerang|siput|lala|tiram|makanan laut)\b/i,
  fish: /\bikan\b|makanan laut/i,
  egg: /\btelur\b/i,
  milk: /\bsusu\b|\btenusu\b/i,
  peanuts: /\bkacang tanah\b/i,
  sesame: /\bbijan\b/i,
  soy: /\bkacang soya\b|\btauhu\b/i,
};

// The same, for questions asked in Chinese (no word boundaries in CJK).
const ALLERGEN_WORDS_ZH: Partial<Record<Allergen, RegExp>> = {
  gluten: /麸质|麦|乳糜泻|腹腔病/,
  crustaceans: /虾|蟹|甲壳|海鲜/,
  molluscs: /鱿鱼|蚝|贝|蛤|软体|海鲜/,
  fish: /鱼|海鲜/,
  egg: /蛋/,
  // 乳 is milk, but not in 乳糜泻 (coeliac disease)
  milk: /奶|乳(?!\s*糜)/,
  peanuts: /花生/,
  tree_nuts: /坚果|果仁|腰果|杏仁|核桃/,
  soy: /大豆|黄豆|豆腐|酱油|纳豆|毛豆|味噌/,
  sesame: /芝麻/,
  celery: /芹菜/,
  mustard: /芥末/,
};

/** The guest's own Chinese word for allergen `a` in `q` ("虾", "蛋", "花生"), if they used one. */
export const zhAllergenWord = (q: string, a: Allergen) => ALLERGEN_WORDS_ZH[a]?.exec(q)?.[0];

export function mentionedAllergens(q: string): Allergen[] {
  const found = ALLERGENS.filter((a) => ALLERGEN_WORDS[a].test(q) || ALLERGEN_WORDS_ZH[a]?.test(q) || ALLERGEN_WORDS_MS[a]?.test(q));
  // "saya alergi kacang": allergic to nuts, so peanuts and tree nuts both
  if (/alergi|allerg|\balah\b|alahan/i.test(q) && /\bkacang\b/i.test(q)) for (const a of ["peanuts", "tree_nuts"] as Allergen[]) if (!found.includes(a)) found.push(a);
  // "nuts" alone should cover peanuts too
  if (found.includes("tree_nuts") && /\bnuts?\b/i.test(q) && !found.includes("peanuts")) found.push("peanuts");
  if (/seafood/i.test(q)) for (const a of ["crustaceans", "molluscs"] as Allergen[]) if (!found.includes(a)) found.push(a);
  return found;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Best fuzzy match of a dish named in the question. */
export function findItem(items: AssistantContext["items"], q: string) {
  const nq = ` ${norm(q)} `;
  let best: { item: AssistantContext["items"][number]; score: number } | null = null;
  for (const it of items) {
    // a translated name (e.g. 炒粿条) appearing anywhere in the question is a full match
    if (Object.values(it.translations ?? {}).some((tr) => tr?.name && tr.name.length > 1 && q.includes(tr.name))) return it;
    const words = norm(it.name).split(" ").filter((w) => w.length > 2);
    if (!words.length) continue;
    const hits = words.filter((w) => nq.includes(` ${w} `) || nq.includes(` ${w}s `)).length;
    const score = nq.includes(` ${norm(it.name)} `) ? 100 : hits / words.length;
    if (score >= 0.5 && (!best || score > best.score)) best = { item: it, score };
  }
  return best?.item ?? null;
}

const brief = (i: MenuItem, reason?: string) => ({ id: i.id, name: i.name, price: i.price, reason });

function budgetOf(q: string): number | null {
  const m =
    q.match(/(?:under|below|less than|max(?:imum)?|budget(?: of)?|within)\s*(?:rm|\$|myr)?\s*(\d+(?:\.\d+)?)/i) ??
    q.match(/(?:rm|\$|myr)?\s*(\d+(?:\.\d+)?)\s*(?:块|令吉|元|ringgit)?\s*(?:以下|以内|之内)/i);
  return m ? Math.round(parseFloat(m[1]) * 100) : null;
}

/**
 * Answer from menu data alone, in the guest's language. Dish names are shown in that
 * language when the menu has a translation; `items` keep the original names for ordering.
 */
export function answerLocally(ctx: AssistantContext, question: string, locale = "en"): AssistantReply {
  const r = rulesAnswer(ctx, question, locale);
  return { ...r, confident: r.confident !== false && !CONVERSATIONAL.test(question) };
}

function rulesAnswer(ctx: AssistantContext, question: string, locale: string): AssistantReply {
  const t = translator(locale);
  const f = formatters(locale);
  const money = (n: number) => f.money(n, ctx.currency);
  const dish = (i: MenuItem) => localizeItem(i, locale, ctx.menuLanguage ?? "en");
  const allergen = (a: string) => {
    if (locale === "en") return ALLERGEN_LABELS[a as Allergen] ?? a;
    const key = `allergens.${a}` as MessageKey;
    return t(key) === key ? a : t(key);
  };
  const list = (xs: string[]) => xs.join(t("assistantReply.listSep"));
  const note = allergyNote(locale);

  const q = question.trim();
  const items = ctx.items.filter((i) => i.active && !i.soldOut && i.servedNow !== false);
  const allergens = mentionedAllergens(q);
  const wantsVegan = /vegan|plant[- ]based|纯素|全素/i.test(q);
  const wantsVeg = /vegetarian|veggie|no meat|meatless|sayur(an)?|tak makan daging|素|斋/i.test(q);
  const wantsHalal = /halal|no pork|tak makan babi|tiada babi|清真|无猪|没有猪/i.test(q);
  const notSpicy = /(not|non|no|less|mild|without)[- ]?(spic|pedas)|can'?t (take|handle) (spice|chil+i|pedas)|\b(tak|tidak|x|kurang|bukan|tak nak|tanpa)[- ]?pedas|kid|budak|anak|不辣|不要辣|不吃辣|小孩|孩子/i.test(q);
  const wantsSpicy = !notSpicy && /spicy|hot\b|chil+i|pedas|辣/i.test(q);
  const budget = budgetOf(q);
  // "saya alergi kacang" names an allergen, not the dish Ais Kacang
  const item = findItem(ctx.items, q.replace(/\b(alergi|allergic to|allergy to|allergic)\s+\S+/gi, " "));

  // 1. allergen question about a specific dish
  if (item && (allergens.length || /allerg|alergi|contain|ingredient|safe for|ada .* tak|boleh makan|过敏|含有|含不含|有没有|成分|可以吃/i.test(q))) {
    const conflict = allergens.filter((a) => item.allergens.includes(a));
    const name = dish(item).name;
    let answer = item.allergens.length ? t("assistantReply.contains", { dish: name, list: list(item.allergens.map(allergen)) }) : t("assistantReply.noAllergens", { dish: name });
    if (allergens.length)
      answer += conflict.length
        ? t("assistantReply.notSuitable", { list: list(conflict.map(allergen)) })
        : t("assistantReply.doesntList", { list: list(allergens.map(allergen)) });
    return { answer, items: [brief(item)], safetyNote: note, engine: "local" };
  }

  // 2. story / description of a dish
  if (item && /story|history|origin|tell me (about|more)|what is|what's|describe|why|故事|历史|来历|是什么|介绍|为什么/i.test(q)) {
    const d = dish(item);
    const parts = [d.story || d.description || t("assistantReply.oneOf", { dish: d.name, category: item.category ?? t("assistantReply.dishes") })];
    if (item.isSignature && !/signature|招牌/i.test(parts[0])) parts.push(t("assistantReply.isSignature", { restaurant: ctx.restaurant.name }));
    parts.push(`${money(item.price)}.`);
    return { answer: parts.join(locale === "en" ? " " : ""), items: [brief(item)], engine: "local" };
  }

  // 3. filtered recommendations (allergens, diet, spice, budget)
  let pool = items;
  const filters: string[] = [];
  if (allergens.length) {
    pool = pool.filter((i) => !allergens.some((a) => i.allergens.includes(a)));
    const names = allergens.map((a) => (locale === "en" ? ALLERGEN_LABELS[a].split(" (")[0].toLowerCase() : allergen(a)));
    filters.push(t("assistantReply.freeOf", { list: names.join(t("assistantReply.and")) }));
  }
  if (wantsVegan) {
    pool = pool.filter((i) => i.dietary.includes("vegan"));
    filters.push(t("assistantReply.vegan"));
  } else if (wantsVeg) {
    pool = pool.filter((i) => i.dietary.includes("vegetarian") || i.dietary.includes("vegan"));
    filters.push(t("assistantReply.vegetarian"));
  }
  if (wantsHalal) {
    pool = pool.filter((i) => i.dietary.includes("halal") || i.dietary.includes("halal_friendly"));
    filters.push(t("assistantReply.halal"));
  }
  if (notSpicy) {
    pool = pool.filter((i) => i.spiceLevel === 0);
    filters.push(t("assistantReply.notSpicy"));
  } else if (wantsSpicy) {
    pool = pool.filter((i) => i.spiceLevel > 0).sort((a, b) => b.spiceLevel - a.spiceLevel);
    filters.push(t("assistantReply.spicy"));
  }
  if (budget) {
    pool = pool.filter((i) => i.price <= budget);
    filters.push(t("assistantReply.under", { price: money(budget) }));
  }

  const signatureAsk = /signature|famous|known for|best|must[- ]try|special|recommend|suggest|what should i (eat|order|get|try)|popular|first time|sedap|syok|cadang|apa yang best|招牌|推荐|好吃|必吃|人气|有名|第一次|吃什么|点什么/i.test(q);
  const rank = (a: (typeof items)[number], b: (typeof items)[number]) =>
    Number(b.isSignature) - Number(a.isSignature) || (b.popularity ?? 0) - (a.popularity ?? 0) || a.sort - b.sort;
  const filterText = filters.join(t("assistantReply.filterSep"));

  if (filters.length || signatureAsk) {
    const picks = [...pool].sort(rank).slice(0, 4);
    if (!picks.length)
      return {
        answer: t("assistantReply.noneFound", { filters: filterText }),
        items: [],
        safetyNote: allergens.length ? note : undefined,
        engine: "local",
      };
    const intro = filters.length
      ? t("assistantReply.suggestFiltered", { filters: filterText })
      : t("assistantReply.knownFor", { restaurant: ctx.restaurant.name, list: list(picks.filter((p) => p.isSignature).map((p) => dish(p).name)) || dish(picks[0]).name });
    const reason = (i: (typeof picks)[number]) =>
      [
        i.isSignature ? t("assistantReply.signature") : (i.popularity ?? 0) > 0 ? t("assistantReply.popularToday") : "",
        i.spiceLevel ? t("diet.spicy", { count: i.spiceLevel }) : "",
        i.dietary.includes("vegetarian") ? t("assistantReply.vegetarian") : "",
      ]
        .filter(Boolean)
        .join(" · ");
    const sep = locale === "en" ? " " : "";
    return {
      answer: `${intro}${sep}${picks.map((p) => `${dish(p).name} (${money(p.price)})`).join(t("assistantReply.itemSep"))}${locale === "en" ? "." : "。"}`,
      items: picks.map((p) => brief(p, reason(p) || undefined)),
      safetyNote: allergens.length ? note : undefined,
      engine: "local",
    };
  }

  // 4. a dish was named without a clear intent: describe it
  if (item) {
    const d = dish(item);
    const al = item.allergens.length ? t("assistantReply.allergensLabel", { list: list(item.allergens.map(allergen)) }) : "";
    return { answer: `${d.name} — ${d.description || d.story || t("assistantReply.favourite")}. ${money(item.price)}.${al}`, items: [brief(item)], safetyNote: al ? note : undefined, engine: "local", confident: false };
  }

  // 5. about the restaurant
  if (/about|story|who are|restaurant|place|cuisine|history|餐厅|关于|故事|历史|你们/i.test(q)) {
    return {
      answer: ctx.restaurant.story || ctx.restaurant.description || t("assistantReply.serves", { restaurant: ctx.restaurant.name, cuisine: ctx.restaurant.cuisine || t("assistantReply.deliciousFood"), branch: ctx.branchName }),
      items: [],
      engine: "local",
    };
  }

  const sig = [...items].sort(rank).slice(0, 3);
  return {
    answer: t("assistantReply.help", { list: list(sig.map((s) => dish(s).name)) }),
    items: sig.map((s) => brief(s)),
    engine: "local",
    confident: false,
  };
}

/**
 * A model's answer to a guest who named an allergen: it may not mention or show a dish with that
 * allergen (other than the one they asked about), and it always carries the safety note.
 */
export function guard(ctx: AssistantContext, question: string, r: AssistantReply, safe: AssistantReply, locale: string): AssistantReply {
  const allergens = mentionedAllergens(question);
  if (!allergens.length) return r;
  const asked = findItem(ctx.items, question.replace(/\b(alergi|allergic to|allergy to|allergic)\s+\S+/gi, " "));
  const text = r.answer.toLowerCase();
  const shown = ctx.items.filter((i) => r.items.some((x) => x.id === i.id) || text.includes(i.name.toLowerCase()));
  if (shown.some((i) => i.id !== asked?.id && i.allergens.some((a) => allergens.includes(a as Allergen)))) return safe;
  return { ...r, safetyNote: allergyNote(locale) };
}
