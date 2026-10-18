// Self-service kiosk at the door: big buttons, prints/shows the number, resets for the next guest.
import { useState } from "react";
import { useParams } from "@void/react";
import { Ticket } from "lucide-react";
import { api } from "../../../src/ui/api";
import { LangSwitch, Logo, Mins, Stub, stockOf, useAction } from "../../../src/ui/components";
import { useI18n } from "../../../src/i18n/react";

export default function Kiosk() {
  const { t } = useI18n();
  const { ref } = useParams<{ ref: string }>();
  const [party, setParty] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [done, setDone] = useState<{ number: string; eta: number | null; url: string } | null>(null);
  const { run, pending } = useAction();
  const reset = () => (setParty(null), setName(""), setDone(null));
  return (
    <>
      <header className="topbar">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <Logo href="#" />
          <span className="grow" />
          <LangSwitch />
        </div>
      </header>
      {done ? (
        <main className="narrow" style={{ paddingTop: 30 }}>
          <Stub stock={stockOf(done.number)} tear={72} issued>
            <div className="stub-label">{t("ticket.yourNumber")}</div>
            <div className="serial mega" data-testid="kiosk-number" style={{ fontSize: 170 }}>
              {done.number}
            </div>
            <p style={{ fontSize: 20, fontWeight: 650, marginTop: 40, marginBottom: 4 }}>{t("ticket.etaLabel")}</p>
            <div className="serial big"><Mins v={done.eta} /></div>
            <p style={{ fontSize: 18, marginTop: 10 }}>{t("kiosk.watchScreen")}</p>
          </Stub>
          <button className="btn primary big block" style={{ marginTop: 18 }} onClick={reset}>
            {t("common.done")}
          </button>
        </main>
      ) : (
        <main className="narrow" style={{ paddingTop: 30 }}>
          <h1 style={{ fontSize: 40, textAlign: "center" }}>{t("kiosk.howMany")}</h1>
          <div className="grid" style={{ gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map((n) => (
              <button key={n} className="btn serial" aria-pressed={party === n} style={{ fontSize: 40, minHeight: 92 }} onClick={() => setParty(n)}>
                {n}
              </button>
            ))}
          </div>
          {party && (
            <form
              className="col"
              style={{ marginTop: 20 }}
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  const r = await api<{ ticket: { number: string; etaMinutes: number | null }; url: string }>(`/api/public/branches/${ref}/queue`, { body: { partySize: party, name: name || "Guest", source: "kiosk" }, headers: { "x-device": `kiosk-${Date.now()}-${Math.random()}` } });
                  setDone({ number: r.ticket.number, eta: r.ticket.etaMinutes, url: r.url });
                });
              }}
            >
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("kiosk.namePlaceholder")} style={{ fontSize: 22, minHeight: 62 }} />
              <button className="btn primary big" style={{ minHeight: 70, fontSize: 22 }} disabled={pending}>
                <Ticket size={24} /> {t("branch.getNumber")}
              </button>
            </form>
          )}
        </main>
      )}
    </>
  );
}
