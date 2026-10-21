// What a language model is given about a restaurant, in three layers ordered from most to least
// stable, because prompt caching is a prefix match (docs/ai-menu-input.md):
//
//   1. GUIDE: the instructions and the legend for the menu format. The same bytes for every
//      restaurant, branch and language, so one cached prefix serves the whole platform.
//   2. CATALOG: one branch's whole week: every dish (breakfast and supper alike), the timed and
//      seasonal menus, and the deal rules. It changes only when the merchant edits the menu, so
//      every guest of the branch, in every language, at any hour, reads the same cached prefix.
//      Rendered deterministically (fixed order, no clock), and `catalogKey` hashes it.
//   3. NOW: what's true at this moment: local time, the menus and deals on (with each dealt dish's
//      price now, so the model never does the arithmetic), what's sold out, the reply language.
//      A few dozen tokens, sent last.
//
// Compactness: a dish is one line, its codes defined once in the guide; categories are headers,
// not a column; prices are bare numbers in the branch currency; dishes are short refs (d1, d2…).
import { ALLERGENS, type Allergen } from "../../shared/allergens";
import { hash } from "../../shared/brain/text";
import type { PriceRule, TimedMenu, Window } from "../../shared/schedule";
import { localeInfo } from "../../i18n/core";
import type { AssistantContext } from "./local";

type Item = AssistantContext["items"][number];

/** Two-letter allergen codes, defined once in the guide. */
export const ALLERGEN_CODES: Record<Allergen, string> = {
  gluten: "gl", crustaceans: "cr", molluscs: "mo", fish: "fi", egg: "eg", milk: "mi", peanuts: "pe",
  tree_nuts: "tn", soy: "so", sesame: "se", celery: "ce", mustard: "mu", sulphites: "su", lupin: "lu",
};
const ALLERGEN_WORDS: Record<Allergen, string> = {
  gluten: "gluten (wheat, barley)", crustaceans: "crustaceans (prawn, shrimp paste, crab)", molluscs: "molluscs (squid, clams, oyster sauce)",
  fish: "fish (incl. fish sauce, anchovies)", egg: "egg", milk: "milk (dairy, butter, cream, ghee, condensed milk)", peanuts: "peanuts",
  tree_nuts: "tree nuts", soy: "soy (incl. soy sauce, tofu)", sesame: "sesame", celery: "celery", mustard: "mustard", sulphites: "sulphites", lupin: "lupin",
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Layer 1: the same for every restaurant and language. Bump the version when it changes. */
export const GUIDE_VERSION = 1;
export const GUIDE = `You are the menu assistant for one restaurant. Guests ask what to eat; you help them choose from this restaurant's menu only.

Rules:
- Only recommend dishes in the MENU below, by their exact names. Never invent a dish, price or ingredient.
- Allergens are exactly as listed for each dish. If a guest states an allergy or diet, never suggest a dish that conflicts with it, and say plainly when a dish they ask about does. If the data doesn't answer a question, say so and suggest asking staff.
- A dish on a timed or seasonal menu that isn't on NOW can't be ordered yet: say when it's served instead of recommending it.
- Prices: a dish's listed price, unless NOW gives it a deal price. Mention prices; with a deal, give the usual price too.
- Answer in 2–4 short sentences, warm and specific. Reply in the language NOW asks for, naming dishes as the menu does (the translated name first when the menu has one, the original in brackets the first time).

MENU format:
"@<id> <name>: <days> <HH:MM>-<HH:MM> [<YYYY-MM-DD>..<YYYY-MM-DD>]" is a timed or seasonal menu and when it's served (local time; a range past midnight runs into the next day; dates limit a season).
"%<id> <name>: <-N% | -N> on <categories or dish refs>: <days> <times> [dates]" is a deal rule.
"# <Category> [@<id>]" starts a category; its dishes are on that timed menu (none = served whenever the restaurant is open).
"<ref> <name>[ / <translated name>] | <price> | <codes> | <description>" is a dish, where codes are:
  * signature; v vegetarian; vg vegan; h halal-friendly; s1, s2, s3 spice (none = not spicy);
  allergens: ${ALLERGENS.map((a) => `${ALLERGEN_CODES[a]} ${ALLERGEN_WORDS[a]}`).join("; ")}.

NOW format (it comes last, and is the only part that says what time it is):
"time <Day> <HH:MM> <YYYY-MM-DD>; on @<ids>; deals %<id> until <HH:MM>: <ref> <price now>…; sold out <refs>; next @<id> <Day> <HH:MM>; reply in <language>".`;

const days = (d: number[]) => {
  const s = [...new Set(d)].sort((a, b) => a - b);
  if (s.length === 7) return "daily";
  if (s.join() === "1,2,3,4,5") return "Mon-Fri";
  if (s.join() === "0,6") return "Sat-Sun";
  return s.map((x) => DAYS[x]).join(",");
};
const windowText = (w: Window) => `${days(w.days)} ${w.from}-${w.to}${w.start || w.end ? ` ${w.start ?? ""}..${w.end ?? ""}` : ""}`;
const windowsText = (ws: Window[]) => ws.map(windowText).join("; ");

/** The menu's dishes in a fixed order (category, then the merchant's sort, then id), with their short refs. */
export function catalogRefs(ctx: AssistantContext): { refs: Map<string, string>; items: Item[] } {
  const items = ctx.items.filter((i) => i.active);
  // keep the merchant's category order: the first appearance of a category in sort order
  const order = new Map<string, number>();
  for (const i of [...ctx.items].sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))) if (!order.has(i.category ?? "")) order.set(i.category ?? "", order.size);
  items.sort((a, b) => (order.get(a.category ?? "")! - order.get(b.category ?? "")!) || a.sort - b.sort || a.id.localeCompare(b.id));
  return { refs: new Map(items.map((i, n) => [i.id, `d${n + 1}`])), items };
}

