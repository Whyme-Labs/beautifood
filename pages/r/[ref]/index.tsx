// Branch home: live queue, join the queue, signatures, the AI assistant, booking and takeaway.
import { useEffect, useState } from "react";
import type { Props } from "./index.server";
import { api } from "../../../src/ui/api";
import { usePoll } from "../../../src/ui/hooks";
import { Logo, Mins, Modal, Money, useAction } from "../../../src/ui/components";
import { AssistantChat } from "../../../src/ui/chat";

interface Status {
  categories: { code: string; label: string; min: number; max: number; waiting: number; estimateMinutes: number }[];
  nowCalling: { number: string; tables: string[] }[];
  tables: { total: number; free: number };
}

export default function BranchPage(p: Props) {
  const { data: st } = usePoll(() => api<Status>(`/api/public/branches/${p.ref}/status`), { interval: 5000 });
  const [party, setParty] = useState(2);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loyalty, setLoyalty] = useState(true);
  const [chat, setChat] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const { run, pending } = useAction();
  useEffect(() => {
    try {
      setActive(localStorage.getItem(`bf.ticket.${p.branch.id}`));
    } catch {
      /* ignore */
    }
  }, [p.branch.id]);
  const cat = st?.categories.find((c) => party >= c.min && party <= c.max);

  const join = () =>
    run(async () => {
      const r = await api<{ url: string }>(`/api/public/branches/${p.ref}/queue`, { body: { partySize: party, name: name.trim(), email: email.trim() || undefined, joinLoyalty: !!email && loyalty } });
      try {
        localStorage.setItem(`bf.ticket.${p.branch.id}`, r.url);
      } catch {
        /* ignore */
      }
      window.location.href = r.url;
    });

  const takeaway = () =>
    run(async () => {
      const r = await api<{ url: string }>(`/api/public/branches/${p.ref}/takeaway`, { method: "POST" });
      window.location.href = r.url;
    });

  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <Logo />
          <span style={{ flex: 1 }} />
          <a href={`/r/${p.ref}/menu`}>Menu</a>
          {p.modules.bookings && <a href={`/r/${p.ref}/book`}>Book a table</a>}
        </div>
      </header>
      <main className="narrow">
        <section className="hero">
          <h1 style={{ marginBottom: 4 }}>{p.restaurant.name}</h1>
          <div className="muted">
            {p.branch.name}
            {p.branch.address ? ` · ${p.branch.address}` : ""}
          </div>
          {p.restaurant.story ? <p style={{ marginTop: 10, fontSize: 14 }}>{p.restaurant.story}</p> : null}
        </section>

        {active && (
          <a href={active} className="card" style={{ display: "block", marginTop: 14, borderColor: "var(--brand)" }} data-testid="active-ticket">
            You have a ticket here → <b>view your place in line</b>
          </a>
        )}

        <section className="card" style={{ marginTop: 14 }}>
          <div className="row between">
            <h2 style={{ margin: 0 }}>Queue now</h2>
            {st && <span className="muted">{st.tables.free} tables free</span>}
          </div>
          <div className="grid tight" style={{ marginTop: 10 }} data-testid="queue-status">
            {(st?.categories ?? p.categories.map((c) => ({ ...c, waiting: 0, estimateMinutes: 0 }))).map((c) => (
              <div key={c.code} className="card flat tight">
                <b>{c.label}</b> <span className="muted">({c.min === c.max ? c.min : `${c.min}–${c.max}`} pax)</span>
                <div>
                  {c.waiting} waiting · <Mins v={c.estimateMinutes} />
                </div>
              </div>
            ))}
          </div>
          {st?.nowCalling.length ? (
            <p style={{ marginTop: 10 }}>
              Now calling: <b>{st.nowCalling.map((n) => n.number).join(", ")}</b>
            </p>
          ) : null}
        </section>

        <section className="card" style={{ marginTop: 14 }}>
          <h2>Join the queue</h2>
          {!p.branch.open ? (
            <p className="muted">This branch isn't taking queue tickets right now.</p>
          ) : (
            <form
              className="col"
              onSubmit={(e) => {
                e.preventDefault();
                join();
              }}
            >
              <label>
                Party size
                <div className="row">
                  <button type="button" className="btn" aria-label="Fewer people" onClick={() => setParty(Math.max(1, party - 1))}>
                    −
                  </button>
                  <input type="number" min={1} max={60} value={party} onChange={(e) => setParty(Math.max(1, Number(e.target.value) || 1))} style={{ width: 80, textAlign: "center" }} aria-label="Party size" />
                  <button type="button" className="btn" aria-label="More people" onClick={() => setParty(party + 1)}>
                    +
                  </button>
                  {cat && (
                    <span className="badge">
                      {cat.label} · ~<Mins v={cat.estimateMinutes} />
                    </span>
                  )}
                </div>
              </label>
              <label>
                Name
                <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} placeholder="What should we call you?" />
              </label>
              <label>
                Email (optional — for a heads-up and your e-receipt)
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </label>
              {email && p.modules.loyalty && (
                <label className="inline">
                  <input type="checkbox" checked={loyalty} onChange={(e) => setLoyalty(e.target.checked)} /> Collect points with {p.restaurant.name} rewards
                </label>
              )}
              <button className="btn primary big" disabled={pending || !name.trim()}>
                Get my number
              </button>
            </form>
          )}
        </section>

        {p.signatures.length > 0 && (
          <section className="card" style={{ marginTop: 14 }}>
            <h2>Signatures</h2>
            <div className="list">
              {p.signatures.map((s) => (
                <div key={s.id} className="dish">
                  <div className="meta">
                    <b>{s.name}</b>
                    <div className="muted" style={{ fontSize: 13 }}>{s.description}</div>
                  </div>
                  <span className="price">
                    <Money v={s.price} c={p.currency} />
                  </span>
                </div>
              ))}
            </div>
            <a href={`/r/${p.ref}/menu`}>Full menu →</a>
          </section>
        )}

        <section className="row" style={{ marginTop: 14 }}>
          {p.modules.aiAssistant && (
            <button className="btn" onClick={() => setChat(true)}>
              💬 Ask what to eat
            </button>
          )}
          <button className="btn" onClick={takeaway} disabled={pending}>
            🥡 Order takeaway
          </button>
          {p.modules.bookings && (
            <a className="btn" href={`/r/${p.ref}/book`}>
              📅 Book for later
            </a>
          )}
        </section>
      </main>
      <Modal open={chat} onClose={() => setChat(false)} title="Menu assistant">
        <AssistantChat branch={p.ref} currency={p.currency} />
      </Modal>
    </>
  );
}
