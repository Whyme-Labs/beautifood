// The kiosk's own menu assistant: "what can I eat?" answered on the kiosk itself. The menu brain runs in
// this browser on the branch's menu (fetched once, refreshed every few minutes), and the hybrid reader
// reads what the guest can't eat with Gemini Nano on the kiosk when Chrome has it. So a guest's allergy
// never has to leave the kiosk, and answers keep coming when the restaurant's network drops (the cloud
// model is only a fallback). Each guest starts fresh: the conversation clears after a quiet minute.
import { useEffect, useRef, useState } from "react";
import { Cpu, Cloud, ShieldAlert, WifiOff } from "lucide-react";
import { api } from "./api";
import { useI18n } from "../i18n/react";
import { prepareDevice, readAvoid, readerEnabled } from "./hybrid";
import type { AssistantContext } from "../server/ai/local";
import type { BrainReply, GuestTurn } from "../server/ai/brain";
import type { HintSource } from "../shared/brain/avoidHint";

const REFRESH_MS = 5 * 60_000;
const IDLE_MS = 60_000;
type Turn = GuestTurn & { reply?: BrainReply; source?: HintSource };

export function KioskAssistant({ branch }: { branch: string }) {
  const { t, locale } = useI18n();
  const [ctx, setCtx] = useState<AssistantContext | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const idle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const deviceAsked = useRef(false);

  useEffect(() => {
    const load = () => void api<{ context: AssistantContext }>(`/api/public/branches/${branch}/assistant/context`).then((r) => setCtx(r.context)).catch(() => {});
    load();
    const every = setInterval(load, REFRESH_MS);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    addEventListener("online", on);
    addEventListener("offline", off);
    return () => (clearInterval(every), removeEventListener("online", on), removeEventListener("offline", off));
  }, [branch]);

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text || !ctx || busy) return;
    setBusy(true);
    setDraft("");
    if (readerEnabled() && !deviceAsked.current) {
      deviceAsked.current = true;
      void prepareDevice().catch(() => {});
    }
    const read = await readAvoid(text, "prefer_on_device", 6000);
    const said: Turn = { role: "user", content: text, hint: read?.hint ?? null, source: read?.source };
    const { answerGuest } = await import("../server/ai/brain");
    const history = [...turns.map(({ role, content, hint }) => ({ role, content, hint })), { role: "user" as const, content: text, hint: said.hint }];
    const reply = answerGuest(ctx, history, locale);
    setTurns([...turns, said, { role: "assistant", content: reply.answer, reply }]);
    setBusy(false);
    clearTimeout(idle.current);
    idle.current = setTimeout(() => setTurns([]), IDLE_MS);
  };
  const examples = [t("kiosk.askEx1"), t("kiosk.askEx2"), t("kiosk.askEx3")];

  return (
    <section className="card col" style={{ gap: 12, marginTop: 24 }} data-testid="kiosk-assistant">
      <div className="row between">
        <h2 style={{ margin: 0, fontSize: 28 }}>{t("kiosk.askTitle")}</h2>
        {turns.length ? (
          <button className="btn" onClick={() => setTurns([])}>
            {t("kiosk.newGuest")}
          </button>
        ) : null}
      </div>
      {!online ? (
        <div className="alert sun" data-testid="kiosk-offline">
          <WifiOff size={16} /> {t("kiosk.offline")}
        </div>
      ) : null}
      {turns.map((m, i) => (
        <div key={i} className={`bubble ${m.role === "user" ? "user" : "bot"}`} style={{ fontSize: 18 }} data-testid={m.role === "assistant" ? "kiosk-answer" : undefined}>
          {m.content}
          {m.reply?.items.length ? (
            <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
              {m.reply.items.map((d) => (
                <li key={d.id}>{d.name}</li>
              ))}
            </ul>
          ) : null}
          {m.reply?.hintAdded?.length ? (
            <div className="hint" style={{ marginTop: 8 }} data-testid="kiosk-hint-added">
              <ShieldAlert size={12} /> {t("assistant.hintAdded", { list: m.reply.hintAdded.map((x) => x.split(":").pop()!.replace("_", " ")).join(", ") })}
            </div>
          ) : null}
          {m.role === "assistant" ? (
            <div className="hint" style={{ marginTop: 6 }}>
              {turns[i - 1]?.source === "in_cloud" ? <Cloud size={12} /> : <Cpu size={12} />} {t("kiosk.answeredHere")}
              {turns[i - 1]?.source ? ` · ${t(turns[i - 1].source === "on_device" ? "assistant.readOnDevice" : "assistant.readInCloud")}` : ""}
            </div>
          ) : null}
          {m.reply?.safetyNote ? (
            <div className="alert sun" style={{ marginTop: 8, fontSize: 14 }}>
              <ShieldAlert size={15} /> {m.reply.safetyNote}
            </div>
          ) : null}
        </div>
      ))}
      {!turns.length ? (
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {examples.map((q) => (
            <button key={q} className="chip" style={{ fontSize: 16 }} onClick={() => void ask(q)} disabled={!ctx || busy}>
              {q}
            </button>
          ))}
        </div>
      ) : null}
      <form className="row nowrap" onSubmit={(e) => (e.preventDefault(), void ask(draft))}>
        <input className="grow" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("kiosk.askPlaceholder")} aria-label={t("kiosk.askTitle")} style={{ fontSize: 20, minHeight: 58 }} />
        <button className="btn primary big" disabled={!ctx || busy || !draft.trim()}>
          {t("assistant.send")}
        </button>
      </form>
    </section>
  );
}
