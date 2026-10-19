// AI entry points used by routes and the MCP server. Each picks Claude when
// configured and falls back to the deterministic local engine otherwise (or on error).
import { inferAllergens, inferDietary } from "../../shared/allergens";
import { localizeItem } from "../../shared/menuI18n";
import { formatMoney } from "../../shared/format";
import { parseFloorText, parseMenuText, stationFor } from "../../shared/menuParser";
import type { BranchCtx } from "../domain/context";
import { menuAt, type ImportItem } from "../domain/menu";
import type { TableInput } from "../domain/floor";
import { localParts } from "../ids";
import { answerWithClaude, claudeEnabled, extractWithClaude, narrateWithClaude, type ClaudeEnv } from "./claude";
import { answerLocally, type AssistantContext, type AssistantReply } from "./local";

export async function assistantContext(db: D1Database, ctx: BranchCtx): Promise<AssistantContext> {
  const menu = await menuAt(db, ctx);
  const since = Date.now() - 7 * 86_400_000;
  const pop = (
    await db
      .prepare("SELECT item_id, SUM(qty) AS n FROM order_items WHERE branch_id = ? AND created_at > ? AND status <> 'void' GROUP BY item_id")
      .bind(ctx.branch.id, since)
      .all<{ item_id: string; n: number }>()
  ).results;
  const popularity = new Map(pop.map((p) => [p.item_id, p.n]));
  const catName = new Map(menu.categories.map((c) => [c.id, c.name]));
  return {
    restaurant: { name: ctx.tenant.name, cuisine: ctx.tenant.cuisine, story: ctx.tenant.story, description: ctx.tenant.description },
    branchName: ctx.branch.name,
    currency: ctx.config.currency,
    menuLanguage: menu.language,
    items: menu.items.map((i) => ({ ...i, category: catName.get(i.categoryId), popularity: popularity.get(i.id) ?? 0 })),
  };
}

export async function customerChat(db: D1Database, env: ClaudeEnv, ctx: BranchCtx, history: { role: "user" | "assistant"; content: string }[], locale = "en"): Promise<AssistantReply> {
  const actx = await assistantContext(db, ctx);
  const question = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  // Dish cards read in the guest's language; `name` stays the original for matching and ordering.
  const label = (r: AssistantReply): AssistantReply => ({
    ...r,
    items: r.items.map((it) => {
      const item = actx.items.find((i) => i.id === it.id);
      return item ? { ...it, label: localizeItem(item, locale, actx.menuLanguage ?? "en").name } : it;
    }),
  });
  if (claudeEnabled(env)) {
    try {
      return label(await answerWithClaude(env, actx, history, locale));
    } catch (e) {
      console.warn("claude assistant failed, using local engine", e);
    }
  }
  return label(answerLocally(actx, question, locale));
}

export interface OnboardingInput {
  restaurantName: string;
  about: string;
  menuText: string;
  floorText: string;
  currency: string;
}

export interface OnboardingDraft {
  engine: "claude" | "local";
  cuisine: string;
  story: string;
  items: ImportItem[];
  tables: TableInput[];
  warnings: string[];
  suggestions: string[];
}

/**
 * The onboarding copilot: one paste of "about us + menu + floor" becomes a draft
 * menu (with inferred allergens, dietary tags, stations, signature flags, stories)
 * and a floor plan (with merge groups and split configs). Nothing is saved until
 * the owner reviews and applies it.
 */
export async function onboardingDraft(env: ClaudeEnv, input: OnboardingInput): Promise<OnboardingDraft> {
  if (claudeEnabled(env)) {
    try {
      const x = await extractWithClaude(env, input);
      if (x && (x.items.length || x.tables.length)) {
        return finalizeDraft("claude", x.restaurant.cuisine, x.restaurant.story, x.items.map((i) => ({
          category: i.category,
          name: i.name,
          price: i.price_minor,
          description: i.description,
          story: i.story,
          // safety: union the model's allergens with keyword inference; the owner reviews
          allergens: [...new Set([...i.allergens, ...inferAllergens(`${i.name} ${i.description}`)])],
          dietary: i.dietary,
          spiceLevel: Math.max(0, Math.min(3, i.spice_level)),
          isSignature: i.is_signature,
          station: i.station,
        })), x.tables.map((t) => ({
          label: t.label,
          seatsMin: Math.max(1, t.seats_min),
          seatsMax: Math.max(t.seats_min, t.seats_max),
          zone: t.zone || "Main",
          mergeGroup: t.merge_group,
          splitConfig: t.split_into.length > 1 ? t.split_into.map((s, i) => ({ suffix: String.fromCharCode(97 + i), seats: s })) : null,
        })), []);
      }
    } catch (e) {
      console.warn("claude onboarding failed, using local parser", e);
    }
  }
  const menu = parseMenuText(input.menuText);
  const tables = parseFloorText(input.floorText);
  const cuisine = guessCuisine(`${input.about} ${input.menuText}`);
  return finalizeDraft(
    "local",
    cuisine,
    input.about.trim().split(/(?<=[.!?])\s+/).slice(0, 3).join(" "),
    menu.items.map((i) => ({
      category: i.category,
      name: i.name,
      price: i.price,
      description: i.description,
      story: draftStory(i.name, i.description, i.isSignature, input.restaurantName),
      allergens: i.allergens,
      dietary: i.dietary,
      spiceLevel: i.spiceLevel,
      isSignature: i.isSignature,
      station: i.station,
    })),
    tables,
    menu.warnings,
  );
}

