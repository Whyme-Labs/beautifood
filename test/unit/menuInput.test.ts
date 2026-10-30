import { describe, expect, it } from "vitest";
import { catalog, catalogKey, GUIDE, now } from "../../src/server/ai/menuInput";
import { layout } from "../../src/server/ai/claude";
import { answerGuest } from "../../src/server/ai/brain";
import type { Clock } from "../../src/shared/schedule";
import { contextAt, KOPI_KAKI, SAKE_SMOKE } from "../../src/server/ai/demoMenus";

const at = (weekday: number, hhmm: string, date: string): Clock => ({ weekday, minutes: Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)), date });
const MOMENTS = [at(1, "08:30", "2026-10-19"), at(3, "12:10", "2026-10-21"), at(3, "16:20", "2026-10-21"), at(5, "23:40", "2026-10-23"), at(6, "09:15", "2026-10-24")];
const ask = (ctx: ReturnType<typeof contextAt>, q: string, locale = "en") => answerGuest(ctx, [{ role: "user", content: q }], locale);

describe("the model input: cached layers", () => {
  it("renders one branch's catalog the same at every hour, so one cache entry serves the week", () => {
    for (const m of [KOPI_KAKI, SAKE_SMOKE]) {
      const keys = new Set(MOMENTS.map((c) => catalogKey(catalog(contextAt(m, c)))));
      expect(keys.size, m.name).toBe(1);
    }
  });

  it("keeps the guide free of anything about one restaurant, time or language", () => {
    expect(GUIDE).not.toMatch(/Kopi|Sake|\d{4}-\d{2}-\d{2}|English|Chinese/);
  });

  it("lists the whole week in the catalog: dishes not served now, seasons with dates, deals with windows", () => {
    const cat = catalog(contextAt(KOPI_KAKI, at(3, "16:20", "2026-10-21")));
    expect(cat).toMatch(/Kaya Butter Toast Set \/ 咖椰牛油吐司套餐 \| 8\.90 \| \* v h gl eg mi/); // breakfast, at 4pm
    expect(cat).toMatch(/Durian season \/ 榴莲季: daily 11:00-22:00 2026-10-01\.\.2026-11-30/);
    expect(cat).toMatch(/Happy hour drinks -30%: -30% on Drinks: Mon-Fri 15:00-18:00/);
    expect(cat).not.toMatch(/2\.45/); // list prices only: the deal price is NOW's
  });

  it("puts the moment, the deal prices and the reply language in NOW only", () => {
    const ctx = contextAt(KOPI_KAKI, at(3, "16:20", "2026-10-21"));
    const n = now(ctx, "zh", ctx.clock!);
    expect(n).toMatch(/^NOW time Wed 16:20 2026-10-21/);
    expect(n).toMatch(/deals %\d until 18:00: d\d+ 2\.45/); // Kopi O at 30% off
    expect(n).toMatch(/reply in Simplified Chinese/);
  });

  it("lays out Claude's request with the volatile part last", () => {
    const ctx = contextAt(SAKE_SMOKE, at(2, "18:05", "2026-10-20"));
    const { system, messages, tools } = layout(ctx, [{ role: "user", content: "deals?" }, { role: "assistant", content: "…" }, { role: "user", content: "and for shellfish allergy?" }], "en");
    expect(system.map((b) => b.cache_control?.type)).toEqual(["ephemeral", "ephemeral"]);
    expect(system[1].text).toBe(catalog(ctx));
    expect(tools).toEqual([]); // a normal menu is inline, no tool round trips
    const last = messages[messages.length - 1].content as { text: string }[];
    expect(last[0].text).toMatch(/^NOW /);
    expect((messages[messages.length - 2].content as { cache_control?: unknown }[])[0].cache_control).toBeTruthy();
  });
});

describe("the menu brain on timed menus, seasons and deals", () => {
  it("answers 'any promo?' with what's on now and the usual price, or when the next deal starts", () => {
    const hh = ask(contextAt(KOPI_KAKI, at(3, "16:20", "2026-10-21")), "any promo now?");
    expect(hh.answer).toMatch(/Happy hour drinks -30%.*until 6:00\s?PM.*Kopi O Kosong \(RM2\.45, usually RM3\.50\)/);
    const none = ask(contextAt(SAKE_SMOKE, at(5, "23:40", "2026-10-23")), "any happy hour now?");
    expect(none.answer).toMatch(/No deals on right now\. Happy hour beer & highballs -30% \(Mon, Tue, Wed, Thu, Fri, Sat 5:00\s?PM–7:30\s?PM\) starts from Sat 5:00\s?PM/);
  });

  it("serves a timed menu while it's on, and says when it's served when it isn't", () => {
    expect(ask(contextAt(KOPI_KAKI, at(6, "09:15", "2026-10-24")), "what's good for breakfast?").items.map((i) => i.name)).toContain("Kaya Butter Toast Set");
    const later = ask(contextAt(KOPI_KAKI, at(3, "16:20", "2026-10-21")), "can I still order breakfast?");
    expect(later.answer).toMatch(/Breakfast is served daily 7:00\s?AM–11:00\s?AM\. It starts from Thu 7:00\s?AM/);
    expect(later.items.map((i) => i.name)).not.toContain("Kaya Butter Toast Set");
  });

  it("knows a season by its dates", () => {
    const inSeason = ask(contextAt(KOPI_KAKI, at(3, "12:10", "2026-10-21")), "anything seasonal?");
    expect(inSeason.items.map((i) => i.name)).toContain("Musang King Durian Cendol");
    const after = ask(contextAt(KOPI_KAKI, at(3, "12:10", "2026-12-02")), "anything seasonal?");
    expect(after.items.map((i) => i.name)).not.toContain("Musang King Durian Cendol");
  });

  it("gives no card for a dish that isn't served now, and says when it is", () => {
    const r = ask(contextAt(KOPI_KAKI, at(6, "09:15", "2026-10-24")), "Can I get the claypot chicken rice set?");
    expect(r.items).toEqual([]);
    expect(r.answer).toMatch(/Weekday lunch sets menu, served from Mon 11:30\s?AM/);
  });
});
