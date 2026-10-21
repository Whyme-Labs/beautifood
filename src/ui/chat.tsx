// The AI menu assistant chat panel (customer-facing). Answers come back in the guest's language.
import { useRef, useState } from "react";
import { ArrowUp, Plus, ShieldAlert, Sparkles } from "lucide-react";
import { api } from "./api";
import { Money, errorText } from "./components";
import { useI18n } from "../i18n/react";

interface Reply {
  answer: string;
  items: { id: string; name: string; price: number; reason?: string; /** The dish name in the guest's language. */ label?: string }[];
  safetyNote?: string;
  engine: string;
  /** When Qloo shaped the picks: whose fans' tastes, through which tags. */
  taste?: { liked: string; because: string[]; source: string };
  /** The answer's id in the assistant's log, to count what guests add from it. */
  turn?: string;
}

export function AssistantChat({ branch, currency, onAdd }: { branch: string; currency: string; onAdd?: (itemId: string) => void }) {
  const { t, locale } = useI18n();
  const [msgs, setMsgs] = useState<{ role: "user" | "assistant"; content: string; reply?: Reply }[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const ask = async (q: string) => {
    if (!q.trim()) return;
    const next = [...msgs, { role: "user" as const, content: q.trim() }];
    setMsgs(next);
    setText("");
    setBusy(true);
    try {
      const r = await api<Reply>(`/api/public/branches/${branch}/assistant`, { body: { messages: next.map(({ role, content }) => ({ role, content })) } });
      setMsgs([...next, { role: "assistant", content: r.answer, reply: r }]);
    } catch (e) {
      setMsgs([...next, { role: "assistant", content: errorText(e, locale) }]);
    } finally {
      setBusy(false);
      setTimeout(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
    }
  };
  const suggestions = [t("assistant.suggest1"), t("assistant.suggest2"), t("assistant.suggest3"), t("assistant.suggest4")];
  return (
    <div className="col" data-testid="assistant">
      <div className="chat" aria-live="polite">
        {!msgs.length && (
          <div className="bubble bot">
            <Sparkles size={15} style={{ verticalAlign: -2, marginRight: 6 }} />
            {t("assistant.hello")}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`bubble ${m.role === "user" ? "user" : "bot"}`} data-testid={m.role === "assistant" ? "assistant-answer" : undefined}>
            {m.content}
            {m.reply?.items.length ? (
              <div className="col tight" style={{ marginTop: 10 }}>
                {m.reply.items.map((it) => (
                  <div key={it.id} className="row between nowrap card tight flat" style={{ padding: "8px 10px" }}>
                    <span className="grow">
                      <b>{it.label ?? it.name}</b> · <Money v={it.price} c={currency} />
                      {it.reason ? <div className="muted" style={{ fontSize: 12.5 }}>{it.reason}</div> : null}
                    </span>
                    {onAdd && (
                      <button
                        className="btn small primary"
                        onClick={() => {
                          onAdd(it.id);
                          if (m.reply?.turn) void api(`/api/public/branches/${branch}/assistant/added`, { body: { turn: m.reply.turn, item: it.id } }).catch(() => {});
                        }}
                      >
                        <Plus size={14} /> {t("menu.add")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
            {m.reply?.taste ? (
              <div className="hint" style={{ marginTop: 8 }} data-testid="taste-source">
                <Sparkles size={12} /> {t("assistant.tasteSource", { liked: m.reply.taste.liked })}
              </div>
            ) : null}
            {m.reply?.safetyNote ? (
              <div className="alert sun" style={{ marginTop: 10, fontSize: 12.5, padding: "8px 10px" }} data-testid="safety-note">
                <ShieldAlert size={15} /> {m.reply.safetyNote}
              </div>
            ) : null}
          </div>
        ))}
        {busy && <div className="bubble bot muted">{t("assistant.thinking")}</div>}
        <div ref={end} />
      </div>
      {!msgs.length && (
        <div className="chips" style={{ flexWrap: "wrap" }}>
          {suggestions.map((s) => (
            <button key={s} className="chip" onClick={() => ask(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      <form
        className="row nowrap"
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("assistant.placeholder")} aria-label={t("assistant.label")} className="grow" />
        <button className="btn primary" disabled={busy || !text.trim()} aria-label={t("assistant.send")}>
          <ArrowUp size={17} /> {t("assistant.send")}
        </button>
      </form>
    </div>
  );
}
