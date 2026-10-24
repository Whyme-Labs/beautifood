// AI onboarding copilot: create the restaurant, then paste "about us + menu + floor"
// and review a generated menu (allergens, stories, signatures) and floor plan.
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Sparkles, Store, Wand2 } from "lucide-react";
import { api } from "../../src/ui/api";
import { useStaff } from "../../src/ui/staff";
import { Allergens, Money, useAction } from "../../src/ui/components";
import { ALLERGENS } from "../../src/shared/allergens";
import { useI18n } from "../../src/i18n/react";
import type { MessageKey } from "../../src/i18n/core";

interface Draft {
  engine: string;
  cuisine: string;
  story: string;
  items: { category: string; name: string; price: number; description?: string; story?: string; allergens?: string[]; dietary?: string[]; spiceLevel?: number; isSignature?: boolean; station?: string }[];
  tables: { label: string; zone?: string; seatsMin: number; seatsMax: number; mergeGroup?: string | null; splitConfig?: { suffix: string; seats: number }[] | null }[];
  warnings: string[];
  likely?: { allergen: string; because: { en: string; zh: string } }[][];
  suggestions: string[];
}

const EXAMPLE = {
  about: "We're a family-run Penang hawker café (since 1998). Charcoal-fired wok-hei, coconut milk squeezed fresh every morning.",
  menu: "NOODLES\n★ Char Kway Teow - RM16.90 - wok-fried flat rice noodles with prawns, egg, soy sauce\nAssam Laksa - RM15.50 - tamarind fish broth, chilli, mint\n\nRICE\nNasi Lemak - RM14.90 - coconut rice, sambal, peanuts, anchovies, egg\n\nDRINKS\nTeh Tarik - RM5.50\nLime Juice - RM6.00",
  floor: "8 two-seaters, 4 tables of 4 in the patio that can be pushed together, 1 round table of 10 that can split into 6 and 4",
};

