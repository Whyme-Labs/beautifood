// A restaurant's storefront as data: theme tokens, an ordered list of sections, and the words in
// every language. The AI designer writes this, the merchant edits it, one renderer draws it. Being
// data, not free-form HTML, it is always fast, translated, readable and impossible to break.
import { z } from "zod";

export const SECTION_TYPES = ["queue", "menu", "story", "branches", "booking", "gallery"] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export const FONT_IDS = ["kopitiam", "modern", "editorial", "rounded"] as const;
export type FontId = (typeof FONT_IDS)[number];

/** Heading and body font stacks; Chinese falls back to system faces in every stack. */
export const FONTS: Record<FontId, { heading: string; body: string; headingWeight: number; headingCase?: "uppercase" }> = {
  kopitiam: { heading: '"Big Shoulders Display", "PingFang SC", "Noto Sans SC", sans-serif', body: '"Figtree Variable", "PingFang SC", "Noto Sans SC", sans-serif', headingWeight: 800, headingCase: "uppercase" },
  modern: { heading: '"Figtree Variable", "PingFang SC", "Noto Sans SC", sans-serif', body: '"Figtree Variable", "PingFang SC", "Noto Sans SC", sans-serif', headingWeight: 850 },
  editorial: { heading: '"Iowan Old Style", "Palatino Linotype", Georgia, "Songti SC", "Noto Serif SC", serif', body: '"Figtree Variable", "PingFang SC", "Noto Sans SC", sans-serif', headingWeight: 700 },
  rounded: { heading: 'ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", "Figtree Variable", "PingFang SC", sans-serif', body: 'ui-rounded, "Figtree Variable", "PingFang SC", "Noto Sans SC", sans-serif', headingWeight: 800 },
};

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a #rrggbb colour");
/** Words in each language the storefront speaks ({ en, zh }); a missing language falls back to English. */
const words = (max: number) => z.record(z.string().regex(/^[a-z]{2}$/), z.string().trim().max(max)).default({});

export const StorefrontSchema = z
  .object({
    theme: z
      .object({
        bg: hex,
        surface: hex,
        ink: hex,
        accent: hex,
        accentInk: hex,
        font: z.enum(FONT_IDS),
        radius: z.enum(["sharp", "soft", "round"]),
      })
      .strict(),
    hero: z
      .object({
        tagline: words(120),
        intro: words(400),
        layout: z.enum(["centered", "split", "banner"]),
        image: z.string().url().max(500).nullable().default(null),
      })
      .strict(),
    sections: z
      .array(z.object({ type: z.enum(SECTION_TYPES), visible: z.boolean(), title: words(60) }).strict())
      .max(SECTION_TYPES.length)
      .refine((s) => new Set(s.map((x) => x.type)).size === s.length, "Each section once"),
    gallery: z.array(z.object({ url: z.string().url().max(500), alt: words(120) }).strict()).max(12).default([]),
    /** What the merchant asked the designer for, kept so "refine" can build on it. */
    brief: z.string().max(600).default(""),
  })
  .strict();

export type Storefront = z.infer<typeof StorefrontSchema>;
export type StorefrontTheme = Storefront["theme"];

/** Curated starting points; the designer picks one and adjusts. Each passes the contrast check. */
export const PRESETS: Record<string, { label: { en: string; zh: string }; theme: StorefrontTheme }> = {
  sunshine: { label: { en: "Sunshine stall", zh: "阳光小贩" }, theme: { bg: "#fffaf0", surface: "#ffffff", ink: "#1a1814", accent: "#ffd12e", accentInk: "#1a1814", font: "kopitiam", radius: "soft" } },
  kopitiam: { label: { en: "Old kopitiam", zh: "老咖啡店" }, theme: { bg: "#f4ecd8", surface: "#fffaf0", ink: "#1f3b2c", accent: "#1f6b45", accentInk: "#fffaf0", font: "editorial", radius: "sharp" } },
  nightMarket: { label: { en: "Night market", zh: "夜市" }, theme: { bg: "#15110f", surface: "#221b17", ink: "#f6efe6", accent: "#d23a24", accentInk: "#ffffff", font: "kopitiam", radius: "soft" } },
  minimal: { label: { en: "Clean & modern", zh: "简约现代" }, theme: { bg: "#ffffff", surface: "#f5f5f4", ink: "#111111", accent: "#111111", accentInk: "#ffffff", font: "modern", radius: "sharp" } },
  seaside: { label: { en: "Seaside", zh: "海边" }, theme: { bg: "#f2f8fb", surface: "#ffffff", ink: "#0d2b3e", accent: "#0f6e9e", accentInk: "#ffffff", font: "rounded", radius: "round" } },
  terracotta: { label: { en: "Terracotta kitchen", zh: "陶土厨房" }, theme: { bg: "#fbf3ec", surface: "#ffffff", ink: "#3a1f14", accent: "#b6542f", accentInk: "#ffffff", font: "editorial", radius: "soft" } },
  pastel: { label: { en: "Pastel café", zh: "粉彩咖啡馆" }, theme: { bg: "#fdf6f8", surface: "#ffffff", ink: "#3b2a33", accent: "#b23d6a", accentInk: "#ffffff", font: "rounded", radius: "round" } },
  mamak: { label: { en: "Mamak bright", zh: "嘛嘛档" }, theme: { bg: "#fff6ea", surface: "#ffffff", ink: "#2a1a08", accent: "#e46a00", accentInk: "#1a0f04", font: "modern", radius: "round" } },
};

export const DEFAULT_SECTIONS: Storefront["sections"] = [
  { type: "queue", visible: true, title: {} },
  { type: "menu", visible: true, title: {} },
  { type: "story", visible: true, title: {} },
  { type: "branches", visible: true, title: {} },
  { type: "booking", visible: true, title: {} },
  { type: "gallery", visible: false, title: {} },
];

/** What a restaurant has before anyone designs anything: its own name and story, the house look. */
export function defaultStorefront(r: { description?: string; story?: string }): Storefront {
  return {
    theme: PRESETS.sunshine.theme,
    hero: { tagline: r.description ? { en: r.description } : {}, intro: {}, layout: "centered", image: null },
    sections: DEFAULT_SECTIONS,
    gallery: [],
    brief: "",
  };
}

// ── contrast (WCAG 2) ───────────────────────────────────────────────────────

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
export function luminance(hexColor: string) {
  const n = parseInt(hexColor.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/**
 * Make a theme readable whatever the designer (or the merchant) picked: body text on the background
 * and on cards needs 4.5:1, and the button text on the accent 4.5:1. Failing pairs get black or
 * white text, whichever reads better; the colours they chose stay.
 */
export function readable(t: StorefrontTheme): StorefrontTheme {
  const best = (on: string) => (contrast("#111111", on) >= contrast("#ffffff", on) ? "#111111" : "#ffffff");
  const ink = contrast(t.ink, t.bg) >= 4.5 && contrast(t.ink, t.surface) >= 4.5 ? t.ink : best(t.bg);
  const accentInk = contrast(t.accentInk, t.accent) >= 4.5 ? t.accentInk : best(t.accent);
  return { ...t, ink, accentInk };
}

/** The words in a language, falling back to English, then any language there is. */
export const say = (w: Record<string, string> | undefined, locale: string) => (w && (w[locale] || w.en || Object.values(w).find(Boolean))) || "";
