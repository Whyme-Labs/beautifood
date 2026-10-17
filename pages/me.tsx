// Member rewards: passwordless sign-in per restaurant, points, tier progress, history and receipts.
import { useEffect, useState } from "react";
import { api } from "../src/ui/api";
import { useLocal, useQuery } from "../src/ui/hooks";
import { Logo, Money, useAction } from "../src/ui/components";

interface Me {
  restaurant: { name: string; slug: string };
  member: { email: string; name: string; points: number; lifetimePoints: number; tier: string; visits: number; optIn: boolean };
  nextTier: { name: string; pointsNeeded: number } | null;
  redeem: { valuePerPoint: number; minRedeem: number };
  ledger: { delta: number; kind: string; created_at: number }[];
  orders: { id: string; number: string; total: number; closed_at: number; receipt_token: string | null; branch: string }[];
}

export default function MePage() {
  const q = useQuery();
  const [tenant, setTenant] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [tokens, setTokens] = useLocal<Record<string, string>>("bf.members", {});
  const [me, setMe] = useState<Me | null>(null);
  const { run, pending } = useAction();
  useEffect(() => setTenant(q.get("tenant") ?? Object.keys(tokens)[0] ?? ""), [q, tokens]);
  useEffect(() => {
    if (!tenant || !tokens[tenant]) return setMe(null);
    api<Me>("/api/public/members/me", { headers: { authorization: `Member ${tokens[tenant]}` } })
      .then(setMe)
      .catch(() => setMe(null));
  }, [tenant, tokens]);

  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <Logo />
          <span className="muted">Rewards</span>
        </div>
      </header>
      <main className="narrow">
        {me ? (
          <div className="col" data-testid="member">
            <section className="hero">
              <div className="muted">{me.restaurant.name} rewards</div>
              <div className="big-number">{me.member.points}</div>
              <div>
                points · <b>{me.member.tier}</b> · worth <Money v={me.member.points * me.redeem.valuePerPoint} />
              </div>
              {me.nextTier && (
                <p className="muted" style={{ marginTop: 6 }}>
                  {me.nextTier.pointsNeeded} more points to {me.nextTier.name}
                </p>
              )}
            </section>
            <section className="card">
              <h2>Recent visits</h2>
              <div className="list">
                {me.orders.map((o) => (
                  <div key={o.id} className="row between">
                    <span>
                      {o.branch} · #{o.number} · {new Date(o.closed_at).toLocaleDateString()}
                    </span>
                    <span className="row">
                      <Money v={o.total} />
                      {o.receipt_token && <a href={`/receipt/${o.receipt_token}`}>receipt</a>}
                    </span>
                  </div>
                ))}
                {!me.orders.length && <div className="muted">No visits yet.</div>}
              </div>
            </section>
            <label className="inline">
              <input type="checkbox" checked={me.member.optIn} onChange={(e) => run(async () => (await api("/api/public/members/me", { method: "PATCH", body: { optIn: e.target.checked }, headers: { authorization: `Member ${tokens[tenant]}` } }), setMe({ ...me, member: { ...me.member, optIn: e.target.checked } })))} /> Send me offers by email
            </label>
            <button className="btn ghost" onClick={() => setTokens(Object.fromEntries(Object.entries(tokens).filter(([t]) => t !== tenant)))}>
              Sign out
            </button>
          </div>
        ) : (
          <form
            className="card col"
            onSubmit={(e) => {
              e.preventDefault();
              if (!sent) run(async () => (await api("/api/public/members/otp", { body: { email, tenant } }), setSent(true)), "Check your email for a 6-digit code");
              else
                run(async () => {
                  const r = await api<{ token: string }>("/api/public/members/verify", { body: { email, tenant, code } });
                  setTokens({ ...tokens, [tenant]: r.token });
                });
            }}
          >
            <h1>Your rewards</h1>
            <label>
              Restaurant
              <input value={tenant} onChange={(e) => setTenant(e.target.value)} placeholder="restaurant name in the link, e.g. beautifood-demo" required />
            </label>
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            {sent && (
              <label>
                6-digit code
                <input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} pattern="\d{6}" required />
              </label>
            )}
            <button className="btn primary" disabled={pending}>
              {sent ? "Sign in" : "Email me a code"}
            </button>
          </form>
        )}
      </main>
    </>
  );
}
