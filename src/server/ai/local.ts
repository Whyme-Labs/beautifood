// Deterministic, offline menu assistant. Used when no LLM key is configured and
// as the grounding layer for the LLM path: every fact comes from structured
// menu data, never invention. Allergen answers always carry a safety note.
import { ALLERGEN_LABELS, ALLERGENS, type Allergen } from "../../shared/allergens";
import { formatMoney } from "../../shared/format";
import type { MenuItem } from "../../shared/types";

export interface AssistantContext {
  restaurant: { name: string; cuisine: string; story: string; description: string };
  branchName: string;
  currency: string;
  items: (MenuItem & { category?: string; popularity?: number })[];
}

export interface AssistantReply {
  answer: string;
  items: { id: string; name: string; price: number; reason?: string }[];
  safetyNote?: string;
  engine: "local" | "claude";
}

export const ALLERGY_NOTE =
  "Allergen information comes from the restaurant's menu data. Kitchens handle many ingredients, so if you have a severe allergy please confirm with staff before ordering.";

const ALLERGEN_WORDS: Record<Allergen, RegExp> = {
  gluten: /gluten|wheat|coeliac|celiac/i,
  crustaceans: /shellfish|crustacean|prawn|shrimp|crab|lobster/i,
  molluscs: /mollusc|mollusk|squid|clam|oyster|mussel|scallop/i,
  fish: /\bfish\b|seafood/i,
  egg: /\beggs?\b/i,
  milk: /milk|dairy|lactose|cheese|cream/i,
  peanuts: /peanut/i,
  tree_nuts: /tree ?nut|\bnuts?\b|almond|cashew|walnut|hazelnut|pistachio/i,
  soy: /\bsoy|soya|tofu/i,
  sesame: /sesame/i,
  celery: /celery/i,
  mustard: /mustard/i,
  sulphites: /sulphite|sulfite/i,
  lupin: /lupin/i,
};

export function mentionedAllergens(q: string): Allergen[] {
  const found = ALLERGENS.filter((a) => ALLERGEN_WORDS[a].test(q));
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
    const words = norm(it.name).split(" ").filter((w) => w.length > 2);
    if (!words.length) continue;
    const hits = words.filter((w) => nq.includes(` ${w} `) || nq.includes(` ${w}s `)).length;
    const score = nq.includes(` ${norm(it.name)} `) ? 100 : hits / words.length;
    if (score >= 0.5 && (!best || score > best.score)) best = { item: it, score };
  }
  return best?.item ?? null;
}

const money = (ctx: AssistantContext, n: number) => formatMoney(n, ctx.currency);
const brief = (ctx: AssistantContext, i: MenuItem, reason?: string) => ({ id: i.id, name: i.name, price: i.price, reason });

function budgetOf(q: string): number | null {
  const m = q.match(/(?:under|below|less than|max(?:imum)?|budget(?: of)?|within)\s*(?:rm|\$|myr)?\s*(\d+(?:\.\d+)?)/i);
  return m ? Math.round(parseFloat(m[1]) * 100) : null;
}

