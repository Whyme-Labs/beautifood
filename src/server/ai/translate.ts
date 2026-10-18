// Menu translation, best engine first:
//   1. Claude (ANTHROPIC_API_KEY): one structured call per batch, food-aware.
//   2. Workers AI m2m100 (an `AI` binding, bound in production deploys).
//   3. A built-in hawker glossary, so demos and tests work with no keys at all.
// Machine translations are stored with source "ai"/"glossary" so the merchant can
// review them; their manual edits ("manual") are never overwritten.
import Anthropic from "@anthropic-ai/sdk";
import { localeInfo } from "../../i18n/core";
import type { ClaudeEnv } from "./claude";

export interface TranslateEnv extends ClaudeEnv {
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<unknown> };
}

export type Engine = "claude" | "workers-ai" | "glossary";

/** Translate texts from one language to another. Unknown texts come back null. */
export async function translateTexts(env: TranslateEnv, texts: string[], from: string, to: string): Promise<{ engine: Engine; out: (string | null)[] }> {
  if (!texts.length) return { engine: "glossary", out: [] };
  if (env.ANTHROPIC_API_KEY) {
    try {
      const out = await withClaude(env, texts, from, to);
      if (out) return { engine: "claude", out };
    } catch (e) {
      console.warn("claude translate failed, falling back", e);
    }
  }
  if (env.AI) {
    try {
      // Known dish names keep their customary local names (炒粿条, not a literal translation).
      const out = await mapLimit(texts, 6, async (t) => glossary(t, to) ?? (await withWorkersAi(env, t, from, to)));
      return { engine: "workers-ai", out };
    } catch (e) {
      console.warn("workers ai translate failed, falling back", e);
    }
  }
  return { engine: "glossary", out: texts.map((t) => glossary(t, to)) };
}

const FALLBACK_BETA = "server-side-fallback-2026-07-01";

async function withClaude(env: TranslateEnv, texts: string[], from: string, to: string): Promise<(string | null)[] | null> {
  const c = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 60_000 });
  const res = await c.beta.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 8000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: {
      effort: "low",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["translations"],
          properties: { translations: { type: "array", items: { type: "string" } } },
        },
      },
    },
    system:
      `You translate restaurant menus from ${localeInfo(from).english} to ${localeInfo(to).english}. ` +
      "Return exactly one translation per input, in order. Dish names: use the name diners in that language actually use (for Malaysian hawker food, the customary Chinese name, e.g. Char Kway Teow → 炒粿条, Nasi Lemak → 椰浆饭); otherwise translate naturally and briefly. " +
      "Keep prices, numbers and brand names unchanged. Never add or remove ingredients or allergen information.",
    messages: [{ role: "user", content: JSON.stringify(texts) }],
  });
  if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") return null;
  const text = res.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")?.text;
  if (!text) return null;
  const parsed = JSON.parse(text) as { translations: string[] };
  if (!Array.isArray(parsed.translations) || parsed.translations.length !== texts.length) return null;
  return parsed.translations.map((t) => t.trim() || null);
}

