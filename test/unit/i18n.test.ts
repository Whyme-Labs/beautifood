// i18n: catalogs stay in step, formatting follows the locale, and guest-facing
// server output (emails, the offline assistant, glossary translation) is localised.
import { describe, it, expect } from "vitest";
import en from "../../src/i18n/locales/en";
import zh from "../../src/i18n/locales/zh";
import { formatters, matchLocale, translate } from "../../src/i18n/core";
import { localizeItem } from "../../src/shared/menuI18n";
import { glossary } from "../../src/server/ai/translate";
import { answerLocally, type AssistantContext } from "../../src/server/ai/local";
import { bookingMail, otpMail, receiptMail, ticketCalledMail } from "../../src/server/emails";
import type { MenuItem } from "../../src/shared/types";

type Tree = { [k: string]: string | Tree };
function leaves(t: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(t)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.set(key, v);
    else for (const [kk, vv] of leaves(v, key)) out.set(kk, vv);
  }
  return out;
}
const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("catalogs", () => {
  const E = leaves(en as unknown as Tree);
  const Z = leaves(zh as unknown as Tree);

  it("have the same keys", () => {
    expect([...Z.keys()].sort()).toEqual([...E.keys()].sort());
  });

  it("use the same variables in every string, and none is empty", () => {
    for (const [k, v] of E) {
      expect(v.trim(), k).not.toBe("");
      expect(Z.get(k)!.trim(), k).not.toBe("");
      // plural forms may drop {count} (e.g. "one" in English), so compare per leaf only when both use vars
      const ev = new Set(vars(v));
      for (const name of vars(Z.get(k)!)) expect(ev.has(name) || name === "count", `${k} uses {${name}}`).toBe(true);
    }
  });
});

describe("core", () => {
  it("matches browser and header preferences", () => {
    expect(matchLocale(["zh-CN", "en"])).toBe("zh");
    expect(matchLocale(["zh-Hant-TW"])).toBe("zh");
    expect(matchLocale(["fr-FR"])).toBe("en");
    expect(matchLocale(["", null, "EN-us"])).toBe("en");
  });

  it("interpolates, pluralises and falls back", () => {
    expect(translate("en", "ticket.ahead", { count: 1 })).not.toBe(translate("en", "ticket.ahead", { count: 3 }));
    expect(translate("zh", "common.close")).toBe("关闭");
    expect(translate("xx", "common.close")).toBe("Close");
    expect(translate("en", "no.such.key")).toBe("no.such.key");
  });

  it("formats money the same way in both languages", () => {
    expect(formatters("en").money(1690)).toBe("RM16.90");
    expect(formatters("zh").money(123450)).toBe("RM1,234.50");
    expect(formatters("en").money(-500)).toBe("-RM5.00");
  });
});

const item = (over: Partial<MenuItem>): MenuItem => ({
  id: "i1",
  categoryId: "c1",
  name: "Char Kway Teow",
  description: "Wok-fried flat rice noodles with prawns",
  price: 1290,
  imageUrl: null,
  allergens: ["crustaceans", "egg", "soy"],
  dietary: [],
  spiceLevel: 1,
  story: "",
  isSignature: true,
  tags: [],
  station: "kitchen",
  modifiers: [],
  active: true,
  sort: 1,
  ...over,
});

describe("menu translations", () => {
  it("glossary knows hawker dishes and comma-separated descriptions", () => {
    expect(glossary("Char Kway Teow", "zh")).toBe("炒粿条");
    expect(glossary("egg noodles, char siu, prawn wontons", "zh")).toBe("蛋面、叉烧、鲜虾云吞");
    expect(glossary("Quantum Soup", "zh")).toBeNull();
    expect(glossary("Char Kway Teow", "fr")).toBeNull();
  });

  it("localizes an item and keeps the original name for staff", () => {
    const it = item({ translations: { zh: { name: "炒粿条", description: "镬气炒河粉配大虾", source: "glossary" } } as MenuItem["translations"] });
    const l = localizeItem(it, "zh", "en");
    expect(l.name).toBe("炒粿条");
    expect(l.original).toBe("Char Kway Teow");
    expect(localizeItem(it, "en", "en")).toMatchObject({ name: "Char Kway Teow", original: null });
  });
});

