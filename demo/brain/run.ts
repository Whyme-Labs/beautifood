// The menu brain on two realistic all-day menus, at several moments of the week, through the same
// path the app uses: the merchant's menu → schedule.menuNow at a branch-local time → the assistant
// context → the brain (and the three-layer model input, to show what a language model would get).
//
//   npx tsx demo/brain/run.ts            writes demo/brain/out/transcripts.json and prints a summary
import { mkdirSync, writeFileSync } from "node:fs";
import type { Clock } from "../../src/shared/schedule";
import { answerGuest } from "../../src/server/ai/brain";
import { catalog, catalogKey, GUIDE, now } from "../../src/server/ai/menuInput";
import { contextAt, KOPI_KAKI, SAKE_SMOKE, type DemoMenu } from "../../src/server/ai/demoMenus";

const DIR = new URL(".", import.meta.url).pathname;

const at = (weekday: number, hhmm: string, date: string): Clock => ({ weekday, minutes: Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)), date });
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Scene {
  menu: DemoMenu;
  clock: Clock;
  title: string;
  /** One conversation per entry: its questions in order. */
  conversations: { lang: "en" | "zh"; turns: string[] }[];
}

export const SCENES: Scene[] = [
  {
    menu: KOPI_KAKI,
    clock: at(6, "09:15", "2026-10-24"),
    title: "Saturday breakfast, durian weekend promo",
    conversations: [
      { lang: "en", turns: ["Morning! What's good for breakfast?", "any promo today?", "Can I get the claypot chicken rice set?"] },
      { lang: "en", turns: ["I'm allergic to peanuts, what breakfast can I have?", "which one is cheapest?"] },
      { lang: "en", turns: ["anything seasonal?", "durian cendol ada susu tak? sy alergi susu"] },
    ],
  },
  {
    menu: KOPI_KAKI,
    clock: at(3, "12:10", "2026-10-21"),
    title: "Wednesday lunch, lunch-set promo until 1pm",
    conversations: [
      { lang: "en", turns: ["what lunch sets do you have?", "any vegetarian one?", "is the curry laksa set spicy?"] },
      { lang: "zh", turns: ["今天有什么优惠？", "我对海鲜过敏，午餐套餐推荐哪个？"] },
    ],
  },
  {
    menu: KOPI_KAKI,
    clock: at(3, "16:20", "2026-10-21"),
    title: "Wednesday 4pm, happy hour drinks",
    conversations: [
      { lang: "en", turns: ["happy hour drinks?", "something not sweet please", "Can I still order breakfast?"] },
      { lang: "en", turns: ["3 of us, RM60 budget, what should we order?"] },
    ],
  },
  {
    menu: SAKE_SMOKE,
    clock: at(2, "18:05", "2026-10-20"),
    title: "Tuesday 6pm: happy hour + Skewer Tuesday + autumn menu",
    conversations: [
      { lang: "en", turns: ["What deals are on tonight?", "I'm allergic to shellfish. Which skewers can I have?", "and the second one, got sesame?"] },
      { lang: "en", turns: ["I don't drink alcohol, what goes with yakitori?", "what's in season?"] },
      { lang: "zh", turns: ["有什么秋季限定？", "深夜食堂几点开始？"] },
    ],
  },
  {
    menu: SAKE_SMOKE,
    clock: at(5, "23:40", "2026-10-23"),
    title: "Friday 11:40pm: late-night menu only",
    conversations: [
      { lang: "en", turns: ["still serving food? what's on the late night menu?", "any happy hour now?", "vegetarian options?"] },
    ],
  },
];

export function runDemo() {
  return SCENES.map((s) => {
    const ctx = contextAt(s.menu, s.clock);
    const cat = catalog(ctx);
    return {
      restaurant: s.menu.name,
      title: s.title,
      when: `${DAYS[s.clock.weekday]} ${String(Math.floor(s.clock.minutes / 60)).padStart(2, "0")}:${String(s.clock.minutes % 60).padStart(2, "0")}, ${s.clock.date}`,
      catalogKey: catalogKey(cat),
      now: { en: now(ctx, "en", s.clock), zh: now(ctx, "zh", s.clock) },
      conversations: s.conversations.map((c) => {
        const history: { role: "user" | "assistant"; content: string }[] = [];
        return {
          lang: c.lang,
          turns: c.turns.map((q) => {
            history.push({ role: "user", content: q });
            const r = answerGuest(ctx, history, c.lang);
            history.push({ role: "assistant", content: r.answer });
            return { q, a: r.answer, intent: r.intent, confidence: Math.round((r.confidence ?? 0) * 100) / 100, cards: r.items.map((i) => ({ name: i.name, price: i.price })), safety: !!r.safetyNote };
          }),
        };
      }),
    };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = runDemo();
  mkdirSync(`${DIR}out`, { recursive: true });
  const k = KOPI_KAKI, s = SAKE_SMOKE;
  const layers = [k, s].map((m) => {
    const ctx = contextAt(m, at(3, "12:10", "2026-10-21"));
    return { restaurant: m.name, guide: GUIDE, catalog: catalog(ctx), dishes: ctx.items.length };
  });
  writeFileSync(`${DIR}out/transcripts.json`, JSON.stringify({ scenes: out, layers }, null, 1));
  for (const sc of out) {
    console.log(`\n=== ${sc.restaurant} · ${sc.title} (${sc.when})\n${sc.now.en}`);
    for (const c of sc.conversations) for (const t of c.turns) console.log(`  Q: ${t.q}\n  A: ${t.a}\n     [${t.intent} ${t.confidence}] cards: ${t.cards.map((x) => x.name).join(", ") || "—"}${t.safety ? " · safety note" : ""}`);
  }
}