/** Short refs for timed menus and deals ("@1", "%1"), in a fixed order. */
const menuRefs = (menus: TimedMenu[]) => new Map([...menus].sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id)).map((m, n) => [m.id, `@${n + 1}`]));
const ruleRefs = (rules: PriceRule[]) => new Map([...rules].sort((a, b) => a.id.localeCompare(b.id)).map((r, n) => [r.id, `%${n + 1}`]));

const clean = (s: string, max: number) => s.replace(/\s+/g, " ").replace(/\|/g, "/").trim().slice(0, max);

/** Layer 2: one branch's whole menu, the same at every hour and for every guest. */
export function catalog(ctx: AssistantContext): string {
  const money = (minor: number) => (minor / 100).toFixed(2);
  const { refs, items } = catalogRefs(ctx);
  const menus = ctx.menus ?? [];
  const rules = ctx.rules ?? [];
  const mref = menuRefs(menus);
  const rref = ruleRefs(rules);
  const catName = new Map(ctx.items.map((i) => [i.categoryId, i.category ?? i.categoryId]));
  const out: string[] = [];
  out.push(`RESTAURANT ${ctx.restaurant.name}${ctx.restaurant.cuisine ? ` (${ctx.restaurant.cuisine})` : ""}, ${ctx.branchName} branch. Prices in ${ctx.currency}.`);
  if (ctx.restaurant.story) out.push(`About: ${clean(ctx.restaurant.story, 400)}`);
  out.push("MENU");
  for (const m of [...menus].sort((a, b) => mref.get(a.id)!.localeCompare(mref.get(b.id)!, undefined, { numeric: true }))) {
    const zh = m.translations?.zh?.name;
    out.push(`${mref.get(m.id)} ${m.name}${zh ? ` / ${zh}` : ""}: ${windowsText(m.windows)}`);
  }
  for (const r of [...rules].sort((a, b) => rref.get(a.id)!.localeCompare(rref.get(b.id)!, undefined, { numeric: true }))) {
    const off = r.kind === "percent" ? `-${r.value}%` : `-${money(r.value)}`;
    const on = [...r.categories.map((c) => catName.get(c) ?? c), ...r.items.map((i) => refs.get(i) ?? "")].filter(Boolean).join(", ") || "everything";
    out.push(`${rref.get(r.id)} ${r.name}: ${off} on ${on}: ${windowsText(r.windows)}`);
  }
  let cat: string | null = null;
  for (const i of items) {
    if (i.category !== cat) {
      cat = i.category ?? "";
      // a category's timed menu: the one its dishes share (dishes are put on menus by category in practice)
      const ids = [...new Set(items.filter((x) => x.category === cat).flatMap((x) => x.menuIds ?? []))].map((id) => mref.get(id)).filter(Boolean);
      out.push(`# ${cat}${ids.length ? ` ${ids.join(" ")}` : ""}`);
    }
    const codes = [
      i.isSignature ? "*" : "",
      i.dietary.includes("vegan") ? "vg" : i.dietary.includes("vegetarian") ? "v" : "",
      i.dietary.includes("halal") || i.dietary.includes("halal_friendly") ? "h" : "",
      i.spiceLevel ? `s${i.spiceLevel}` : "",
      ...ALLERGENS.filter((a) => i.allergens.includes(a)).map((a) => ALLERGEN_CODES[a]),
    ].filter(Boolean);
    const zh = i.translations?.zh?.name;
    out.push(`${refs.get(i.id)} ${clean(i.name, 60)}${zh ? ` / ${clean(zh, 30)}` : ""} | ${money(i.listPrice ?? i.price)} | ${codes.join(" ")} | ${clean(i.description || i.story || "", 140)}`);
  }
  return out.join("\n");
}

