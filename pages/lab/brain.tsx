// Menu brain lab (/lab/brain): the guest assistant's menu brain on two all-day demo menus, at any
// moment of the week. Everything runs in this browser: the same schedule code the app uses decides
// what's served and what's on a deal at the chosen time, and the brain answers (no model, no
// tokens). "What a model would get" shows the three-layer input a language model is sent when one
// answers instead (docs/ai-menu-input.md), with its estimated size and cache key.
import { useMemo, useState } from "react";
import { GuestBar } from "../../src/ui/guest";
import { answerGuest } from "../../src/server/ai/brain";
import { catalog, catalogKey, GUIDE, now as nowText } from "../../src/server/ai/menuInput";
import { contextAt, DEMO_MENUS } from "../../src/server/ai/demoMenus";
import { clockLabel, type Clock } from "../../src/shared/schedule";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const rm = (minor: number) => `RM${(minor / 100).toFixed(2)}`;
/** The estimate the token comparison uses: about 4 characters a token, 1 per CJK character. */
const tokens = (s: string) => {
  const cjk = (s.match(/[　-鿿＀-￯]/g) ?? []).length;
  return Math.round(cjk + (s.length - cjk) / 4);
};

interface Moment {
  label: string;
  date: string;
  time: string;
  questions: { en: string[]; zh: string[] };
}

/** Moments worth trying on each menu, with questions that show what changes with the time. */
const MOMENTS: Record<string, Moment[]> = {
  "kopi-kaki": [
    { label: "Sat breakfast", date: "2026-10-24", time: "09:15", questions: { en: ["Morning! What's good for breakfast?", "any promo today?", "Can I get the claypot chicken rice set?", "I'm allergic to peanuts, what breakfast can I have?", "anything seasonal?"], zh: ["早餐吃什么好？", "今天有什么优惠？", "我对花生过敏，早餐可以吃什么？"] } },
    { label: "Wed lunch promo", date: "2026-10-21", time: "12:10", questions: { en: ["what lunch sets do you have?", "any vegetarian one?", "is the curry laksa set spicy?", "durian cendol ada susu tak? sy alergi susu"], zh: ["今天有什么优惠？", "我对海鲜过敏，午餐套餐推荐哪个？"] } },
    { label: "Wed happy hour", date: "2026-10-21", time: "16:20", questions: { en: ["happy hour drinks?", "just one drink, not too sweet, under RM5", "Can I still order breakfast?", "3 of us, RM60 budget, what should we order?"], zh: ["有什么饮料特价？", "还可以点早餐吗？"] } },
    { label: "Sat durian weekend", date: "2026-10-24", time: "14:00", questions: { en: ["any durian promo?", "what's in the durian crepe cake?", "no dairy please, any durian dessert?"], zh: ["榴莲有优惠吗？", "我不吃奶制品，有什么榴莲甜品？"] } },
    { label: "After the season (Dec)", date: "2026-12-05", time: "14:00", questions: { en: ["anything seasonal?", "do you have durian cendol?"], zh: ["有季节限定吗？"] } },
  ],
  "sake-smoke": [
    { label: "Tue 6pm deals", date: "2026-10-20", time: "18:05", questions: { en: ["What deals are on tonight?", "I'm allergic to shellfish. Which skewers can I have?", "and the second one, got sesame?", "I don't drink alcohol, what goes with yakitori?"], zh: ["今晚有什么优惠？", "有什么秋季限定？"] } },
    { label: "Fri late night", date: "2026-10-23", time: "23:40", questions: { en: ["still serving food? what's on the late night menu?", "any happy hour now?", "vegetarian options?"], zh: ["深夜食堂有什么？", "现在有优惠吗？"] } },
    { label: "Thu 8pm autumn", date: "2026-10-22", time: "20:00", questions: { en: ["what's in season?", "is the grilled sanma spicy?", "can I get the midnight ramen?"], zh: ["有什么秋季限定？", "深夜食堂几点开始？"] } },
  ],
};

const clockOf = (date: string, time: string): Clock => ({
  weekday: new Date(`${date}T00:00:00Z`).getUTCDay(),
  minutes: Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)),
  date,
});

type Turn = { role: "user" | "assistant"; content: string; reply?: ReturnType<typeof answerGuest> };