export function answerLocally(ctx: AssistantContext, question: string): AssistantReply {
  const q = question.trim();
  const items = ctx.items.filter((i) => i.active && !i.soldOut);
  const allergens = mentionedAllergens(q);
  const wantsVeg = /vegetarian|veggie|no meat|meatless/i.test(q);
  const wantsVegan = /vegan|plant[- ]based/i.test(q);
  const wantsHalal = /halal|no pork/i.test(q);
  const notSpicy = /(not|non|no|less|mild|without)[- ]?spic|can'?t (take|handle) (spice|chil+i)|kid/i.test(q);
  const wantsSpicy = !notSpicy && /spicy|hot\b|chil+i|pedas/i.test(q);
  const budget = budgetOf(q);
  const item = findItem(ctx.items, q);

  // 1. allergen question about a specific dish
  if (item && (allergens.length || /allerg|contain|ingredient|safe for/i.test(q))) {
    const labels = item.allergens.map((a) => ALLERGEN_LABELS[a as Allergen] ?? a);
    const conflict = allergens.filter((a) => item.allergens.includes(a));
    let answer = labels.length ? `${item.name} contains: ${labels.join(", ")}.` : `${item.name} has no listed allergens.`;
    if (allergens.length) answer += conflict.length ? ` So it is NOT suitable if you avoid ${conflict.map((a) => ALLERGEN_LABELS[a]).join(", ")}.` : ` It doesn't list ${allergens.map((a) => ALLERGEN_LABELS[a]).join(", ")}.`;
    return { answer, items: [brief(ctx, item)], safetyNote: ALLERGY_NOTE, engine: "local" };
  }

  // 2. story / description of a dish
  if (item && /story|history|origin|tell me (about|more)|what is|what's|describe|why/i.test(q)) {
    const parts = [item.story || item.description || `${item.name} is one of our ${item.category ?? "dishes"}.`];
    if (item.isSignature && !/signature/i.test(parts[0])) parts.push(`It's one of ${ctx.restaurant.name}'s signatures.`);
    parts.push(`${money(ctx, item.price)}.`);
    return { answer: parts.join(" "), items: [brief(ctx, item)], engine: "local" };
  }

  // 3. filtered recommendations (allergens, diet, spice, budget)
  let pool = items;
  const filters: string[] = [];
  if (allergens.length) {
    pool = pool.filter((i) => !allergens.some((a) => i.allergens.includes(a)));
    filters.push(`free of ${allergens.map((a) => ALLERGEN_LABELS[a].split(" (")[0].toLowerCase()).join(" and ")}`);
  }
  if (wantsVegan) {
    pool = pool.filter((i) => i.dietary.includes("vegan"));
    filters.push("vegan");
  } else if (wantsVeg) {
    pool = pool.filter((i) => i.dietary.includes("vegetarian") || i.dietary.includes("vegan"));
    filters.push("vegetarian");
  }
  if (wantsHalal) {
    pool = pool.filter((i) => i.dietary.includes("halal") || i.dietary.includes("halal_friendly"));
    filters.push("halal-friendly");
  }
  if (notSpicy) {
    pool = pool.filter((i) => i.spiceLevel === 0);
    filters.push("not spicy");
  } else if (wantsSpicy) {
    pool = pool.filter((i) => i.spiceLevel > 0).sort((a, b) => b.spiceLevel - a.spiceLevel);
    filters.push("spicy");
  }
  if (budget) {
    pool = pool.filter((i) => i.price <= budget);
    filters.push(`under ${money(ctx, budget)}`);
  }

  const signatureAsk = /signature|famous|known for|best|must[- ]try|special|recommend|suggest|what should i (eat|order|get|try)|popular|first time/i.test(q);
  const rank = (a: (typeof items)[number], b: (typeof items)[number]) =>
    Number(b.isSignature) - Number(a.isSignature) || (b.popularity ?? 0) - (a.popularity ?? 0) || a.sort - b.sort;

  if (filters.length || signatureAsk) {
    const picks = [...pool].sort(rank).slice(0, 4);
    if (!picks.length)
      return {
        answer: `I couldn't find dishes that are ${filters.join(", ")} on today's menu. Our staff may be able to adapt a dish for you.`,
        items: [],
        safetyNote: allergens.length ? ALLERGY_NOTE : undefined,
        engine: "local",
      };
    const intro = filters.length
      ? `Here's what I'd suggest that's ${filters.join(", ")}:`
      : `${ctx.restaurant.name} is known for ${picks.filter((p) => p.isSignature).map((p) => p.name).join(", ") || picks[0].name}. My picks:`;
    const reason = (i: (typeof picks)[number]) =>
      [i.isSignature ? "signature" : (i.popularity ?? 0) > 0 ? "popular today" : "", i.spiceLevel ? "🌶".repeat(i.spiceLevel) : "", i.dietary.includes("vegetarian") ? "vegetarian" : ""].filter(Boolean).join(" · ");
    return {
      answer: `${intro} ${picks.map((p) => `${p.name} (${money(ctx, p.price)})`).join("; ")}.`,
      items: picks.map((p) => brief(ctx, p, reason(p) || undefined)),
      safetyNote: allergens.length ? ALLERGY_NOTE : undefined,
      engine: "local",
    };
  }

  // 4. a dish was named without a clear intent: describe it
  if (item) {
    const al = item.allergens.length ? ` Allergens: ${item.allergens.map((a) => ALLERGEN_LABELS[a as Allergen] ?? a).join(", ")}.` : "";
    return { answer: `${item.name} — ${item.description || item.story || "a favourite here"}. ${money(ctx, item.price)}.${al}`, items: [brief(ctx, item)], safetyNote: al ? ALLERGY_NOTE : undefined, engine: "local" };
  }

  // 5. about the restaurant
  if (/about|story|who are|restaurant|place|cuisine|history/i.test(q)) {
    return {
      answer: ctx.restaurant.story || ctx.restaurant.description || `${ctx.restaurant.name} serves ${ctx.restaurant.cuisine || "delicious food"} at ${ctx.branchName}.`,
      items: [],
      engine: "local",
    };
  }

  const sig = [...items].sort(rank).slice(0, 3);
  return {
    answer: `I can help you choose! Ask me things like "what are your signatures?", "anything vegetarian under RM20?", "is the laksa nut-free?" or "tell me the story of a dish". To start, our favourites are ${sig.map((s) => s.name).join(", ")}.`,
    items: sig.map((s) => brief(ctx, s)),
    engine: "local",
  };
}
