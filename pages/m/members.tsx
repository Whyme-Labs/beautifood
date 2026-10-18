// Loyalty members, points settings, promo codes and email campaigns.
import { useState } from "react";
import { Eye, Megaphone, PlusCircle, Search, Send, Tag, Users } from "lucide-react";
import { api } from "../../src/ui/api";
import { usePoll } from "../../src/ui/hooks";
import { useStaff } from "../../src/ui/staff";
import { Empty, Modal, Status, useAction } from "../../src/ui/components";
import { useI18n } from "../../src/i18n/react";

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
  const { t, f } = useI18n();
  const cur = s.tenant?.currency ?? "MYR";
  const { run, pending } = useAction();
  const [q, setQ] = useState("");
  const { data: m, refresh } = usePoll(() => api<{ members: Member[]; stats: { n: number; points: number; opted: number } }>(`/api/m/members?q=${encodeURIComponent(q)}`), { interval: 0, deps: [q] });
  const { data: promos, refresh: refreshPromos } = usePoll(() => api<{ code: string; kind: string; value: number; used: number; max_uses: number | null; min_spend: number; description: string }[]>("/api/m/promos"), { interval: 0 });
  const { data: campaigns, refresh: refreshCampaigns } = usePoll(() => (s.can("campaign.manage") ? api<{ id: string; name: string; subject: string; status: string; recipients: number; sent: number }[]>("/api/m/campaigns") : Promise.resolve(null)), { interval: 5000 });
  const [promo, setPromo] = useState({ code: "", kind: "percent", value: 10, minSpend: 0, maxUses: 100, description: "" });
  const [camp, setCamp] = useState(() => ({ name: "", subject: "", body: t("staff.members.campaign.defaultBody"), segment: "all", tier: "Gold", days: 30, promoCode: "" }));
  const [preview, setPreview] = useState<{ count: number; sample: string[] } | null>(null);
  const [adj, setAdj] = useState<{ member: Member; delta: string; reason: string } | null>(null);
  const segment = () => (camp.segment === "tier" ? { type: "tier", tier: camp.tier } : camp.segment === "inactive" ? { type: "inactive", days: camp.days } : { type: camp.segment });
  const saveAdj = () =>
    adj &&
    run(async () => {
      await api(`/api/m/members/${adj.member.id}`, { body: { delta: parseInt(adj.delta), reason: adj.reason } });
      setAdj(null);
      await refresh();
    }, t("staff.members.adjusted"));
  return (
    <div className="col">
      <div className="page-head">
        <h1>{t("staff.members.title")}</h1>
      </div>
      <div className="split">
        <section className="card">
          <div className="section-title">
            <h2 className="row nowrap">
              <Users size={18} strokeWidth={1.75} aria-hidden="true" /> {t("staff.members.members")}
            </h2>
          </div>
          {m && (
            <div className="muted" style={{ fontSize: 13 }}>
              {[t("staff.members.stats.members", { count: m.stats.n }), t("staff.members.stats.opted", { count: m.stats.opted }), t("staff.members.stats.points", { count: m.stats.points })].join(" · ")}
            </div>
          )}
          <div className="members-search">
            <Search size={16} aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("staff.members.searchPlaceholder")} aria-label={t("staff.members.search")} type="search" />
          </div>
          {m && !m.members.length ? (
            <Empty icon={<Users size={28} strokeWidth={1.5} />}>{q ? t("staff.members.noMatch") : t("staff.members.noMembers")}</Empty>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t("staff.members.member")}</th>
                  <th>{t("staff.members.tier")}</th>
                  <th className="num">{t("staff.members.points")}</th>
                  <th className="num">{t("staff.members.visits")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {m?.members.map((x) => (
                  <tr key={x.id} data-testid="member-row">
                    <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                      {x.name || "—"}
                      <div className="muted" style={{ fontSize: 12 }}>{x.email}</div>
                    </td>
                    <td>{x.tier && <span className="badge">{x.tier}</span>}</td>
                    <td className="num">{f.number(x.points)}</td>
                    <td className="num">{f.number(x.visits)}</td>
                    <td className="num">
                      {s.can("member.manage") && (
                        <button className="btn small ghost icon" title={t("staff.members.adjust")} aria-label={t("staff.members.adjustFor", { name: x.name || x.email })} onClick={() => setAdj({ member: x, delta: "", reason: "" })}>
                          <PlusCircle size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="col">
          {s.can("campaign.manage") && (
            <>
              <div className="card">
                <h2 className="row nowrap">
                  <Tag size={18} strokeWidth={1.75} aria-hidden="true" /> {t("staff.members.promos.title")}
                </h2>
                {promos && !promos.length ? (
                  <Empty icon={<Tag size={28} strokeWidth={1.5} />}>{t("staff.members.promos.none")}</Empty>
                ) : (
                  <div className="list">
                    {promos?.map((p) => (
                      <div key={p.code} className="row between">
                        <span>
                          <span className="badge brand promo-code">{p.code}</span> {p.kind === "percent" ? t("staff.members.promos.percentOff", { value: p.value }) : t("staff.members.promos.amountOff", { money: f.money(p.value, cur) })}{" "}
                          {p.min_spend ? <span className="muted">{t("staff.members.promos.over", { money: f.money(p.min_spend, cur) })}</span> : null}
                        </span>
                        <span className="muted tabular">{t("staff.members.promos.used", { used: p.used, max: p.max_uses ?? t("staff.members.promos.unlimited") })}</span>
                      </div>
                    ))}
                  </div>
                )}
                <form className="row promo-form" onSubmit={(e) => (e.preventDefault(), run(async () => (await api("/api/m/promos", { body: { ...promo, minSpend: Math.round(promo.minSpend * 100), value: promo.kind === "amount" ? Math.round(promo.value * 100) : promo.value } }), await refreshPromos()), t("staff.members.promos.saved")))}>
                  <input value={promo.code} onChange={(e) => setPromo({ ...promo, code: e.target.value.toUpperCase() })} placeholder={t("staff.members.promos.codePlaceholder")} style={{ width: 110 }} required aria-label={t("staff.members.promos.code")} />
                  <select value={promo.kind} onChange={(e) => setPromo({ ...promo, kind: e.target.value })} style={{ width: 120 }} aria-label={t("staff.members.promos.kind")}>
                    <option value="percent">{t("staff.members.promos.percent")}</option>
                    <option value="amount">{t("staff.members.promos.amount")}</option>
                  </select>
                  <input type="number" value={promo.value} onChange={(e) => setPromo({ ...promo, value: Number(e.target.value) })} style={{ width: 80 }} aria-label={t("staff.members.promos.value")} />
                  <input type="number" value={promo.minSpend} onChange={(e) => setPromo({ ...promo, minSpend: Number(e.target.value) })} style={{ width: 90 }} aria-label={t("staff.members.promos.minSpend")} title={t("staff.members.promos.minSpendHint")} />
                  <input type="number" value={promo.maxUses} onChange={(e) => setPromo({ ...promo, maxUses: Number(e.target.value) })} style={{ width: 80 }} aria-label={t("staff.members.promos.maxUses")} title={t("staff.members.promos.maxUses")} />
                  <button className="btn small primary">{t("common.save")}</button>
                </form>
              </div>
              <div className="card col">
                <h2 className="row nowrap" style={{ margin: 0 }}>
                  <Megaphone size={18} strokeWidth={1.75} aria-hidden="true" /> {t("staff.members.campaign.title")}
                </h2>
                <label>
                  {t("common.name")}
                  <input value={camp.name} onChange={(e) => setCamp({ ...camp, name: e.target.value })} />
                </label>
                <label>
                  {t("staff.members.campaign.subject")}
                  <input value={camp.subject} onChange={(e) => setCamp({ ...camp, subject: e.target.value })} />
                </label>
                <label>
                  {t("staff.members.campaign.message")}
                  <textarea value={camp.body} onChange={(e) => setCamp({ ...camp, body: e.target.value })} />
                </label>
                <div className="row" style={{ alignItems: "flex-end" }}>
                  <label style={{ flex: 1 }}>
                    {t("staff.members.campaign.audience")}
                    <select value={camp.segment} onChange={(e) => setCamp({ ...camp, segment: e.target.value })}>
                      <option value="all">{t("staff.members.campaign.all")}</option>
                      <option value="tier">{t("staff.members.campaign.tier")}</option>
                      <option value="inactive">{t("staff.members.campaign.inactive")}</option>
                      <option value="top">{t("staff.members.campaign.top")}</option>
                    </select>
                  </label>
                  {camp.segment === "tier" && (
                    <label style={{ flex: 1 }}>
                      {t("staff.members.tier")}
                      <input value={camp.tier} onChange={(e) => setCamp({ ...camp, tier: e.target.value })} />
                    </label>
                  )}
                  <label style={{ flex: 1 }}>
                    {t("staff.members.campaign.promo")}
                    <input value={camp.promoCode} onChange={(e) => setCamp({ ...camp, promoCode: e.target.value.toUpperCase() })} />
                  </label>
                </div>
                <div className="row">
                  <button className="btn" onClick={() => run(async () => setPreview(await api(`/api/m/campaigns?preview=${encodeURIComponent(JSON.stringify(segment()))}`)))}>
                    <Eye size={16} /> {t("staff.members.campaign.preview")}
                  </button>
                  {preview && <span className="muted">{t("staff.members.campaign.recipients", { count: preview.count })}</span>}
                  <button
                    className="btn primary"
                    style={{ marginLeft: "auto" }}
                    disabled={pending || !camp.name || !camp.subject}
                    onClick={() =>
                      run(async () => {
                        const { id } = await api<{ id: string }>("/api/m/campaigns", { body: { name: camp.name, subject: camp.subject, body: camp.body, segment: segment(), promoCode: camp.promoCode || null } });
                        const r = await api<{ recipients: number }>(`/api/m/campaigns/${id}/send`, { method: "POST" });
                        await refreshCampaigns();
                        return r;
                      }, t("staff.members.campaign.queued"))
                    }
                  >
                    <Send size={16} /> {t("staff.members.campaign.send")}
                  </button>
                </div>
                {campaigns && !campaigns.length ? (
                  <div className="muted" style={{ fontSize: 13 }}>{t("staff.members.campaign.none")}</div>
                ) : (
                  <div className="list">
                    {campaigns?.map((c) => (
                      <div key={c.id} className="row between" data-testid="campaign-row">
                        <span style={{ minWidth: 0 }}>
                          {c.name} · <span className="muted">{c.subject}</span>
                        </span>
                        <span className="row nowrap">
                          <Status s={c.status} /> <span className="muted tabular">{t("staff.members.campaign.progress", { sent: c.sent, total: c.recipients })}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
      <Modal open={!!adj} onClose={() => setAdj(null)} title={adj ? t("staff.members.adjustFor", { name: adj.member.name || adj.member.email }) : ""}>
        {adj && (
          <form className="col" onSubmit={(e) => (e.preventDefault(), saveAdj())}>
            <div className="muted">{t("common.points", { count: adj.member.points })}</div>
            <label>
              {t("staff.members.pointsPrompt")}
              <input type="number" inputMode="numeric" value={adj.delta} onChange={(e) => setAdj({ ...adj, delta: e.target.value })} required autoFocus />
            </label>
            <label>
              {t("staff.members.reasonPrompt")}
              <input value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} required />
            </label>
            <div className="row end">
              <button type="button" className="btn ghost" onClick={() => setAdj(null)}>
                {t("common.cancel")}
              </button>
              <button className="btn primary" disabled={pending || !adj.delta || !adj.reason}>
                {t("common.save")}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
