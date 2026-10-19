// The storefront designer: "a 1960s kopitiam feel, green and cream, put our story first" in, a
// complete design (theme, layout, section order, words in English and Chinese) out. Refining
// sends the current design with the new instruction. Claude when configured, else a reading of
// the description that picks a curated preset and arranges the sections. Either way the result is
// validated and made readable before anyone sees it, and nothing is live until it's published.
import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_SECTIONS, FONT_IDS, PRESETS, SECTION_TYPES, StorefrontSchema, readable, type FontId, type SectionType, type Storefront } from "../../shared/storefront";
import { claudeEnabled, type ClaudeEnv } from "./claude";

export interface DesignInput {
  prompt: string;
  current?: Storefront | null;
  restaurant: { name: string; cuisine: string; description: string; story: string; translations: Record<string, { story?: string; description?: string }> };
  locales: string[];
}

export interface DesignResult {
  design: Storefront;
  notes: string;
  engine: "claude" | "rules";
}

const MOODS: [RegExp, keyof typeof PRESETS][] = [
  [/kopitiam|old.?school|vintage|retro|heritage|nostalg|traditional|老|怀旧|复古|传统|咖啡店|茶室/i, "kopitiam"],
  [/night|dark|moody|neon|bar|夜|暗|霓虹/i, "nightMarket"],
  [/minimal|clean|modern|simple|sleek|简约|现代|简洁/i, "minimal"],
  [/sea|ocean|beach|seafood|blue|coast|海|蓝|海鲜/i, "seaside"],
  [/terracotta|rustic|earth|clay|warm|wood|farm|陶|乡村|大地|暖/i, "terracotta"],
  [/pastel|pink|cute|caf[eé]|dessert|sweet|bakery|粉|可爱|甜品|烘焙|咖啡馆/i, "pastel"],
  [/mamak|orange|spice|curry|indian|roti|嘛嘛|橙|咖喱|印度/i, "mamak"],
  [/yellow|sun|bright|hawker|cheer|阳光|黄|小贩|明亮/i, "sunshine"],
];

const COLOURS: [RegExp, string][] = [
  [/\bgreen|绿/i, "#1f6b45"],
  [/\bred\b|红/i, "#b8321f"],
  [/\bblue|蓝/i, "#0f5f8a"],
  [/\borange|橙/i, "#c75a00"],
  [/\bpurple|violet|紫/i, "#6b3fa0"],
  [/\bpink|粉/i, "#b23d6a"],
  [/\bblack|黑/i, "#111111"],
  [/\bgold|金/i, "#a77a12"],
];

function byRules(input: DesignInput): DesignResult {
  const p = input.prompt;
  const base = input.current ?? null;
  const mood = MOODS.find(([re]) => re.test(p))?.[1];
  let theme = { ...(mood ? PRESETS[mood].theme : (base?.theme ?? PRESETS.sunshine.theme)) };
  const colour = COLOURS.find(([re]) => re.test(p))?.[1];
  if (colour) theme.accent = colour;
  if (/cream|beige|米色|奶油/i.test(p)) theme = { ...theme, bg: "#f4ecd8", surface: "#fffaf0" };
  if (/white background|白底/i.test(p)) theme = { ...theme, bg: "#ffffff", surface: "#f7f7f5" };
  const font: FontId | undefined = /serif|elegant|classic|editorial|优雅|经典|衬线/i.test(p) ? "editorial" : /playful|fun|round|friendly|可爱|活泼|圆/i.test(p) ? "rounded" : /bold|loud|poster|大胆|醒目/i.test(p) ? "kopitiam" : /modern|minimal|现代|简约/i.test(p) ? "modern" : undefined;
  if (font) theme.font = font;
  if (/sharp|square|straight|方/i.test(p)) theme.radius = "sharp";
  else if (/round|soft|pill|圆/i.test(p)) theme.radius = "round";

  // sections the description names come first, in the order it names them
  const named: [RegExp, SectionType][] = [
    [/story|heritage|history|since|our roots|故事|历史|传承/i, "story"],
    [/menu|dish|food|signature|菜单|菜|招牌/i, "menu"],
    [/queue|wait|walk-?in|排队|等位/i, "queue"],
    [/book|reserv|订位|预订/i, "booking"],
    [/branch|location|find us|map|address|分店|地址|地图/i, "branches"],
    [/photos|gallery|相册|照片墙/i, "gallery"],
  ];
  const mentioned = named.map(([re, type]) => ({ type, at: p.search(re) })).filter((x) => x.at >= 0).sort((a, b) => a.at - b.at).map((x) => x.type);
  const existing = base?.sections ?? DEFAULT_SECTIONS;
  const first = /\bfirst\b|lead with|open with|先|放在最前|开头/i.test(p) ? mentioned : [];
  const order = [...first, ...existing.map((s) => s.type).filter((t) => !first.includes(t))];
  const hide = (t: SectionType) => new RegExp(`(no|without|hide|remove|drop|不要|去掉|隐藏)\\s*(the\\s*)?${t}`, "i").test(p);
  const sections = order.map((type) => {
    const was = existing.find((s) => s.type === type);
    return { type, visible: hide(type) ? false : type === "gallery" ? (was?.visible ?? false) || mentioned.includes("gallery") : (was?.visible ?? true), title: was?.title ?? {} };
  });
  const r = input.restaurant;
  const tagline = base?.hero.tagline && Object.keys(base.hero.tagline).length ? base.hero.tagline : { en: r.description || `${r.cuisine} food, made the way we like it`, ...(r.translations.zh?.description ? { zh: r.translations.zh.description } : {}) };
  const intro = base?.hero.intro && Object.keys(base.hero.intro).length ? base.hero.intro : firstSentence(r.story) ? { en: firstSentence(r.story), ...(firstSentence(r.translations.zh?.story) ? { zh: firstSentence(r.translations.zh?.story) } : {}) } : {};
  const layout = /photo|image|picture|split|图片|照片/i.test(p) ? "split" : /banner|bold|big|poster|横幅|大/i.test(p) ? "banner" : (base?.hero.layout ?? "centered");
  const design = finish({ theme, hero: { tagline, intro, layout, image: base?.hero.image ?? null }, sections, gallery: base?.gallery ?? [], brief: p });
  return { design, notes: mood ? `Started from the “${PRESETS[mood].label.en}” look.` : "", engine: "rules" };
}

