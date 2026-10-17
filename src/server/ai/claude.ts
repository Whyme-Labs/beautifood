// Claude-backed AI (used when ANTHROPIC_API_KEY is configured).
//
// Customer assistant: a tool-use loop over the restaurant's own menu data, so
// answers are grounded; allergen facts come from tools, never from memory.
// Merchant copilot: structured outputs (JSON schema) for menu extraction.
// Refusals are handled, and server-side fallbacks are on (`fallbacks: "default"`).
import Anthropic from "@anthropic-ai/sdk";
import { ALLERGEN_LABELS, type Allergen } from "../../shared/allergens";
import { formatMoney } from "../../shared/format";
import { ALLERGY_NOTE, findItem, type AssistantContext, type AssistantReply } from "./local";

const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export interface ClaudeEnv {
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL: string;
}

export function claudeEnabled(env: ClaudeEnv) {
  return !!env.ANTHROPIC_API_KEY;
}

function client(env: ClaudeEnv) {
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 45_000 });
}

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "search_menu",
    description:
      "Search the restaurant's current menu. Returns matching dishes with id, name, price, category, signature flag, spice level, dietary tags and allergens. Use filters to exclude allergens or require dietary tags. Call with an empty query to list everything.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text words to match against dish names, descriptions and categories. Empty string for all." },
        exclude_allergens: { type: "array", items: { type: "string", enum: Object.keys(ALLERGEN_LABELS) }, description: "Allergens the guest must avoid." },
        dietary: { type: "array", items: { type: "string", enum: ["vegetarian", "vegan", "halal_friendly"] } },
        max_price_minor: { type: ["integer", "null"], description: "Maximum price in minor units (e.g. 2000 = 20.00)." },
        max_spice_level: { type: ["integer", "null"], description: "0 = not spicy, 3 = very spicy." },
        signatures_only: { type: "boolean" },
      },
      required: ["query", "exclude_allergens", "dietary", "max_price_minor", "max_spice_level", "signatures_only"],
      additionalProperties: false,
    },
  },
  {
    name: "get_dish",
    description: "Get full details of one dish by id: description, the story behind it, allergens, dietary tags, modifiers.",
    strict: true,
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false },
  },
];

interface SearchInput {
  query: string;
  exclude_allergens: string[];
  dietary: string[];
  max_price_minor: number | null;
  max_spice_level: number | null;
  signatures_only: boolean;
}

function runTool(ctx: AssistantContext, name: string, input: unknown, referenced: Set<string>): string {
  const items = ctx.items.filter((i) => i.active && !i.soldOut);
  if (name === "get_dish") {
    const id = (input as { id: string }).id;
    const it = ctx.items.find((i) => i.id === id);
    if (!it) return JSON.stringify({ error: "No dish with that id" });
    referenced.add(it.id);
    return JSON.stringify({
      id: it.id,
      name: it.name,
      price: formatMoney(it.price, ctx.currency),
      description: it.description,
      story: it.story,
      allergens: it.allergens.map((a) => ALLERGEN_LABELS[a as Allergen] ?? a),
      dietary: it.dietary,
      spice_level: it.spiceLevel,
      signature: it.isSignature,
      sold_out: !!it.soldOut,
      options: it.modifiers.map((g) => ({ group: g.name, options: g.options.map((o) => o.name) })),
    });
  }
  if (name === "search_menu") {
    const s = input as SearchInput;
    const words = s.query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const hits = items.filter(
      (i) =>
        (!words.length || words.some((w) => `${i.name} ${i.description} ${i.category ?? ""} ${i.tags.join(" ")}`.toLowerCase().includes(w))) &&
        !s.exclude_allergens.some((a) => i.allergens.includes(a)) &&
        s.dietary.every((d) => i.dietary.includes(d)) &&
        (s.max_price_minor == null || i.price <= s.max_price_minor) &&
        (s.max_spice_level == null || i.spiceLevel <= s.max_spice_level) &&
        (!s.signatures_only || i.isSignature),
    );
    return JSON.stringify(
      hits.slice(0, 25).map((i) => ({
        id: i.id,
        name: i.name,
        price: formatMoney(i.price, ctx.currency),
        category: i.category,
        signature: i.isSignature,
        popular_today: (i.popularity ?? 0) > 0,
        spice_level: i.spiceLevel,
        dietary: i.dietary,
        allergens: i.allergens,
      })),
    );
  }
  return JSON.stringify({ error: `Unknown tool ${name}` });
}