function finalizeDraft(engine: OnboardingDraft["engine"], cuisine: string, story: string, items: ImportItem[], tables: TableInput[], warnings: string[]): OnboardingDraft {
  const suggestions: string[] = [];
  if (items.length && !items.some((i) => i.isSignature)) {
    const top = [...items].sort((a, b) => b.price - a.price).slice(0, 2);
    top.forEach((t) => (t.isSignature = true));
    suggestions.push(`No signatures were marked, so we suggested ${top.map((t) => t.name).join(" and ")}. Change this anytime — signatures power the AI assistant's recommendations.`);
  }
  for (const i of items) {
    if (!i.station) i.station = stationFor(i.category, i.name);
    if (!i.dietary?.length) Object.assign(i, inferDietary(`${i.name} ${i.description ?? ""}`));
  }
  const withAllergens = items.filter((i) => i.allergens?.length).length;
  if (items.length) suggestions.push(`We inferred allergens for ${withAllergens} of ${items.length} dishes from their ingredients. Please review them before publishing.`);
  if (tables.length) {
    const seats = tables.reduce((s, t) => s + t.seatsMax, 0);
    const big = tables.filter((t) => t.seatsMax >= 6).length;
    suggestions.push(`${tables.length} tables, ${seats} seats. ${big ? "" : "You have no tables for 6+; mark tables that can be pushed together so large parties can still be seated."}`.trim());
    if (tables.length >= 12) suggestions.push("With this many tables, the Smart strategy (wait time + seat fit + merges) usually clears the queue fastest.");
  } else suggestions.push("Describe your floor (e.g. \"8 two-seaters, 6 tables of 4 that can be pushed together\") and we'll lay out tables for you.");
  return { engine, cuisine, story, items: items.slice(0, 300), tables: tables.slice(0, 200), warnings, suggestions };
}

function draftStory(name: string, description: string, signature: boolean, restaurant: string): string {
  if (!description) return signature ? `A ${restaurant} signature — ask our team what makes it special.` : "";
  const d = description.charAt(0).toLowerCase() + description.slice(1);
  return signature ? `${name} is a ${restaurant} signature: ${d}.` : `${name}: ${d}.`;
}

function guessCuisine(text: string): string {
  const t = text.toLowerCase();
  const rules: [RegExp, string][] = [
    [/laksa|nasi lemak|char kway|kway teow|teh tarik|roti canai|rendang|satay|mee goreng/, "Malaysian"],
    [/sushi|ramen|udon|tempura|donburi|miso/, "Japanese"],
    [/dim sum|har gow|siu mai|wonton|char siu/, "Cantonese"],
    [/pizza|pasta|risotto|tiramisu/, "Italian"],
    [/taco|burrito|quesadilla/, "Mexican"],
    [/tom yum|pad thai|green curry/, "Thai"],
    [/burger|fries|steak/, "Western"],
    [/latte|espresso|croissant/, "Café"],
  ];
  return rules.find(([re]) => re.test(t))?.[1] ?? "";
}

// ── onboarding progress ────────────────────────────────────────────────────

