// The storefront as data: presets are readable, the contrast fixer keeps chosen colours, and the
// designer (rules path, used without Claude) turns a description into a valid design.
import { describe, expect, it } from "vitest";
import { PRESETS, StorefrontSchema, contrast, defaultStorefront, readable } from "../../src/shared/storefront";
import { designStorefront } from "../../src/server/ai/storefront";

const restaurant = { name: "Auntie Lim's Kitchen", cuisine: "Malaysian", description: "Penang hawker classics, charcoal wok-hei.", story: "Started in 1998 as a Penang hawker stall. Today we cook the same recipes.", translations: { zh: { description: "槟城小贩经典，炭火镬气。", story: "1998 年从槟城小贩摊起家。如今仍用同样的菜谱。" } } };

describe("themes stay readable", () => {
  it("every preset passes 4.5:1 for text and button text", () => {
    for (const [id, p] of Object.entries(PRESETS)) {
      expect(contrast(p.theme.ink, p.theme.bg), `${id} ink/bg`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.theme.ink, p.theme.surface), `${id} ink/surface`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.theme.accentInk, p.theme.accent), `${id} button`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("an unreadable pick gets black or white text, and keeps its colours", () => {
    const t = readable({ ...PRESETS.sunshine.theme, bg: "#222222", surface: "#2a2a2a", ink: "#333333", accent: "#ffd12e", accentInk: "#ffee88" });
    expect(t.bg).toBe("#222222");
    expect(t.accent).toBe("#ffd12e");
    expect(t.ink).toBe("#ffffff");
    expect(t.accentInk).toBe("#111111");
  });
});

describe("the designer (rules)", () => {
  const env = { ANTHROPIC_MODEL: "x" };

  it("a kopitiam brief with the story first", async () => {
    const r = await designStorefront(env, { prompt: "A 1960s kopitiam feel, green and cream, put our story first", restaurant, locales: ["en", "zh"] });
    expect(r.engine).toBe("rules");
    expect(StorefrontSchema.safeParse(r.design).success).toBe(true);
    expect(r.design.theme.bg).toBe("#f4ecd8");
    expect(r.design.theme.accent).toBe("#1f6b45");
    expect(r.design.sections[0]).toMatchObject({ type: "story", visible: true });
    expect(r.design.hero.tagline).toEqual({ en: restaurant.description, zh: restaurant.translations.zh.description });
    expect(r.design.hero.intro.en).toBe("Started in 1998 as a Penang hawker stall.");
  });

  it("refining keeps what wasn't mentioned and changes what was", async () => {
    const base = (await designStorefront(env, { prompt: "kopitiam, story first", restaurant, locales: ["en"] })).design;
    const r = await designStorefront(env, { prompt: "make it dark with red, and hide the gallery", current: base, restaurant, locales: ["en"] });
    expect(r.design.theme.bg).toBe(PRESETS.nightMarket.theme.bg);
    expect(r.design.sections.map((s) => s.type)).toEqual(base.sections.map((s) => s.type));
    expect(r.design.sections.find((s) => s.type === "gallery")?.visible).toBe(false);
    expect(r.design.hero.tagline).toEqual(base.hero.tagline);
  });

  it("the house design before anyone designs anything is valid", () => {
    expect(StorefrontSchema.safeParse(defaultStorefront(restaurant)).success).toBe(true);
  });
});