/** A short, stable key for a branch's catalog: the cache entry it lands in, and Workers AI's session affinity. */
export const catalogKey = (text: string) => `cat-${GUIDE_VERSION}-${hash(text).toString(36)}`;

/** Layer 3: what's true right now, in a few dozen tokens. */
export function now(ctx: AssistantContext, locale: string, clock: { weekday: number; minutes: number; date?: string }): string {
  const money = (minor: number) => (minor / 100).toFixed(2);
  const { refs } = catalogRefs(ctx);
  const mref = menuRefs(ctx.menus ?? []);
  const rref = ruleRefs(ctx.rules ?? []);
  const hhmm = `${String(Math.floor(clock.minutes / 60)).padStart(2, "0")}:${String(clock.minutes % 60).padStart(2, "0")}`;
  const parts = [`time ${DAYS[clock.weekday]} ${hhmm}${clock.date ? ` ${clock.date}` : ""}`];
  const on = (ctx.now?.menus ?? []).map((m) => `${mref.get(m.id) ?? m.name}${m.until ? ` until ${m.until}` : ""}`);
  parts.push(on.length ? `on ${on.join(", ")}` : "on (all-day dishes only)");
  for (const d of ctx.now?.deals ?? []) {
    const dealt = ctx.items.filter((i) => i.deal?.id === d.id && i.servedNow !== false && refs.has(i.id));
    parts.push(`deals ${rref.get(d.id) ?? d.name}${d.until ? ` until ${d.until}` : ""}: ${dealt.map((i) => `${refs.get(i.id)} ${money(i.price)}`).join(", ") || "none served now"}`);
  }
  const out = ctx.items.filter((i) => i.active && i.soldOut).map((i) => refs.get(i.id)).filter(Boolean);
  if (out.length) parts.push(`sold out ${out.join(", ")}`);
  const next = [
    ...(ctx.menus ?? []).flatMap((m) => {
      const n = ctx.items.find((i) => i.nextServed?.menuId === m.id)?.nextServed;
      return n && !(ctx.now?.menus ?? []).some((x) => x.id === m.id) ? [`${mref.get(m.id)} ${n.today ? "today" : DAYS[n.weekday]} ${n.time}`] : [];
    }),
    ...(ctx.now?.dealsNext ?? []).map((d) => `${rref.get(d.id) ?? d.name} ${d.today ? "today" : DAYS[d.weekday]} ${d.time}`),
  ];
  if (next.length) parts.push(`next ${next.join(", ")}`);
  parts.push(`reply in ${localeInfo(locale).english}`);
  return `NOW ${parts.join("; ")}`;
}

/** Map the model's dish refs back, for cards: "d4" → the dish. */
export function refToItem(ctx: AssistantContext): Map<string, Item> {
  const { refs, items } = catalogRefs(ctx);
  return new Map(items.map((i) => [refs.get(i.id)!, i]));
}