export async function onboardingStatus(db: D1Database, tenantId: string) {
  const [t, b, items, tables, staff, members, cfg] = await db.batch([
    db.prepare("SELECT name, story, cuisine, onboarding FROM tenants WHERE id = ?").bind(tenantId),
    db.prepare("SELECT COUNT(*) AS n FROM branches WHERE tenant_id = ?").bind(tenantId),
    db.prepare("SELECT COUNT(*) AS n, SUM(is_signature) AS sig, SUM(CASE WHEN allergens <> '[]' THEN 1 ELSE 0 END) AS al FROM menu_items WHERE tenant_id = ? AND active = 1").bind(tenantId),
    db.prepare("SELECT COUNT(*) AS n FROM floor_tables f JOIN branches b ON b.id = f.branch_id WHERE b.tenant_id = ? AND f.active = 1").bind(tenantId),
    db.prepare("SELECT COUNT(*) AS n FROM staff WHERE tenant_id = ?").bind(tenantId),
    db.prepare("SELECT COUNT(*) AS n FROM members WHERE tenant_id = ?").bind(tenantId),
    db.prepare("SELECT config FROM branches WHERE tenant_id = ? ORDER BY created_at LIMIT 1").bind(tenantId),
  ]);
  const n = (r: D1Result, k = "n") => Number((r.results[0] as Record<string, number> | undefined)?.[k] ?? 0);
  const tenant = t.results[0] as { name: string; story: string; cuisine: string; onboarding: string };
  const marks = JSON.parse(tenant?.onboarding || "{}") as Record<string, boolean>;
  const branchCfg = JSON.parse(((cfg.results[0] as { config: string } | undefined)?.config) || "{}");
  const steps = [
    { key: "profile", label: "Tell us about your restaurant", done: !!(tenant?.story || tenant?.cuisine), href: "/m/setup" },
    { key: "menu", label: "Add your menu (paste it — AI does the rest)", done: n(items) > 0, href: "/m/setup" },
    { key: "allergens", label: "Review allergens & signatures", done: n(items) > 0 && (marks.allergensReviewed || (n(items, "al") > 0 && n(items, "sig") > 0)), href: "/m/menu" },
    { key: "tables", label: "Lay out your tables", done: n(tables) > 0, href: "/m/setup" },
    { key: "queue", label: "Choose queue size classes & seating strategy", done: !!(marks.queueReviewed || branchCfg.categories || branchCfg.strategy), href: "/m/settings" },
    { key: "staff", label: "Invite your team", done: n(staff) > 1, href: "/m/staff" },
    { key: "qr", label: "Print table QR codes", done: !!marks.qrPrinted, href: "/m/qr" },
    { key: "loyalty", label: "Switch on loyalty points", done: !!marks.loyaltyReviewed || n(members) > 0, href: "/m/members" },
  ];
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done) ?? null;
  return { steps, progress: Math.round((done / steps.length) * 100), next, branches: n(b) };
}

// ── insights ────────────────────────────────────────────────────────────────

export async function insights(env: ClaudeEnv, ctx: BranchCtx, report: Awaited<ReturnType<typeof import("../domain/reports").branchReport>>) {
  const m = (x: number) => formatMoney(x, ctx.config.currency);
  const facts: string[] = [];
  const s = report.sales;
  facts.push(`${report.day}: ${s.orders} paid bills, sales ${m(s.gross)}, average check ${m(s.averageCheck)}, ${s.covers} covers.`);
  if (report.hourly.length) {
    const peak = [...report.hourly].sort((a, b) => b.sales - a.sales)[0];
    facts.push(`Peak hour ${String(peak.hour).padStart(2, "0")}:00 with ${peak.orders} bills (${m(peak.sales)}).`);
  }
  if (report.items.length) {
    const stars = report.items.filter((i) => i.class === "star").map((i) => i.name);
    const dogs = report.items.filter((i) => i.class === "dog").map((i) => i.name);
    facts.push(`Best sellers: ${report.items.slice(0, 3).map((i) => `${i.name} (${i.qty})`).join(", ")}.`);
    if (stars.length) facts.push(`Menu stars (popular and high-revenue): ${stars.slice(0, 3).join(", ")}.`);
    if (dogs.length) facts.push(`Low performers today: ${dogs.slice(0, 3).join(", ")} — consider promoting, re-pricing or removing.`);
  }
  const q = report.queue;
  if (q.joined) {
    facts.push(`Queue: ${q.joined} joined, ${q.seated} seated, average wait ${q.avgWaitMinutes} min (p90 ${q.p90WaitMinutes} min).`);
    const lost = q.cancelled + q.noShows;
    if (lost / q.joined > 0.15) facts.push(`${Math.round((lost / q.joined) * 100)}% of the queue walked away (${q.cancelled} cancelled, ${q.noShows} no-shows) — preorders while waiting and earlier notifications reduce this.`);
  }
  if (report.tables.turns) facts.push(`${report.tables.turns} table turns, average ${report.tables.avgTurnMinutes} min per table.`);
  if (!facts.length || (!s.orders && !q.joined)) facts.push("No trading activity recorded yet for this day.");
  let narrative: string | null = null;
  if (claudeEnabled(env)) {
    try {
      narrative = await narrateWithClaude(env, facts, `the owner of ${ctx.tenant.name} (${ctx.branch.name})`);
    } catch (e) {
      console.warn("insight narration failed", e);
    }
  }
  return { facts, narrative, engine: narrative ? "claude" : "local", generatedAt: Date.now(), localHour: localParts(Date.now(), ctx.config.timezone).hour };
}