export async function answerWithClaude(env: ClaudeEnv, ctx: AssistantContext, history: { role: "user" | "assistant"; content: string }[]): Promise<AssistantReply> {
  const c = client(env);
  const system = [
    `You are the friendly menu assistant for ${ctx.restaurant.name}${ctx.restaurant.cuisine ? ` (${ctx.restaurant.cuisine})` : ""}, ${ctx.branchName} branch.`,
    ctx.restaurant.story ? `About the restaurant: ${ctx.restaurant.story}` : "",
    "Help guests decide what to eat: recommend signatures, respect dietary needs and budgets, and share the stories behind dishes.",
    "Use the tools for every fact about dishes, prices and allergens. Never guess an ingredient or allergen; if the data doesn't say, say you don't know and suggest asking staff.",
    "Keep answers short (2-4 sentences), warm and specific. Mention prices. Only recommend dishes that the tools returned.",
  ]
    .filter(Boolean)
    .join("\n");
  const messages: Anthropic.Beta.BetaMessageParam[] = history.slice(-10).map((m) => ({ role: m.role, content: m.content }));
  const referenced = new Set<string>();
  for (let turn = 0; turn < 6; turn++) {
    const res = await c.beta.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 4000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "low" },
      system,
      tools: TOOLS,
      messages,
    });
    if (res.stop_reason === "refusal") {
      return { answer: "Sorry, I can't help with that one. Ask me about our dishes, ingredients or what to order!", items: [], engine: "claude" };
    }
    if (res.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: res.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const b of res.content) if (b.type === "tool_use") results.push({ type: "tool_result", tool_use_id: b.id, content: runTool(ctx, b.name, b.input, referenced) });
      messages.push({ role: "user", content: results });
      continue;
    }
    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    // surface dishes the model looked up or named, so the UI can show "add to cart" cards
    for (const it of ctx.items) if (text.includes(it.name)) referenced.add(it.id);
    const lastQ = history[history.length - 1]?.content ?? "";
    const allergenQuestion = /allerg|contain|gluten|nut|dairy|shellfish|egg|soy|sesame|vegan|halal/i.test(lastQ) || !!findItem(ctx.items, lastQ)?.allergens.length;
    return {
      answer: text || "Sorry, I didn't catch that.",
      items: [...referenced]
        .map((id) => ctx.items.find((i) => i.id === id)!)
        .filter(Boolean)
        .slice(0, 4)
        .map((i) => ({ id: i.id, name: i.name, price: i.price })),
      safetyNote: allergenQuestion ? ALLERGY_NOTE : undefined,
      engine: "claude",
    };
  }
  return { answer: "Let me hand you over to our staff for that one.", items: [], engine: "claude" };
}

// ── merchant copilot ───────────────────────────────────────────────────────

export interface ExtractedMenu {
  restaurant: { cuisine: string; story: string };
  items: {
    category: string;
    name: string;
    price_minor: number;
    description: string;
    story: string;
    allergens: string[];
    dietary: string[];
    spice_level: number;
    is_signature: boolean;
    station: string;
  }[];
  tables: { label: string; seats_min: number; seats_max: number; zone: string; merge_group: string | null; split_into: number[] }[];
}

const MENU_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["restaurant", "items", "tables"],
  properties: {
    restaurant: {
      type: "object",
      additionalProperties: false,
      required: ["cuisine", "story"],
      properties: { cuisine: { type: "string" }, story: { type: "string" } },
    },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "name", "price_minor", "description", "story", "allergens", "dietary", "spice_level", "is_signature", "station"],
        properties: {
          category: { type: "string" },
          name: { type: "string" },
          price_minor: { type: "integer" },
          description: { type: "string" },
          story: { type: "string" },
          allergens: { type: "array", items: { type: "string", enum: Object.keys(ALLERGEN_LABELS) } },
          dietary: { type: "array", items: { type: "string", enum: ["vegetarian", "vegan", "halal_friendly", "spicy"] } },
          spice_level: { type: "integer" },
          is_signature: { type: "boolean" },
          station: { type: "string", enum: ["kitchen", "bar", "dessert"] },
        },
      },
    },
    tables: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "seats_min", "seats_max", "zone", "merge_group", "split_into"],
        properties: {
          label: { type: "string" },
          seats_min: { type: "integer" },
          seats_max: { type: "integer" },
          zone: { type: "string" },
          merge_group: { type: ["string", "null"] },
          split_into: { type: "array", items: { type: "integer" } },
        },
      },
    },
  },
} as const;

/** Turn free-form onboarding notes (menu text, floor description, about-us) into structured drafts. */
export async function extractWithClaude(env: ClaudeEnv, input: { restaurantName: string; menuText: string; floorText: string; about: string; currency: string }): Promise<ExtractedMenu | null> {
  const c = client(env);
  const res = await c.beta.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: MENU_SCHEMA as unknown as Record<string, unknown> } },
    system:
      "You help restaurant owners set up their point-of-sale. Extract a structured menu and floor plan from their notes. Prices are integers in minor units of the given currency. Infer likely allergens conservatively from ingredients (when unsure, include the allergen: the owner reviews everything). Write a one or two sentence story for each dish in a warm voice, using only what the notes support; leave it empty if there's nothing to go on. Mark dishes the notes call signature/best-seller/chef's special as signatures. Tables: expand counts into individual tables with short unique labels; tables that 'can be pushed together' share a merge_group; split_into lists part sizes for tables that can split, else empty.",
    messages: [
      {
        role: "user",
        content: `Restaurant: ${input.restaurantName}\nCurrency: ${input.currency}\n\nAbout:\n${input.about || "(none)"}\n\nMenu:\n${input.menuText || "(none)"}\n\nFloor:\n${input.floorText || "(none)"}`,
      },
    ],
  });
  if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") return null;
  const text = res.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")?.text;
  if (!text) return null;
  try {
    return JSON.parse(text) as ExtractedMenu;
  } catch {
    return null;
  }
}

/** Rewrite computed report facts as a short narrative for the owner. Facts in, prose out. */
export async function narrateWithClaude(env: ClaudeEnv, facts: string[], audience: string): Promise<string | null> {
  const c = client(env);
  const res = await c.beta.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 2000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: `You write brief operational insights for ${audience}. Use only the facts given; don't invent numbers. 3-5 bullet points, each with a concrete suggested action.`,
    messages: [{ role: "user", content: facts.join("\n") }],
  });
  if (res.stop_reason === "refusal") return null;
  return (
    res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim() || null
  );
}