async function withWorkersAi(env: TranslateEnv, text: string, from: string, to: string): Promise<string | null> {
  const r = (await env.AI!.run("@cf/meta/m2m100-1.2b", { text, source_lang: from, target_lang: to })) as { translated_text?: string };
  return r.translated_text?.trim() || null;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

// ── Glossary ─────────────────────────────────────────────────────────────
// Customary Chinese names for Malaysian hawker dishes, ingredients and menu words.
// Whole-text matches first; descriptions made of comma-separated known phrases are
// translated phrase by phrase. Anything else is left for a real engine or the merchant.
const ZH: Record<string, string> = {
  // dishes
  "char kway teow": "炒粿条",
  "penang assam laksa": "槟城亚参叻沙",
  "assam laksa": "亚参叻沙",
  "curry mee": "咖喱面",
  "curry laksa": "咖喱叻沙",
  "vegetarian mee goreng": "素印度炒面",
  "mee goreng": "印度炒面",
  "nasi lemak ayam rempah": "香料炸鸡椰浆饭",
  "nasi lemak": "椰浆饭",
  "hainanese chicken rice": "海南鸡饭",
  "chicken rice": "鸡饭",
  "nasi kerabu": "蓝花饭",
  "satay (6 sticks)": "沙爹（6 串）",
  satay: "沙爹",
  rojak: "啰惹",
  "garden salad": "田园沙拉",
  cendol: "煎蕊",
  "ais kacang": "红豆冰",
  "teh tarik": "拉茶",
  "kopi o": "咖啡乌",
  kopi: "咖啡",
  "fresh lime juice": "鲜榨酸柑汁",
  "iced barley": "冰薏米水",
  "wonton mee": "云吞面",
  "pan mee": "板面",
  "kaya butter toast": "咖椰牛油吐司",
  "half-boiled eggs": "半生熟蛋",
  "kopi c": "咖啡C",
  "milo dinosaur": "美禄恐龙",
  "roti canai": "印度煎饼",
  "bak kut teh": "肉骨茶",
  "hokkien mee": "福建面",
  "lor mee": "卤面",
  "chee cheong fun": "猪肠粉",
  "oyster omelette": "蚝煎",
  "lime juice": "酸柑汁",
  // categories
  noodles: "面食",
  rice: "饭类",
  sides: "小食",
  desserts: "甜品",
  drinks: "饮料",
  breakfast: "早餐",
  mains: "主食",
  snacks: "小吃",
  beverages: "饮料",
  // modifiers
  sugar: "甜度",
  "less sugar": "少糖",
  "no sugar": "无糖",
  temperature: "温度",
  hot: "热",
  iced: "冰",
  spice: "辣度",
  "spice level": "辣度",
  mild: "微辣",
  medium: "中辣",
  "extra spicy": "大辣",
  size: "份量",
  regular: "普通",
  large: "大份",
  small: "小份",
  "add egg": "加蛋",
  // ingredients & descriptions
  "wok-fried flat rice noodles with prawns": "镬气炒河粉配大虾",
  "wok-fried flat rice noodles": "镬气炒河粉",
  prawns: "大虾",
  prawn: "虾",
  egg: "鸡蛋",
  "bean sprouts": "豆芽",
  chives: "韭菜",
  "chives and soy sauce": "韭菜和酱油",
  "egg noodles, char siu, prawn wontons": "蛋面、叉烧、鲜虾云吞",
  "soy sauce": "酱油",
  "tamarind mackerel broth": "亚参鲭鱼汤",
  chilli: "辣椒",
  mint: "薄荷",
  pineapple: "黄梨",
  "shrimp paste": "虾膏",
  "coconut curry broth": "椰浆咖喱汤",
  "yellow noodles": "黄面",
  "tofu puffs": "豆卜",
  cockles: "血蚶",
  "fried yellow noodles": "炒黄面",
  tofu: "豆腐",
  vegetables: "蔬菜",
  "coconut rice": "椰浆饭",
  "spiced fried chicken": "香料炸鸡",
  sambal: "参巴辣椒",
  peanuts: "花生",
  anchovies: "江鱼仔",
  "poached chicken": "白切鸡",
  ginger: "姜蓉",
  "chilli sauce": "辣椒酱",
  "blue rice": "蓝花饭",
  herbs: "香草",
  "salted fish": "咸鱼",
  "fried chicken": "炸鸡",
  "chicken skewers with peanut sauce": "鸡肉串配花生酱",
  fruit: "水果",
  cucumber: "黄瓜",
  "crushed peanuts": "花生碎",
  "mixed greens": "综合生菜",
  tomato: "番茄",
  "shaved ice": "刨冰",
  "coconut milk": "椰浆",
  "palm sugar": "椰糖",
  "green rice jelly": "绿色煎蕊条",
  "red beans": "红豆",
  "sweet corn": "玉米",
  "evaporated milk": "淡奶",
  "pulled milk tea": "拉奶茶",
  "house-made pandan kaya": "自制班兰咖椰",
  butter: "牛油",
  "egg noodles": "蛋面",
  "char siu": "叉烧",
  "prawn wontons": "鲜虾云吞",
  "iced milo heaped with milo powder": "冰美禄加满美禄粉",
};

const GLOSSARIES: Record<string, Record<string, string>> = { zh: ZH };

/** Glossary translation: whole text, a "(signature)"-style suffix, or comma-separated known phrases. */
export function glossary(text: string, to: string): string | null {
  const g = GLOSSARIES[to];
  if (!g) return null;
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const whole = g[norm(text)];
  if (whole) return whole;
  const parts = text.split(/\s*[,;]\s*/).filter(Boolean);
  if (parts.length > 1) {
    const tr = parts.map((p) => g[norm(p.replace(/\(.*?\)/g, ""))]);
    if (tr.every(Boolean)) return tr.join("、");
  }
  return null;
}