export default function BrainLab() {
  const [menuId, setMenuId] = useState(DEMO_MENUS[0].id);
  const [date, setDate] = useState(MOMENTS[DEMO_MENUS[0].id][0].date);
  const [time, setTime] = useState(MOMENTS[DEMO_MENUS[0].id][0].time);
  const [lang, setLang] = useState<"en" | "zh">("en");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [showInput, setShowInput] = useState(false);

  const menu = DEMO_MENUS.find((m) => m.id === menuId)!;
  const clock = useMemo(() => clockOf(date, time), [date, time]);
  const ctx = useMemo(() => contextAt(menu, clock), [menu, clock]);
  const cat = useMemo(() => catalog(ctx), [ctx]);
  const now = useMemo(() => nowText(ctx, lang, clock), [ctx, lang, clock]);
  const moments = MOMENTS[menuId];
  const moment = moments.find((m) => m.date === date && m.time === time);

  const reset = (next: () => void) => {
    next();
    setTurns([]);
  };
  const ask = (q: string) => {
    const text = q.trim();
    if (!text) return;
    const history = [...turns.map((t) => ({ role: t.role, content: t.content })), { role: "user" as const, content: text }];
    const reply = answerGuest(ctx, history, lang);
    setTurns([...turns, { role: "user", content: text }, { role: "assistant", content: reply.answer, reply }]);
    setDraft("");
  };

  const onNow = ctx.now?.menus ?? [];
  const deals = ctx.now?.deals ?? [];
  const menuName = (id: string) => ctx.menus?.find((m) => m.id === id)?.name ?? id;
  const at = (hhmm: string | null) => (hhmm ? clockLabel(hhmm, "en") : "");

  return (
    <>
      <GuestBar>Menu brain lab</GuestBar>
      <main className="narrow col" style={{ gap: 18 }}>
        <section>
          <h1 style={{ marginBottom: 6 }}>Ask a restaurant's menu, at any hour</h1>
          <p className="muted" style={{ margin: 0 }}>
            Two all-day demo menus with breakfast, lunch sets, dinner, late night, a dated season, happy hours and promotions. Pick a moment of the week and ask in English, Malay, Manglish or Chinese. The menu brain answers right here in your browser, with no AI model and no tokens.
          </p>
        </section>

        <section className="card col" data-testid="brain-setup">
          <div className="segmented" role="tablist" aria-label="Restaurant">
            {DEMO_MENUS.map((m) => (
              <button key={m.id} type="button" role="tab" aria-selected={m.id === menuId} onClick={() => reset(() => (setMenuId(m.id), setDate(MOMENTS[m.id][0].date), setTime(MOMENTS[m.id][0].time)))}>
                {m.name}
              </button>
            ))}
          </div>
          <p className="hint" style={{ margin: 0 }}>{menu.cuisine}. {menu.story}</p>
          <div className="chips" role="group" aria-label="Moments">
            {moments.map((m) => (
              <button key={m.label} type="button" className="chip" aria-pressed={m === moment} onClick={() => reset(() => (setDate(m.date), setTime(m.time)))}>
                {m.label}
              </button>
            ))}
          </div>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <label className="col tight">
              <span className="hint">Date</span>
              <input id="brain-date" type="date" value={date} onChange={(e) => e.target.value && reset(() => setDate(e.target.value))} />
            </label>
            <label className="col tight">
              <span className="hint">Time</span>
              <input id="brain-time" type="time" value={time} onChange={(e) => e.target.value && reset(() => setTime(e.target.value))} />
            </label>
            <div className="col tight">
              <span className="hint">Replies in</span>
              <div className="segmented" role="tablist" aria-label="Reply language">
                {(["en", "zh"] as const).map((l) => (
                  <button key={l} type="button" role="tab" aria-selected={lang === l} onClick={() => reset(() => setLang(l))}>
                    {l === "en" ? "English" : "中文"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="card col" data-testid="brain-now">
          <div className="row between">
            <h2 style={{ margin: 0 }}>
              {DAYS[clock.weekday]} {at(time)}, {date}
            </h2>
            <span className="badge">{ctx.items.filter((i) => i.servedNow !== false).length} of {ctx.items.length} dishes served now</span>
          </div>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            {onNow.length ? onNow.map((m) => <span key={m.id} className="badge ok">{menuName(m.id)}{m.until ? ` until ${at(m.until)}` : ""}</span>) : <span className="badge">All-day dishes only</span>}
            {deals.map((d) => <span key={d.id} className="badge deal">{d.name}{d.until ? ` until ${at(d.until)}` : ""}</span>)}
            {!deals.length && <span className="badge">No deal on now</span>}
          </div>
        </section>

        <section className="card col" data-testid="brain-chat">
          <div className="chips" role="group" aria-label="Try asking">
            {(moment?.questions[lang] ?? []).map((q) => (
              <button key={q} type="button" className="chip" onClick={() => ask(q)}>
                {q}
              </button>
            ))}
          </div>
          <div className="chat" style={{ maxHeight: "none" }}>
            {!turns.length && <div className="bubble bot muted">Tap a question above or type your own.</div>}
            {turns.map((t, n) =>
              t.role === "user" ? (
                <div key={n} className="bubble user">{t.content}</div>
              ) : (
                <div key={n} className="bubble bot col tight" style={{ whiteSpace: "normal" }}>
                  <span style={{ whiteSpace: "pre-wrap" }}>{t.content}</span>
                  {!!t.reply?.items.length && (
                    <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                      {t.reply.items.map((i) => {
                        const d = ctx.items.find((x) => x.id === i.id);
                        return (
                          <span key={i.id} className="badge info">
                            {i.name} · {rm(i.price)}
                            {d?.listPrice && d.listPrice > d.price ? <s style={{ opacity: 0.7 }}> {rm(d.listPrice)}</s> : null}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                    <span className="hint">
                      {t.reply?.intent} · confidence {(t.reply?.confidence ?? 0).toFixed(2)}
                    </span>
                    {t.reply?.safetyNote && <span className="badge warn">allergy note</span>}
                  </div>
                </div>
              ),
            )}
          </div>
          <form
            className="row nowrap"
            style={{ gap: 8 }}
            onSubmit={(e) => {
              e.preventDefault();
              ask(draft);
            }}
          >
            <input id="brain-question" className="grow" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={lang === "en" ? "Ask about the menu…" : "问问菜单…"} maxLength={400} />
            <button className="btn primary" type="submit" disabled={!draft.trim()}>
              Ask
            </button>
            {!!turns.length && (
              <button className="btn ghost" type="button" onClick={() => setTurns([])}>
                Clear
              </button>
            )}
          </form>
        </section>

        <section className="card col" data-testid="brain-input">
          <div className="row between">
            <h2 style={{ margin: 0 }}>What a model would get</h2>
            <button className="btn ghost" type="button" onClick={() => setShowInput(!showInput)} aria-expanded={showInput}>
              {showInput ? "Hide" : "Show"}
            </button>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            When a language model answers instead of the brain, it gets the menu in three layers, from most to least stable, so the provider's prompt cache can reuse them. The guide is the same for every restaurant. The catalog is this branch's whole week, the same at every hour and in every language. Only NOW changes, and it's sent last.
          </p>
          <dl className="kv">
            <dt>Guide</dt>
            <dd>~{tokens(GUIDE)} tokens · cached, shared by every restaurant</dd>
            <dt>Catalog</dt>
            <dd>
              ~{tokens(cat)} tokens · cached · key <code>{catalogKey(cat)}</code> (change the time or language: it stays the same)
            </dd>
            <dt>NOW</dt>
            <dd>~{tokens(now)} tokens · sent fresh each request</dd>
          </dl>
          <pre className="card sunk" style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12.5 }}>{now}</pre>
          {showInput && (
            <>
              <h3 style={{ margin: 0 }}>Catalog</h3>
              <pre className="card sunk" style={{ margin: 0, overflowX: "auto", fontSize: 12, maxHeight: 420 }}>{cat}</pre>
              <h3 style={{ margin: 0 }}>Guide</h3>
              <pre className="card sunk" style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12, maxHeight: 420, overflow: "auto" }}>{GUIDE}</pre>
            </>
          )}
        </section>

        <section className="card col">
          <h2 style={{ margin: 0 }}>How it scores</h2>
          <p className="muted" style={{ margin: 0 }}>
            On a 510-question held-out benchmark written by people who never saw the code (10 menus, 4 of them new to the brain): 84.5% of answers pass. 2 answers broke an allergy or diet the guest stated, down from 50 for the version before. Dishes and allergens here come from the menu parser, as for a merchant at onboarding, before the merchant reviews them.
          </p>
        </section>
      </main>
    </>
  );
}