describe("offline assistant in Chinese", () => {
  const ctx: AssistantContext = {
    restaurant: { name: "Auntie Mei's", cuisine: "Penang hawker", story: "", description: "" },
    branchName: "KLCC",
    currency: "MYR",
    menuLanguage: "en",
    items: [
      item({ translations: { zh: { name: "炒粿条" } } as MenuItem["translations"] }),
      item({ id: "i2", name: "Satay (6 sticks)", allergens: ["peanuts"], isSignature: false, spiceLevel: 0, translations: { zh: { name: "沙爹（6 串）" } } as MenuItem["translations"] }),
      item({ id: "i3", name: "Garden Salad", allergens: [], dietary: ["vegetarian", "vegan"], isSignature: false, spiceLevel: 0, translations: { zh: { name: "田园沙拉" } } as MenuItem["translations"] }),
    ],
  };

  it("answers an allergen question about a dish named in Chinese", () => {
    const r = answerLocally(ctx, "炒粿条含花生吗？", "zh");
    expect(r.items[0].name).toBe("Char Kway Teow"); // original name, for ordering
    expect(r.answer).toContain("炒粿条");
    expect(r.answer).toContain("甲壳类");
    expect(r.safetyNote).toMatch(/店员/);
  });

  it("filters for peanut allergies and vegetarians", () => {
    const nuts = answerLocally(ctx, "我对花生过敏，有什么推荐？", "zh");
    expect(nuts.items.map((i) => i.id)).not.toContain("i2");
    const veg = answerLocally(ctx, "有素食吗", "zh");
    expect(veg.items.map((i) => i.id)).toEqual(["i3"]);
    expect(veg.answer).toContain("田园沙拉");
  });

  it("still answers in English by default", () => {
    const r = answerLocally(ctx, "I'm allergic to peanuts", "en");
    expect(r.safetyNote).toMatch(/confirm with staff/);
    expect(r.answer).toMatch(/free of peanuts/);
  });
});

describe("guest emails", () => {
  it("sign-in code subject starts with the code in every language", () => {
    expect(otpMail("en", "Auntie Mei's", "123456").subject).toMatch(/^123456 is your/);
    expect(otpMail("zh", "Auntie Mei's", "123456").subject).toMatch(/^123456 是你的/);
    expect(otpMail("xx", "Auntie Mei's", "123456").subject).toMatch(/^123456 is your/);
  });

  it("escapes guest-supplied text", () => {
    const m = ticketCalledMail("en", { restaurant: "<b>Mei</b>", branch: "KLCC", number: "A012", tables: ["T4"], holdMinutes: 5, url: null });
    expect(m.html).not.toContain("<b>Mei</b>");
    expect(m.html).toContain("&lt;b&gt;Mei&lt;/b&gt;");
  });

  it("writes bookings and receipts in Chinese", () => {
    const b = bookingMail("zh", { restaurant: "Auntie Mei's", branch: "KLCC", name: "Ali", partySize: 4, slotStart: Date.UTC(2026, 9, 20, 11, 0), timezone: "Asia/Kuala_Lumpur", url: "https://x/booking/1?k=t" });
    expect(b.subject).toBe("订位成功：Auntie Mei'sKLCC");
    expect(b.text).toContain("4 位订位已确认");
    const r = receiptMail("zh", {
      restaurant: "Auntie Mei's",
      branch: "KLCC",
      address: "",
      orderNumber: "0042",
      type: "dine_in",
      tables: ["T4"],
      closedAt: Date.UTC(2026, 9, 18, 6, 0),
      currency: "MYR",
      timezone: "Asia/Kuala_Lumpur",
      items: [{ name: "Char Kway Teow", qty: 2, unitPrice: 1290, modifiers: [], lineTotal: 2580 }],
      subtotal: 2580,
      discount: 0,
      discountLabel: null,
      serviceCharge: 258,
      serviceChargePct: 10,
      tax: 0,
      taxPct: 0,
      rounding: 0,
      total: 2838,
      payments: [{ method: "cash", amount: 2838, change: 162, splitLabel: null }],
      points: null,
      url: "https://x/receipt/t",
    });
    expect(r.subject).toBe("Auntie Mei's 的收据：RM28.38");
    expect(r.html).toContain("现金");
    expect(r.html).toContain('lang="zh"');
  });
});
