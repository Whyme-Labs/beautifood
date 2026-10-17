// Outbox: every email sent to this restaurant's guests (receipts, sign-in codes, campaigns, queue notifications).
import { useState } from "react";
import { api } from "../../src/ui/api";
import { usePoll } from "../../src/ui/hooks";
import { Empty } from "../../src/ui/components";

interface Email {
  id: string;
  to_email: string;
  subject: string;
  kind: string;
  status: string;
  created_at: number;
  html?: string;
}

export default function Inbox() {
  const [to, setTo] = useState("");
  const [open, setOpen] = useState<Email | null>(null);
  const { data, error } = usePoll(() => api<Email[]>(`/api/m/outbox${to ? `?to=${encodeURIComponent(to)}` : ""}`), { interval: 4000, deps: [to] });
  return (
    <div className="split">
      <section className="card col">
        <h1>Outbox</h1>
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Filter by recipient" aria-label="Recipient" />
        {error && <Empty>{error.message}</Empty>}
        <div className="list">
          {data?.map((e) => (
            <button key={e.id} className="btn ghost" style={{ justifyContent: "flex-start", textAlign: "left" }} onClick={() => setOpen(e)}>
              <span>
                <b>{e.subject}</b>
                <div className="muted" style={{ fontSize: 12 }}>
                  {e.to_email} · {e.kind} · {e.status} · {new Date(e.created_at).toLocaleTimeString()}
                </div>
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="card">{open ? <iframe title="email" srcDoc={open.html} style={{ width: "100%", height: 600, border: "none", background: "#fff", borderRadius: 8 }} /> : <Empty>Select an email</Empty>}</section>
    </div>
  );
}
