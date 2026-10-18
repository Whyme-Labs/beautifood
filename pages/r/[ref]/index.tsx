// Branch home: live queue, join the queue, signatures, the AI assistant, booking and takeaway.
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Minus, Plus, ShoppingBag, Sparkles, Ticket, UtensilsCrossed } from "lucide-react";
import type { Props } from "./index.server";
import { api } from "../../../src/ui/api";
import { usePoll } from "../../../src/ui/hooks";
import { Mins, Modal, Money, Stub, stockOf, useAction, useClassLabel } from "../../../src/ui/components";
import { AssistantChat } from "../../../src/ui/chat";
import { GuestBar } from "../../../src/ui/guest";
import { localizeItem } from "../../../src/shared/menuI18n";
import { useI18n } from "../../../src/i18n/react";

interface Status {
  categories: { code: string; label: string; prefix: string; min: number; max: number; waiting: number; estimateMinutes: number }[];
  nowCalling: { number: string; tables: string[] }[];
  tables: { total: number; free: number };
}

export default function BranchPage(p: Props) {
  const { t, locale, mins } = useI18n();
  const classLabel = useClassLabel();
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
  const cats = st?.categories ?? p.categories.map((c) => ({ ...c, waiting: 0, estimateMinutes: 0 }));
  const cat = cats.find((c) => party >= c.min && party <= c.max);
  const story = (locale !== p.menuLanguage && p.restaurant.translations?.[locale]?.story) || p.restaurant.story;

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
      <GuestBar
        right={
          <a className="btn small" href={`/r/${p.ref}/menu`}>
            <UtensilsCrossed size={16} /> <span className="hide-sm">{t("branch.menu")}</span>
          </a>
        }
      >
        {p.branch.name}
      </GuestBar>
      <main className="narrow stack-lg">
        <section>
          <h1 style={{ fontSize: "clamp(1.9rem, 7vw, 2.6rem)", marginBottom: 4 }}>{p.restaurant.name}</h1>
          <div className="muted">
            {p.branch.name}
            {p.branch.address ? ` · ${p.branch.address}` : ""}
          </div>
          {story ? <p style={{ marginTop: 10, fontSize: 15 }}>{story}</p> : null}
        </section>

        {active && (
          <a href={active} className="alert sun" style={{ textDecoration: "none" }} data-testid="active-ticket">
            <Ticket size={18} />
            <span className="grow">
              {t("branch.activeTicket")} · <b>{t("branch.viewPlace")}</b>
            </span>
            <ArrowRight size={18} />
          </a>
        )}

        <section>
          <div className="section-title">
            <h2>{t("branch.queueNow")}</h2>
            {st && <span className="muted">{t("branch.tablesFree", { count: st.tables.free })}</span>}
          </div>
          <div className="grid tight" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }} data-testid="queue-status">
            {cats.map((c) => (
              <Stub key={c.code} stock={stockOf(c.prefix)} tear={62} className="no-tear-sm">
                <div className="stub-label">
                  {classLabel(c.label)} · {c.min === c.max ? t("common.paxOne", { count: c.min }) : t("common.pax", { min: c.min, max: c.max })}
                </div>
                <div className="serial big" style={{ margin: "6px 0 14px" }}>
                  {c.waiting}
                </div>
                <div style={{ fontWeight: 650, fontSize: 14 }}>
                  <Mins v={c.estimateMinutes} />
                </div>
              </Stub>
            ))}
          </div>
          {st?.nowCalling.length ? (
            <p style={{ marginTop: 12 }}>
              {t("branch.nowCalling")}: <b className="serial sm">{st.nowCalling.map((n) => n.number).join("  ")}</b>
            </p>
          ) : null}
        </section>

        <section className="card">
          <h2>{t("branch.join")}</h2>
          {!p.branch.open ? (
            <p className="muted">{t("branch.closed")}</p>
          ) : (
            <form
              className="col"
              onSubmit={(e) => {
                e.preventDefault();
                join();
              }}
            >
              <div className="col tight">
                <span style={{ fontSize: 13, fontWeight: 650, color: "var(--ink-2)" }}>{t("branch.partySize")}</span>
                <div className="row">
                  <div className="stepper">
                    <button type="button" className="btn" aria-label={t("branch.fewer")} onClick={() => setParty(Math.max(1, party - 1))}>
                      <Minus size={20} />
                    </button>
                    <input type="number" inputMode="numeric" min={1} max={60} value={party} onChange={(e) => setParty(Math.max(1, Number(e.target.value) || 1))} aria-label={t("branch.partySize")} />
                    <button type="button" className="btn" aria-label={t("branch.more")} onClick={() => setParty(party + 1)}>
                      <Plus size={20} />
                    </button>
                  </div>
                  {cat && (
                    <span className="badge brand" style={{ fontSize: 13, padding: "4px 10px" }}>
                      {t("branch.yourLine", { label: cat.prefix, eta: mins(cat.estimateMinutes) })}
                    </span>
                  )}
                </div>
              </div>
              <label>
                {t("branch.name")}
                <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} placeholder={t("branch.namePlaceholder")} autoComplete="given-name" />
              </label>
              <label>
                {t("branch.email")}
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
              </label>
              {email && p.modules.loyalty && (
                <label className="inline">
                  <input type="checkbox" checked={loyalty} onChange={(e) => setLoyalty(e.target.checked)} /> {t("branch.loyalty", { restaurant: p.restaurant.name })}
                </label>
              )}
              <button className="btn primary big" disabled={pending || !name.trim()}>
                <Ticket size={20} /> {t("branch.getNumber")}
              </button>
            </form>
          )}
        </section>

        {p.signatures.length > 0 && (
          <section>
            <div className="section-title">
              <h2>{t("branch.signatures")}</h2>
              <a href={`/r/${p.ref}/menu`} style={{ fontWeight: 650, fontSize: 14 }}>
                {t("branch.fullMenu")} <ArrowRight size={14} style={{ verticalAlign: -2 }} />
              </a>
            </div>
            <div className="list card">
              {p.signatures.map((s) => {
                const l = localizeItem(s, locale, p.menuLanguage);
                return (
                  <div key={s.id} className="dish">
                    <div className="meta">
                      <div className="name">{l.name}</div>
                      {l.original && <div className="alt">{l.original}</div>}
                      <div className="muted" style={{ fontSize: 13.5 }}>{l.description}</div>
                    </div>
                    <span className="price">
                      <Money v={s.price} c={p.currency} />
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          {p.modules.aiAssistant && (
            <button className="btn big" onClick={() => setChat(true)}>
              <Sparkles size={18} /> {t("assistant.open")}
            </button>
          )}
          <button className="btn big" onClick={takeaway} disabled={pending}>
            <ShoppingBag size={18} /> {t("branch.takeaway")}
          </button>
          {p.modules.bookings && (
            <a className="btn big" href={`/r/${p.ref}/book`}>
              <CalendarDays size={18} /> {t("branch.bookLater")}
            </a>
          )}
        </section>
      </main>
      <Modal open={chat} onClose={() => setChat(false)} title={t("assistant.title")}>
        <AssistantChat branch={p.ref} currency={p.currency} />
      </Modal>
    </>
  );
}
