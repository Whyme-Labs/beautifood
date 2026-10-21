// What the model input costs, before and after the three-layer layout (src/server/ai/menuInput.ts),
// on the demo menus at many moments of the week and in two languages.
//
// Tokens are estimated (≈4 characters a token for Latin text, 1 per CJK character): there is no
// tokenizer in the repo, and the comparison is between formats, so the same estimate on both
// sides is fair. Cache behaviour is exact: it's whether the prefix bytes are identical.
//
//   npx tsx demo/brain/tokens.ts
import { writeFileSync } from "node:fs";
import { localeInfo } from "../../src/i18n/core";
import { MENU_TOOLS, runTool } from "../../src/server/ai/claude";
import type { AssistantContext } from "../../src/server/ai/local";
import { catalog, catalogKey, GUIDE, now } from "../../src/server/ai/menuInput";
import type { Clock } from "../../src/shared/schedule";
import { contextAt } from "./run";
import { KOPI_KAKI, SAKE_SMOKE } from "./menus";

export const tokens = (s: string) => {
  const cjk = (s.match(/[　-鿿＀-￯]/g) ?? []).length;
  return Math.round(cjk + (s.length - cjk) / 4);
};

// ---- the previous format (as it was before this change), for the comparison ----
function legacySystem(ctx: AssistantContext, locale: string): string {
  return [
    `You are the friendly menu assistant for ${ctx.restaurant.name}${ctx.restaurant.cuisine ? ` (${ctx.restaurant.cuisine})` : ""}, ${ctx.branchName} branch.`,
    ctx.restaurant.story ? `About the restaurant: ${ctx.restaurant.story}` : "",
    "Help guests decide what to eat: recommend signatures, respect dietary needs and budgets, and share the stories behind dishes.",
    "Use the tools for every fact about dishes, prices and allergens. Never guess an ingredient or allergen; if the data doesn't say, say you don't know and suggest asking staff.",
    "Keep answers short (2-4 sentences), warm and specific. Mention prices. Only recommend dishes that the tools returned.",
    `Reply in ${localeInfo(locale).english}, whatever language the menu is in. Name dishes the way the menu data translates them for that language when it has a translation, with the original name in brackets the first time.`,
  ]
    .filter(Boolean)
    .join("\n");
}
function legacyMenu(ctx: AssistantContext): string {
  return ctx.items
    .filter((i) => i.active && !i.soldOut && i.servedNow !== false)
    .map((i) =>
      [i.name, `RM${(i.price / 100).toFixed(2)}`, i.category ?? "", i.isSignature ? "signature" : "", i.spiceLevel ? `spice ${i.spiceLevel}/3` : "not spicy", i.dietary.length ? i.dietary.join(", ") : "", `allergens: ${i.allergens.length ? i.allergens.join(", ") : "none listed"}`, i.description ? `— ${i.description.slice(0, 120)}` : ""]
        .filter(Boolean)
        .join(" | "),
    )
    .join("\n");
}
const legacyInline = (ctx: AssistantContext, locale: string) => `${legacySystem(ctx, locale)}\nThe menu (only these dishes exist; allergens are as listed, never assume more or less):\n${legacyMenu(ctx)}\nWrite dish names exactly as on the menu.`;

const at = (weekday: number, hhmm: string, date: string): Clock => ({ weekday, minutes: Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)), date });
// a week of moments: breakfast, lunch promo, after lunch, happy hour, dinner, late night, weekend
const MOMENTS = [at(1, "08:30", "2026-10-19"), at(3, "12:10", "2026-10-21"), at(3, "13:30", "2026-10-21"), at(3, "16:20", "2026-10-21"), at(2, "18:05", "2026-10-20"), at(4, "20:00", "2026-10-22"), at(5, "23:40", "2026-10-23"), at(6, "09:15", "2026-10-24"), at(6, "14:00", "2026-10-24"), at(0, "19:00", "2026-10-25")];
const LOCALES = ["en", "zh"];

export function measure() {
  const toolDefs = JSON.stringify(MENU_TOOLS);
  return [KOPI_KAKI, SAKE_SMOKE].map((m) => {
    const legacyPrefixes = new Set<string>();
    const newPrefixes = new Set<string>();
    let legacyInlineTok = 0, legacyToolsTok = 0, newTok = 0, newUncached = 0, n = 0;
    for (const c of MOMENTS)
      for (const loc of LOCALES) {
        const ctx = contextAt(m, c);
        const old = legacyInline(ctx, loc);
        legacyPrefixes.add(old);
        legacyInlineTok += tokens(old);
        // the old Claude path: tools + system, then a search_menu call whose result comes back as JSON
        const result = runTool(ctx, "search_menu", { query: "", exclude_allergens: [], dietary: [], max_price_minor: null, max_spice_level: null, signatures_only: false }, new Set());
        legacyToolsTok += 2 * tokens(toolDefs + legacySystem(ctx, loc)) + tokens(result);
        const cat = catalog(ctx);
        newPrefixes.add(GUIDE + cat);
        const nw = now(ctx, loc, c);
        newTok += tokens(GUIDE) + tokens(cat) + tokens(nw);
        newUncached += tokens(nw);
        n++;
      }
    const ctx = contextAt(m, MOMENTS[1]);
    return {
      restaurant: m.name,
      dishes: ctx.items.length,
      requests: n,
      guide: tokens(GUIDE),
      catalog: tokens(catalog(ctx)),
      nowAvg: Math.round(newUncached / n),
      legacyInlineAvg: Math.round(legacyInlineTok / n),
      legacyToolsAvg: Math.round(legacyToolsTok / n),
      newAvg: Math.round(newTok / n),
      legacyDistinctPrefixes: legacyPrefixes.size,
      newDistinctPrefixes: newPrefixes.size,
      catalogKey: catalogKey(catalog(ctx)),
    };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = measure();
  writeFileSync(new URL("./out/tokens.json", import.meta.url), JSON.stringify(r, null, 1));
  console.table(r);
}