const firstSentence = (s?: string) => (s ? (s.match(/^.*?[.!?。！？](\s|$)/)?.[0] ?? s).trim().slice(0, 300) : "");

const finish = (d: Storefront): Storefront => {
  const r = StorefrontSchema.parse(d);
  return { ...r, theme: readable(r.theme) };
};

const words = { type: "object", additionalProperties: false, required: ["en", "zh"], properties: { en: { type: "string" }, zh: { type: "string" } } } as const;
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["theme", "hero", "sections", "notes"],
  properties: {
    theme: {
      type: "object",
      additionalProperties: false,
      required: ["bg", "surface", "ink", "accent", "accentInk", "font", "radius"],
      properties: {
        bg: { type: "string", description: "#rrggbb page background" },
        surface: { type: "string", description: "#rrggbb card background, close to bg" },
        ink: { type: "string", description: "#rrggbb text; at least 4.5:1 on bg and surface" },
        accent: { type: "string", description: "#rrggbb buttons and highlights" },
        accentInk: { type: "string", description: "#rrggbb text on accent; at least 4.5:1" },
        font: { type: "string", enum: [...FONT_IDS], description: "kopitiam: bold condensed poster headings; modern: clean sans; editorial: classic serif headings; rounded: friendly rounded" },
        radius: { type: "string", enum: ["sharp", "soft", "round"] },
      },
    },
    hero: {
      type: "object",
      additionalProperties: false,
      required: ["tagline", "intro", "layout"],
      properties: { tagline: { ...words, description: "Max ~10 words" }, intro: { ...words, description: "One or two sentences, true to the restaurant's own story" }, layout: { type: "string", enum: ["centered", "split", "banner"] } },
    },
    sections: {
      type: "array",
      description: "Every section type exactly once, in display order",
      items: { type: "object", additionalProperties: false, required: ["type", "visible", "title"], properties: { type: { type: "string", enum: [...SECTION_TYPES] }, visible: { type: "boolean" }, title: { ...words, description: "Optional heading; empty strings use the default" } } },
    },
    notes: { type: "string", description: "One or two sentences to the owner on the choices made, in the language they wrote in" },
  },
} as const;

async function byClaude(env: ClaudeEnv, input: DesignInput): Promise<DesignResult | null> {
  const c = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 45_000 });
  const r = input.restaurant;
  const res = await c.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 4000,
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> } },
    system:
      "You design a restaurant's one-page storefront as data for a fixed renderer: colours, a font style, corner style, hero layout, section order and short copy in English and Simplified Chinese. Follow the owner's wishes; keep text readable (4.5:1 contrast); write copy that is specific to this restaurant and never invents facts (no awards, years or claims not in their story). Sections: queue (live walk-in queue per branch, join button), menu (what's served now, signatures, happy hour), story, branches (addresses, hours, map), booking, gallery (photos the owner adds; hide it if they have none). If a current design is given, change only what the instruction asks.",
    messages: [
      {
        role: "user",
        content: `Restaurant: ${r.name}\nCuisine: ${r.cuisine}\nDescription: ${r.description || "(none)"}\nStory: ${r.story || "(none)"}\n${input.current ? `\nCurrent design:\n${JSON.stringify({ theme: input.current.theme, hero: input.current.hero, sections: input.current.sections })}\n` : ""}\nOwner's instruction: ${input.prompt}`,
      },
    ],
  } as Anthropic.MessageCreateParamsNonStreaming);
  if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") return null;
  const text = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
  if (!text) return null;
  try {
    const j = JSON.parse(text) as { theme: Storefront["theme"]; hero: { tagline: Record<string, string>; intro: Record<string, string>; layout: Storefront["hero"]["layout"] }; sections: Storefront["sections"]; notes: string };
    const seen = new Set<string>();
    const sections = [...j.sections.filter((s) => !seen.has(s.type) && seen.add(s.type)), ...DEFAULT_SECTIONS.filter((s) => !seen.has(s.type))].map((s) => ({ ...s, title: Object.fromEntries(Object.entries(s.title ?? {}).filter(([, v]) => v)) }));
    const design = finish({ theme: j.theme, hero: { ...j.hero, image: input.current?.hero.image ?? null }, sections, gallery: input.current?.gallery ?? [], brief: input.prompt.slice(0, 600) });
    return { design, notes: j.notes, engine: "claude" };
  } catch {
    return null;
  }
}

export async function designStorefront(env: ClaudeEnv, input: DesignInput): Promise<DesignResult> {
  if (claudeEnabled(env)) {
    const r = await byClaude(env, input).catch(() => null);
    if (r) return r;
  }
  return byRules(input);
}
