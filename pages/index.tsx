// Landing + live directory: every branch's queue at a glance (customers can compare branches).
import { useState } from "react";
import { api } from "../src/ui/api";
import { usePoll } from "../src/ui/hooks";
import { Empty, ErrorBox, Logo, Mins } from "../src/ui/components";

interface Dir {
  branches: { branchId: string; ref: string; restaurant: string; cuisine: string; branch: string; address: string; waiting: number; freeTables: number; nowCalling: string[]; categories: { code: string; label: string; waiting: number; estimateMinutes: number }[] }[];
}

export default function Home() {
  const [q, setQ] = useState("");
  const { data, error, loading } = usePoll(() => api<Dir>(`/api/public/directory${q ? `?q=${encodeURIComponent(q)}` : ""}`), { interval: 8000, deps: [q] });
  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <Logo />
          <span className="muted">Queue, order & book — no app needed</span>
          <span style={{ flex: 1 }} />
          <a href="/me">My rewards</a>
          <a className="btn small" href="/m">
            For restaurants
          </a>
        </div>
      </header>
      <main className="wrap">
        <section className="hero" style={{ margin: "8px 0 20px" }}>
          <h1>Skip the standing around.</h1>
          <p className="muted">See live queues across restaurants, join from your phone, preorder while you wait, and get a ping when your table is ready.</p>
          <input placeholder="Search restaurants, cuisine or area…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search restaurants" style={{ maxWidth: 420 }} />
        </section>
        <ErrorBox error={error} />
        {loading && !data ? <Empty>Loading live queues…</Empty> : null}
        {data && !data.branches.length ? <Empty>No restaurants found.</Empty> : null}
        <div className="grid wide">
          {data?.branches.map((b) => (
            <a key={b.branchId} href={`/r/${b.ref}`} className="card" style={{ color: "inherit", textDecoration: "none" }} data-testid="branch-card">
              <div className="row between">
                <div>
                  <h3 style={{ margin: 0 }}>{b.restaurant}</h3>
                  <div className="muted">
                    {b.branch}
                    {b.cuisine ? ` · ${b.cuisine}` : ""}
                  </div>
                </div>
                <span className={`badge ${b.waiting ? "warn" : "ok"}`}>{b.waiting ? `${b.waiting} waiting` : b.freeTables ? "Walk right in" : "Full"}</span>
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                {b.categories.map((c) => (
                  <span key={c.code} className="badge" title={c.label}>
                    {c.label}: {c.waiting} · <Mins v={c.estimateMinutes} />
                  </span>
                ))}
              </div>
              {b.nowCalling.length ? <div style={{ marginTop: 8 }} className="muted">Now calling {b.nowCalling.join(", ")}</div> : null}
            </a>
          ))}
        </div>
        <p className="muted" style={{ marginTop: 32, fontSize: 13 }}>
          Using an AI assistant? Point it at <code>/mcp</code> (MCP) or read <a href="/llms.txt">/llms.txt</a>.
        </p>
      </main>
    </>
  );
}
