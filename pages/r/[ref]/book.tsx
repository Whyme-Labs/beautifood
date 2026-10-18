// Book a table: pick party size and day, choose an available slot, confirm.
import { useState } from "react";
import { useParams } from "@void/react";
import { ArrowLeft, CalendarCheck, Minus, Plus } from "lucide-react";
import { api } from "../../../src/ui/api";
import { usePoll } from "../../../src/ui/hooks";
import { Empty, ErrorBox, useAction } from "../../../src/ui/components";
import { GuestBar } from "../../../src/ui/guest";
import { useI18n } from "../../../src/i18n/react";

interface Avail {
  day: string;
  durationMinutes: number;
  slots: { start: number; label: string; available: boolean; tables: string[] }[];
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export default function Book() {
  const { t } = useI18n();
  const { ref } = useParams<{ ref: string }>();
  const [party, setParty] = useState(2);
  const [day, setDay] = useState(isoDay(new Date(Date.now() + 86_400_000)));
  const [slot, setSlot] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const { run, pending } = useAction();
  const { data, error } = usePoll(() => api<Avail>(`/api/public/branches/${ref}/availability?day=${day}&party=${party}`), { interval: 0, deps: [day, party] });
  const book = () =>
    run(async () => {
      const r = await api<{ url: string }>(`/api/public/branches/${ref}/bookings`, { body: { name, email: email || undefined, partySize: party, slotStart: slot, notes, joinLoyalty: !!email } });
      window.location.href = r.url;
    });
  const changeParty = (n: number) => (setParty(Math.max(1, Math.min(60, n))), setSlot(null));
  return (
    <>
      <GuestBar />
      <main className="narrow stack-lg">
        <div>
          <a href={`/r/${ref}`} className="row" style={{ gap: 4, fontWeight: 650, fontSize: 14, textDecoration: "none", marginBottom: 6 }}>
            <ArrowLeft size={16} /> {t("common.back")}
          </a>
          <h1>{t("booking.title")}</h1>
        </div>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <div className="col tight">
            <span style={{ fontSize: 13, fontWeight: 650, color: "var(--ink-2)" }}>{t("booking.guests")}</span>
            <div className="stepper">
              <button type="button" className="btn" aria-label={t("branch.fewer")} onClick={() => changeParty(party - 1)}>
                <Minus size={18} />
              </button>
              <input type="number" min={1} max={60} value={party} onChange={(e) => changeParty(Number(e.target.value) || 1)} aria-label={t("booking.guests")} />
              <button type="button" className="btn" aria-label={t("branch.more")} onClick={() => changeParty(party + 1)}>
                <Plus size={18} />
              </button>
            </div>
          </div>
          <label className="grow">
            {t("booking.day")}
            <input type="date" value={day} min={isoDay(new Date())} onChange={(e) => (setDay(e.target.value), setSlot(null))} style={{ minHeight: 54 }} />
          </label>
        </div>
        <ErrorBox error={error} />
        <section>
          <h2>{t("booking.slots")}</h2>
          <div className="grid tight" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 8 }} data-testid="slots">
            {data?.slots.map((s) => (
              <button key={s.start} className="btn serial" style={{ fontSize: 19, minHeight: 48 }} aria-pressed={slot === s.start} disabled={!s.available} onClick={() => setSlot(s.start)}>
                {s.label}
              </button>
            ))}
          </div>
          {data && !data.slots.some((s) => s.available) && <Empty>{t("booking.noSlots", { count: party })}</Empty>}
        </section>
        {slot && (
          <form
            className="card col"
            onSubmit={(e) => {
              e.preventDefault();
              book();
            }}
          >
            <label>
              {t("booking.name")}
              <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
            </label>
            <label>
              {t("booking.email")}
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </label>
            <label>
              {t("booking.notes")}
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("booking.notesHint")} />
            </label>
            <button className="btn primary big" disabled={pending || !name}>
              <CalendarCheck size={19} /> {t("booking.confirm")}
            </button>
          </form>
        )}
      </main>
    </>
  );
}
