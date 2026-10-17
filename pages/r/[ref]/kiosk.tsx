// Self-service kiosk at the door: big buttons, prints/shows the number, resets for the next guest.
import { useState } from "react";
import { useParams } from "@void/react";
import { api } from "../../../src/ui/api";
import { Mins, useAction } from "../../../src/ui/components";

export default function Kiosk() {
  const { ref } = useParams<{ ref: string }>();
  const [party, setParty] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [done, setDone] = useState<{ number: string; eta: number | null; url: string } | null>(null);
  const { run, pending } = useAction();
  const reset = () => (setParty(null), setName(""), setDone(null));
  if (done)
    return (
      <main className="narrow" style={{ textAlign: "center", paddingTop: 60 }}>
        <div className="muted" style={{ fontSize: 22 }}>Your number</div>
        <div className="big-number" style={{ fontSize: 120 }} data-testid="kiosk-number">
          {done.number}
        </div>
        <p style={{ fontSize: 22 }}>
          Estimated wait <Mins v={done.eta} />. We'll call your number on the screen.
        </p>
        <button className="btn primary big" onClick={reset}>
          Done
        </button>
      </main>
    );
  return (
    <main className="narrow" style={{ paddingTop: 40 }}>
      <h1 style={{ fontSize: 36, textAlign: "center" }}>How many in your party?</h1>
      <div className="grid tight">
        {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map((n) => (
          <button key={n} className={`btn big ${party === n ? "primary" : ""}`} style={{ fontSize: 28, minHeight: 80 }} onClick={() => setParty(n)}>
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
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" style={{ fontSize: 22, minHeight: 60 }} />
          <button className="btn primary big" disabled={pending}>
            Get my number
          </button>
        </form>
      )}
    </main>
  );
}
