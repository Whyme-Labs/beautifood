// Loyalty members, points settings, promo codes and email campaigns.
import { useState } from "react";
import { api } from "../../src/ui/api";
import { usePoll } from "../../src/ui/hooks";
import { useStaff } from "../../src/ui/staff";
import { Status, useAction } from "../../src/ui/components";

interface Member {
  id: string;
  email: string;
  name: string;
  points: number;
  tier: string;
  visits: number;
  totalSpend: number;
  optIn: boolean;
}

export default function Members() {
  const s = useStaff();
  const { run, pending } = useAction();
  const [q, setQ] = useState("");
  const { data: m, refresh } = usePoll(() => api<{ members: Member[]; stats: { n: number; points: number; opted: number } }>(`/api/m/members?q=${encodeURIComponent(q)}`), { interval: 0, deps: [q] });
  const { data: promos, refresh: refreshPromos } = usePoll(() => api<{ code: string; kind: string; value: number; used: number; max_uses: number | null; min_spend: number; description: string }[]>("/api/m/promos"), { interval: 0 });
  const { data: campaigns, refresh: refreshCampaigns } = usePoll(() => (s.can("campaign.manage") ? api<{ id: string; name: string; subject: string; status: string; recipients: number; sent: number }[]>("/api/m/campaigns") : Promise.resolve(null)), { interval: 5000 });
  const [promo, setPromo] = useState({ code: "", kind: "percent", value: 10, minSpend: 0, maxUses: 100, description: "" });
  const [camp, setCamp] = useState({ name: "", subject: "", body: "Hi {name},\n\n", segment: "all", tier: "Gold", days: 30, promoCode: "" });
  const [preview, setPreview] = useState<{ count: number; sample: string[] } | null>(null);
  const segment = () => (camp.segment === "tier" ? { type: "tier", tier: camp.tier } : camp.segment === "inactive" ? { type: "inactive", days: camp.days } : { type: camp.segment });
  return (
    <div className="col">
      <h1>Loyalty & promotions</h1>
      <div className="split">
        <section className="card">
          <div className="row between">
            <h2 style={{ margin: 0 }}>Members</h2>
            {m && <span className="muted">{m.stats.n} members · {m.stats.opted} opted in · {m.stats.points} points outstanding</span>}
          </div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email / name" style={{ margin: "10px 0" }} aria-label="Search members" />
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Tier</th>
                <th className="num">Points</th>
                <th className="num">Visits</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {m?.members.map((x) => (
                <tr key={x.id} data-testid="member-row">
                  <td>
                    {x.name || "—"}
                    <div className="muted" style={{ fontSize: 12 }}>{x.email}</div>
                  </td>
                  <td>{x.tier}</td>
                  <td className="num">{x.points}</td>
                  <td className="num">{x.visits}</td>
                  <td>
                    {s.can("member.manage") && (
                      <button className="btn small" onClick={() => { const d = prompt("Points to add (negative to remove)"); const reason = d ? prompt("Reason") : null; if (d && reason) run(async () => (await api(`/api/m/members/${x.id}`, { body: { delta: parseInt(d), reason } }), await refresh()), "Points adjusted"); }}>
                        ± pts
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="col">
          {s.can("campaign.manage") && (
            <>
              <div className="card">
                <h2>Promo codes</h2>
                <div className="list">
                  {promos?.map((p) => (
                    <div key={p.code} className="row between">
                      <span>
                        <b>{p.code}</b> · {p.kind === "percent" ? `${p.value}% off` : `${(p.value / 100).toFixed(2)} off`} {p.min_spend ? `over ${(p.min_spend / 100).toFixed(2)}` : ""}
                      </span>
                      <span className="muted">
                        {p.used}/{p.max_uses ?? "∞"} used
                      </span>
                    </div>
                  ))}
                </div>
                <form className="row" style={{ marginTop: 10 }} onSubmit={(e) => (e.preventDefault(), run(async () => (await api("/api/m/promos", { body: { ...promo, minSpend: Math.round(promo.minSpend * 100), value: promo.kind === "amount" ? Math.round(promo.value * 100) : promo.value } }), await refreshPromos()), "Promo saved"))}>
                  <input value={promo.code} onChange={(e) => setPromo({ ...promo, code: e.target.value.toUpperCase() })} placeholder="CODE" style={{ width: 110 }} required aria-label="Code" />
                  <select value={promo.kind} onChange={(e) => setPromo({ ...promo, kind: e.target.value })} style={{ width: 100 }} aria-label="Kind">
                    <option value="percent">% off</option>
                    <option value="amount">amount off</option>
                  </select>
                  <input type="number" value={promo.value} onChange={(e) => setPromo({ ...promo, value: Number(e.target.value) })} style={{ width: 80 }} aria-label="Value" />
                  <input type="number" value={promo.minSpend} onChange={(e) => setPromo({ ...promo, minSpend: Number(e.target.value) })} style={{ width: 90 }} aria-label="Min spend" title="Minimum spend" />
                  <input type="number" value={promo.maxUses} onChange={(e) => setPromo({ ...promo, maxUses: Number(e.target.value) })} style={{ width: 80 }} aria-label="Max uses" title="Max uses" />
                  <button className="btn small">Save</button>
                </form>
              </div>
              <div className="card col">
                <h2>Send a campaign</h2>
                <label>
                  Name
                  <input value={camp.name} onChange={(e) => setCamp({ ...camp, name: e.target.value })} />
                </label>
                <label>
                  Subject
                  <input value={camp.subject} onChange={(e) => setCamp({ ...camp, subject: e.target.value })} />
                </label>
                <label>
                  Message ({"{name}"} is replaced)
                  <textarea value={camp.body} onChange={(e) => setCamp({ ...camp, body: e.target.value })} />
                </label>
                <div className="row">
                  <label style={{ flex: 1 }}>
                    Audience
                    <select value={camp.segment} onChange={(e) => setCamp({ ...camp, segment: e.target.value })}>
                      <option value="all">All opted-in members</option>
                      <option value="tier">A tier</option>
                      <option value="inactive">Haven't visited lately</option>
                      <option value="top">Top spenders</option>
                    </select>
                  </label>
                  {camp.segment === "tier" && (
                    <label style={{ flex: 1 }}>
                      Tier
                      <input value={camp.tier} onChange={(e) => setCamp({ ...camp, tier: e.target.value })} />
                    </label>
                  )}
                  <label style={{ flex: 1 }}>
                    Promo code (optional)
                    <input value={camp.promoCode} onChange={(e) => setCamp({ ...camp, promoCode: e.target.value.toUpperCase() })} />
                  </label>
                </div>
                <div className="row">
                  <button className="btn" onClick={() => run(async () => setPreview(await api(`/api/m/campaigns?preview=${encodeURIComponent(JSON.stringify(segment()))}`)))}>
                    Preview audience
                  </button>
                  {preview && <span className="muted">{preview.count} recipients</span>}
                  <button
                    className="btn primary"
                    disabled={pending || !camp.name || !camp.subject}
                    onClick={() =>
                      run(async () => {
                        const { id } = await api<{ id: string }>("/api/m/campaigns", { body: { name: camp.name, subject: camp.subject, body: camp.body, segment: segment(), promoCode: camp.promoCode || null } });
                        const r = await api<{ recipients: number }>(`/api/m/campaigns/${id}/send`, { method: "POST" });
                        await refreshCampaigns();
                        return r;
                      }, "Campaign queued")
                    }
                  >
                    Send campaign
                  </button>
                </div>
                <div className="list">
                  {campaigns?.map((c) => (
                    <div key={c.id} className="row between" data-testid="campaign-row">
                      <span>
                        {c.name} · <span className="muted">{c.subject}</span>
                      </span>
                      <span>
                        <Status s={c.status} /> {c.sent}/{c.recipients}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
