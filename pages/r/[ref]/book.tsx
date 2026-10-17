// Book a table: pick party size and day, choose an available slot, confirm.
import { useState } from "react";
import { useParams } from "@void/react";
import { api } from "../../../src/ui/api";
import { usePoll } from "../../../src/ui/hooks";
import { Empty, ErrorBox, Logo, useAction } from "../../../src/ui/components";

interface Avail {
  day: string;
  durationMinutes: number;
  slots: { start: number; label: string; available: boolean; tables: string[] }[];
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export default function Book() {
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
  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <Logo />
          <a href={`/r/${ref}`}>← Back</a>
        </div>
      </header>
      <main className="narrow">
        <h1>Book a table</h1>
        <div className="row">
          <label style={{ flex: 1 }}>
            Guests
            <input type="number" min={1} max={60} value={party} onChange={(e) => (setParty(Math.max(1, Number(e.target.value) || 1)), setSlot(null))} />
          </label>
          <label style={{ flex: 2 }}>
            Day
            <input type="date" value={day} min={isoDay(new Date())} onChange={(e) => (setDay(e.target.value), setSlot(null))} />
          </label>
        </div>
        <ErrorBox error={error} />
        <div className="grid tight" style={{ margin: "14px 0" }} data-testid="slots">
          {data?.slots.map((s) => (
            <button key={s.start} className={`btn ${slot === s.start ? "primary" : ""}`} disabled={!s.available} onClick={() => setSlot(s.start)}>
              {s.label}
            </button>
          ))}
        </div>
        {data && !data.slots.some((s) => s.available) && <Empty>No tables left for {party} on this day.</Empty>}
        {slot && (
          <form
            className="card col"
            onSubmit={(e) => {
              e.preventDefault();
              book();
            }}
          >
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label>
              Email (for confirmation)
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>
              Notes
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Birthday, high chair…" />
            </label>
            <button className="btn primary big" disabled={pending || !name}>
              Confirm booking
            </button>
          </form>
        )}
      </main>
    </>
  );
}
