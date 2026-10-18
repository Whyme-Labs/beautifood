// Member rewards: passwordless sign-in per restaurant, points, tier progress, history and receipts.
import { useEffect, useState } from "react";
import { LogOut, Mail, Receipt } from "lucide-react";
import { api } from "../src/ui/api";
import { useLocal, useQuery } from "../src/ui/hooks";
import { Money, Stub, useAction } from "../src/ui/components";
import { GuestBar } from "../src/ui/guest";
import { useI18n } from "../src/i18n/react";

interface Me {
  restaurant: { name: string; slug: string };
  member: { email: string; name: string; points: number; lifetimePoints: number; tier: string; visits: number; optIn: boolean };
  nextTier: { name: string; pointsNeeded: number } | null;
  redeem: { valuePerPoint: number; minRedeem: number };
  ledger: { delta: number; kind: string; created_at: number }[];
  orders: { id: string; number: string; total: number; closed_at: number; receipt_token: string | null; branch: string }[];
}

export default function MePage() {
  const { t, f } = useI18n();
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
      <GuestBar>{t("rewards.tag")}</GuestBar>
      <main className="narrow">
        {me ? (
          <div className="col" style={{ gap: 18 }} data-testid="member">
            <Stub stock="A" tear={70}>
              <div className="row between">
                <span className="stub-label">{t("rewards.program", { restaurant: me.restaurant.name })}</span>
                <span className="badge" style={{ background: "#1a1814", color: "var(--sun)" }}>{me.member.tier}</span>
              </div>
              <div className="serial mega" style={{ margin: "8px 0 0" }}>
                {f.number(me.member.points)}
              </div>
              <div style={{ fontWeight: 650 }}>
                {t("rewards.points")} · {t("rewards.worth", { value: f.money(me.member.points * me.redeem.valuePerPoint) })}
              </div>
              <div style={{ marginTop: 34, fontWeight: 600 }}>{me.nextTier ? t("rewards.toNext", { count: me.nextTier.pointsNeeded, tier: me.nextTier.name }) : me.member.email}</div>
            </Stub>
            <section className="card">
              <h2>{t("rewards.visits")}</h2>
              <div className="list">
                {me.orders.map((o) => (
                  <div key={o.id} className="row between nowrap">
                    <span className="grow">
                      <b>{o.branch}</b> · #{o.number}
                      <div className="muted" style={{ fontSize: 13 }}>{f.date(o.closed_at)}</div>
                    </span>
                    <span className="row nowrap">
                      <Money v={o.total} />
                      {o.receipt_token && (
                        <a className="btn small" href={`/receipt/${o.receipt_token}`}>
                          <Receipt size={14} /> {t("rewards.receipt")}
                        </a>
                      )}
                    </span>
                  </div>
                ))}
                {!me.orders.length && <div className="muted">{t("rewards.noVisits")}</div>}
              </div>
            </section>
            <label className="inline">
              <input type="checkbox" checked={me.member.optIn} onChange={(e) => run(async () => (await api("/api/public/members/me", { method: "PATCH", body: { optIn: e.target.checked }, headers: { authorization: `Member ${tokens[tenant]}` } }), setMe({ ...me, member: { ...me.member, optIn: e.target.checked } })))} /> {t("rewards.offers")}
            </label>
            <button className="btn ghost" onClick={() => setTokens(Object.fromEntries(Object.entries(tokens).filter(([x]) => x !== tenant)))}>
              <LogOut size={16} /> {t("common.signOut")}
            </button>
          </div>
        ) : (
          <form
            className="card col"
            onSubmit={(e) => {
              e.preventDefault();
              if (!sent) run(async () => (await api("/api/public/members/otp", { body: { email, tenant } }), setSent(true)), t("rewards.codeSent"));
              else
                run(async () => {
                  const r = await api<{ token: string }>("/api/public/members/verify", { body: { email, tenant, code } });
                  setTokens({ ...tokens, [tenant]: r.token });
                });
            }}
          >
            <h1>{t("rewards.title")}</h1>
            <label>
              {t("rewards.restaurant")}
              <input value={tenant} onChange={(e) => setTenant(e.target.value)} placeholder="beautifood-demo" required />
              <span className="hint">{t("rewards.restaurantHint")}</span>
            </label>
            <label>
              {t("common.email")}
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </label>
            {sent && (
              <label>
                {t("rewards.code")}
                <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} pattern="\d{6}" required className="serial" style={{ fontSize: 26, letterSpacing: "0.2em" }} />
              </label>
            )}
            <button className="btn primary big" disabled={pending}>
              <Mail size={18} /> {sent ? t("common.signIn") : t("rewards.sendCode")}
            </button>
          </form>
        )}
      </main>
    </>
  );
}
