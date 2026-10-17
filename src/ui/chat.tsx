// The AI menu assistant chat panel (customer-facing).
import { useRef, useState } from "react";
import { api } from "./api";
import { Money } from "./components";

interface Reply {
  answer: string;
  items: { id: string; name: string; price: number; reason?: string }[];
  safetyNote?: string;
  engine: string;
}

export function AssistantChat({ branch, currency, onAdd }: { branch: string; currency: string; onAdd?: (itemId: string) => void }) {
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
      setMsgs([...next, { role: "assistant", content: (e as Error).message }]);
    } finally {
      setBusy(false);
      setTimeout(() => end.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  };
  return (
    <div className="col" data-testid="assistant">
      <div className="chat">
        {!msgs.length && <div className="bubble bot">Hi! I can recommend dishes, check allergens, or tell you the story behind a dish. What are you in the mood for?</div>}
        {msgs.map((m, i) => (
          <div key={i} className={`bubble ${m.role === "user" ? "user" : "bot"}`} data-testid={m.role === "assistant" ? "assistant-answer" : undefined}>
            {m.content}
            {m.reply?.items.length ? (
              <div className="col" style={{ marginTop: 8, gap: 6 }}>
                {m.reply.items.map((it) => (
                  <div key={it.id} className="row between card tight flat">
                    <span>
                      <b>{it.name}</b> <Money v={it.price} c={currency} />
                      {it.reason ? <div className="muted" style={{ fontSize: 12 }}>{it.reason}</div> : null}
                    </span>
                    {onAdd && (
                      <button className="btn small primary" onClick={() => onAdd(it.id)}>
                        Add
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
            {m.reply?.safetyNote ? <div style={{ marginTop: 8, fontSize: 12 }} data-testid="safety-note">⚠️ {m.reply.safetyNote}</div> : null}
          </div>
        ))}
        {busy && <div className="bubble bot muted">Thinking…</div>}
        <div ref={end} />
      </div>
      {!msgs.length && (
        <div className="row">
          {["What are your signatures?", "Anything vegetarian?", "I'm allergic to peanuts", "Not spicy please"].map((s) => (
            <button key={s} className="btn small" onClick={() => ask(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about the menu…" aria-label="Ask the menu assistant" style={{ flex: 1 }} />
        <button className="btn primary" disabled={busy || !text.trim()}>
          Ask
        </button>
      </form>
    </div>
  );
}