export default function Setup() {
  const s = useStaff();
  const { t, locale } = useI18n();
  const { run, pending } = useAction();
  const [create, setCreate] = useState(() => ({ name: "", cuisine: "", branchName: t("staff.setup.create.branchDefault"), address: "", currency: "MYR", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kuala_Lumpur" }));
  const [about, setAbout] = useState("");
  const [menu, setMenu] = useState("");
  const [floor, setFloor] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (!s.tenant)
    return (
      <form
        className="card col setup-create"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await api("/api/m/tenants", { body: create });
            location.reload();
          });
        }}
      >
        <div className="row nowrap" style={{ gap: 12, alignItems: "flex-start" }}>
          <span className="setup-mark" aria-hidden="true">
            <Store size={22} />
          </span>
          <div>
            <h1 style={{ marginBottom: 4 }}>{t("staff.setup.create.title")}</h1>
            <p className="muted" style={{ margin: 0 }}>{t("staff.setup.create.lead")}</p>
          </div>
        </div>
        <label>
          {t("staff.setup.create.name")}
          <input value={create.name} onChange={(e) => setCreate({ ...create, name: e.target.value })} required />
        </label>
        <label>
          {t("staff.setup.create.cuisine")}
          <input value={create.cuisine} onChange={(e) => setCreate({ ...create, cuisine: e.target.value })} placeholder={t("staff.setup.create.cuisineHint")} />
        </label>
        <div className="row" style={{ alignItems: "flex-start" }}>
          <label style={{ flex: 2, minWidth: 180 }}>
            {t("staff.setup.create.branch")}
            <input value={create.branchName} onChange={(e) => setCreate({ ...create, branchName: e.target.value })} required />
          </label>
          <label style={{ flex: 1, minWidth: 110 }}>
            {t("staff.setup.create.currency")}
            <select value={create.currency} onChange={(e) => setCreate({ ...create, currency: e.target.value })}>
              {["MYR", "SGD", "USD", "EUR", "GBP", "AUD", "IDR", "THB"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          {t("staff.setup.create.address")}
          <input value={create.address} onChange={(e) => setCreate({ ...create, address: e.target.value })} />
        </label>
        <label>
          {t("staff.setup.create.timezone")}
          <input value={create.timezone} onChange={(e) => setCreate({ ...create, timezone: e.target.value })} />
        </label>
        <button className="btn primary big" disabled={pending}>
          {t("staff.setup.create.submit")}
        </button>
      </form>
    );

  const generate = () => run(async () => setDraft(await api<Draft>("/api/m/ai/onboarding", { body: { about, menuText: menu, floorText: floor } })));
  const apply = () =>
    run(async () => {
      const r = await api<{ applied: { menu?: { items: number }; tables?: number }; status: { progress: number } }>("/api/m/ai/onboarding", {
        method: "PUT",
        body: { branchId: s.branchId, cuisine: draft!.cuisine || undefined, story: draft!.story || undefined, items: draft!.items, tables: draft!.tables, replaceMenu: true, replaceTables: true },
      });
      setDone(t("staff.setup.applied", { dishes: t("staff.setup.dishes", { count: r.applied.menu?.items ?? 0 }), tables: t("staff.setup.tables", { count: r.applied.tables ?? 0 }), progress: r.status.progress }));
      setDraft(null);
    }, t("staff.setup.saved"));
  const patchItem = (i: number, p: Partial<Draft["items"][number]>) => setDraft({ ...draft!, items: draft!.items.map((x, n) => (n === i ? { ...x, ...p } : x)) });

  return (
    <div className="col setup">
      <div className="page-head">
        <div>
          <h1>
            <Sparkles size={24} className="setup-spark" aria-hidden="true" /> {t("staff.setup.title")}
          </h1>
          <p className="muted" style={{ margin: "6px 0 0", maxWidth: 720 }}>{t("staff.setup.lead")}</p>
        </div>
      </div>
      {done && (
        <div className="alert sun" role="status" data-testid="setup-done">
          <CheckCircle2 size={18} />
          <span>
            {done} <a href="/m">{t("staff.setup.backToDashboard")}</a>
          </span>
        </div>
      )}
      {!draft && (
        <section className="card col">
          <div className="row between">
            <h2 style={{ margin: 0 }}>{t("staff.setup.tellUs", { name: s.tenant.name })}</h2>
            <button className="btn small ghost" onClick={() => (setAbout(EXAMPLE.about), setMenu(EXAMPLE.menu), setFloor(EXAMPLE.floor))}>
              <Wand2 size={15} /> {t("staff.setup.useExample")}
            </button>
          </div>
          <label>
            {t("staff.setup.about")}
            <textarea value={about} onChange={(e) => setAbout(e.target.value)} />
          </label>
          <label>
            {t("staff.setup.menu")}
            <textarea value={menu} onChange={(e) => setMenu(e.target.value)} style={{ minHeight: 180 }} data-testid="menu-text" />
          </label>
          <label>
            {t("staff.setup.floor")}
            <textarea value={floor} onChange={(e) => setFloor(e.target.value)} data-testid="floor-text" />
          </label>
          <button className="btn primary big" onClick={generate} disabled={pending || (!menu && !floor && !about)}>
            <Sparkles size={18} /> {pending ? t("staff.setup.working") : t("staff.setup.generate")}
          </button>
        </section>
      )}
      {draft && (
        <>
          <section className="card" data-testid="draft">
            <div className="row between">
              <h2 style={{ margin: 0 }}>{t("staff.setup.review")}</h2>
              <span className={`badge ${draft.engine === "claude" ? "brand" : ""}`}>
                <Sparkles /> {draft.engine === "claude" ? t("staff.setup.byClaude") : t("staff.setup.byParser")}
              </span>
            </div>
            {(draft.suggestions.length > 0 || draft.warnings.length > 0) && (
              <ul className="setup-notes">
                {draft.suggestions.map((x) => (
                  <li key={x}>{x}</li>
                ))}
                {draft.warnings.map((x) => (
                  <li key={x} className="muted">
                    {x}
                  </li>
                ))}
              </ul>
            )}
            {draft.cuisine && (
              <p style={{ margin: "10px 0 0" }}>
                <span className="muted">{t("staff.setup.cuisine")}</span> <b>{draft.cuisine}</b>
              </p>
            )}
          </section>
          <section className="card">
            <h2>{t("staff.setup.menuCount", { count: draft.items.length })}</h2>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>{t("staff.setup.colDish")}</th>
                    <th>{t("staff.setup.colCategory")}</th>
                    <th className="num">{t("staff.setup.colPrice")}</th>
                    <th>{t("staff.setup.colAllergens")}</th>
                    <th>{t("staff.setup.colSignature")}</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.items.map((it, i) => (
                    <tr key={i} data-testid="draft-item">
                      <td style={{ minWidth: 180 }}>
                        <input value={it.name} onChange={(e) => patchItem(i, { name: e.target.value })} aria-label={t("staff.setup.colDish")} />
                        {it.story && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{it.story}</div>}
                      </td>
                      <td>{it.category}</td>
                      <td className="num">
                        <Money v={it.price} c={s.tenant!.currency} />
                      </td>
                      <td>
                        <details>
                          <summary>
                            <Allergens list={it.allergens ?? []} />
                            {!it.allergens?.length && <span className="muted">{t("staff.setup.none")}</span>}
                          </summary>
                          {/* what this kind of dish usually has that its text doesn't say: the owner decides */}
                          {(draft.likely?.[i] ?? []).filter((l) => !it.allergens?.includes(l.allergen)).map((l) => (
                            <div key={l.allergen} className="row nowrap hint" style={{ gap: 6, marginTop: 6 }} data-testid="likely-allergen">
                              <span>
                                {t("staff.setup.likely", { allergen: t(`allergens.${l.allergen}` as MessageKey), because: locale === "zh" ? l.because.zh : l.because.en })}
                              </span>
                              <button type="button" className="btn small" onClick={() => patchItem(i, { allergens: [...(it.allergens ?? []), l.allergen] })}>
                                {t("staff.setup.likelyAdd")}
                              </button>
                            </div>
                          ))}
                          <div className="row" style={{ marginTop: 6 }}>
                            {ALLERGENS.map((a) => (
                              <label key={a} className="inline" style={{ fontSize: 12 }}>
                                <input type="checkbox" checked={it.allergens?.includes(a) ?? false} onChange={(e) => patchItem(i, { allergens: e.target.checked ? [...(it.allergens ?? []), a] : (it.allergens ?? []).filter((x) => x !== a) })} />
                                {t(`allergens.${a}`)}
                              </label>
                            ))}
                          </div>
                        </details>
                      </td>
                      <td>
                        <input type="checkbox" checked={!!it.isSignature} onChange={(e) => patchItem(i, { isSignature: e.target.checked })} aria-label={t("staff.setup.isSignature", { name: it.name })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="card">
            <h2>{t("staff.setup.tablesCount", { count: draft.tables.length })}</h2>
            <div className="floor">
              {draft.tables.map((tb) => (
                <div key={tb.label} className="tbl free" data-testid="draft-table">
                  <b>{tb.label}</b>
                  <small>{t("staff.setup.seats", { count: tb.seatsMax })}</small>
                  {tb.zone && tb.zone !== "Main" && <small>{tb.zone}</small>}
                  {tb.mergeGroup && <small>{t("staff.setup.joinable")}</small>}
                  {tb.splitConfig && <small>{t("staff.setup.splits", { parts: tb.splitConfig.map((p) => p.seats).join("+") })}</small>}
                </div>
              ))}
            </div>
          </section>
          <div className="row">
            <button className="btn primary big" onClick={apply} disabled={pending} data-testid="apply-draft">
              {t("staff.setup.apply", { branch: s.branch?.name ?? "" })}
            </button>
            <button className="btn big ghost" onClick={() => setDraft(null)}>
              <ArrowLeft size={18} /> {t("common.back")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
