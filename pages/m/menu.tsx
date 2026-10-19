// Menu editor: categories, dishes (price, allergens, dietary, spice, story, signature, station, modifiers),
// per-branch sold-out, and the menu's translations (machine-translate all, or edit one dish per language).
import { useEffect, useState } from "react";
import { EyeOff, Languages, Plus, RefreshCw, Star } from "lucide-react";
import { api } from "../../src/ui/api";
import { usePoll } from "../../src/ui/hooks";
import { useStaff } from "../../src/ui/staff";
import { Allergens, Dietary, Empty, ErrorBox, Modal, Money, useAction, useToast } from "../../src/ui/components";
import { ALLERGENS } from "../../src/shared/allergens";
import { LOCALES, localeInfo, type MessageKey } from "../../src/i18n/core";
import { useI18n } from "../../src/i18n/react";
import type { ItemTranslation, Menu, MenuItem } from "../../src/shared/types";
import type { TimedMenu } from "../../src/shared/schedule";
import { ServedOnField, TimedMenusCard } from "../../src/ui/timedMenus";

interface TranslateResult {
  locales: string[];
  engine: "claude" | "workers-ai" | "glossary" | null;
  items: number;
  translated: number;
  missing: number;
}

const STATIONS = ["kitchen", "bar", "dessert"] as const;
const DIETS = ["vegetarian", "vegan", "halal_friendly"] as const;
const SOURCE_TONE: Record<string, string> = { manual: "ok", ai: "info", glossary: "warn", none: "" };

export default function MenuEditor() {
  const s = useStaff();
  const { t } = useI18n();
  const cur = s.tenant?.currency ?? "MYR";
  const { run } = useAction();
  const { data: menu, error, refresh } = usePoll(() => api<Menu>(`/api/m/menu?branch=${s.branchId ?? ""}`), { interval: 0, deps: [s.branchId] });
  const [edit, setEdit] = useState<Partial<MenuItem> | null>(null);
  const [newCat, setNewCat] = useState("");
  const canEdit = s.can("menu.manage");
  const language = menu?.language ?? "en";
  const others = LOCALES.filter((l) => l.code !== language);
  return (
    <div className="col">
      <div className="page-head">
        <div>
          <h1>{t("staff.menu.title")}</h1>
          {s.branch && <p className="muted" style={{ margin: "4px 0 0" }}>{t("staff.menu.lead", { branch: s.branch.name })}</p>}
        </div>
        {canEdit && (
          <div className="row">
            <form className="row nowrap" onSubmit={(e) => (e.preventDefault(), run(async () => (await api("/api/m/menu/categories", { body: { name: newCat } }), setNewCat(""), await refresh()), t("staff.menu.categoryAdded")))}>
              <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder={t("staff.menu.newCategory")} style={{ width: 160 }} aria-label={t("staff.menu.newCategory")} />
              <button className="btn small" disabled={!newCat}>
                {t("common.add")}
              </button>
            </form>
            <button className="btn primary" disabled={!menu?.categories.length} onClick={() => setEdit({ categoryId: menu!.categories[0].id, name: "", price: 0, allergens: [], dietary: [], modifiers: [], spiceLevel: 0, station: "kitchen" })}>
              <Plus size={18} /> {t("staff.menu.newDish")}
            </button>
          </div>
        )}
      </div>
      <ErrorBox error={error} />
      {canEdit && menu && <TranslatePanel language={language} onDone={refresh} />}
      {canEdit && menu && <TimedMenusCard menu={menu} currency={cur} onChange={refresh} />}
      {menu && !menu.categories.length && <Empty>{t("staff.menu.noCategories")}</Empty>}
      {menu?.categories.map((c) => {
        const items = menu.items.filter((i) => i.categoryId === c.id);
        return (
          <section key={c.id} className="card">
            <div className="section-title">
              <h2>{c.name}</h2>
              <span className="muted">{t("staff.menu.dishCount", { count: items.length })}</span>
            </div>
            {!items.length && <p className="muted" style={{ margin: 0 }}>{t("staff.menu.emptyCategory")}</p>}
            <div className="list">
              {items.map((i) => (
                <div key={i.id} className={`dish ${i.active ? "" : "sold"}`} data-testid="menu-item">
                  <div className="meta">
                    <div className="row" style={{ gap: 6 }}>
                      <span className="name">{i.name}</span>
                      {i.isSignature && (
                        <span className="sig">
                          <Star size={11} fill="currentColor" /> {t("menu.signature")}
                        </span>
                      )}
                      {!i.active && (
                        <span className="badge">
                          <EyeOff /> {t("staff.menu.hidden")}
                        </span>
                      )}
                      {(menu.menus ?? [])
                        .filter((m) => i.menuIds?.includes(m.id))
                        .map((m) => (
                          <span key={m.id} className="badge info">
                            {m.name}
                          </span>
                        ))}
                    </div>
                    {i.description && <div className="muted" style={{ fontSize: 13 }}>{i.description}</div>}
                    <Dietary list={i.dietary} spice={i.spiceLevel} />
                    <Allergens list={i.allergens} />
                    {canEdit && others.some((l) => !i.translations?.[l.code]?.name) && (
                      <div className="tag-row">
                        {others
                          .filter((l) => !i.translations?.[l.code]?.name)
                          .map((l) => (
                            <span key={l.code} className="badge">
                              <Languages /> {t("staff.menu.needsTranslation", { language: l.label })}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                  <div className="col tight" style={{ alignItems: "flex-end" }}>
                    <span className="price">
                      <Money v={i.price} c={cur} />
                    </span>
                    <div className="row" style={{ gap: 6 }}>
                      {s.can("menu.availability") && (
                        <button className={`btn small ${i.soldOut ? "danger" : ""}`} onClick={() => run(async () => (await api(`/api/m/branches/${s.branchId}/availability`, { body: { itemId: i.id, soldOut: !i.soldOut } }), await refresh()), i.soldOut ? t("staff.menu.backInStock") : t("staff.menu.soldOutAt", { name: i.name, branch: s.branch?.name ?? "" }))}>
                          {i.soldOut ? t("staff.menu.soldOut") : t("staff.menu.inStock")}
                        </button>
                      )}
                      {canEdit && (
                        <button className="btn small" onClick={() => setEdit(i)}>
                          {t("common.edit")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
      <ItemModal
        item={edit}
        currency={cur}
        language={language}
        categories={menu?.categories ?? []}
        menus={menu?.menus ?? []}
        onClose={() => setEdit(null)}
        onTranslated={refresh}
        onSave={(it) =>
          run(async () => {
            const { id, soldOut: _s, sort: _o, translations: _t, ...body } = it as MenuItem;
            await api(id ? `/api/m/menu/items/${id}` : "/api/m/menu/items", { method: id ? "PUT" : "POST", body });
            setEdit(null);
            await refresh();
          }, t("staff.menu.saved"))
        }
        onDelete={(id) => run(async () => (await api(`/api/m/menu/items/${id}`, { method: "DELETE" }), setEdit(null), await refresh()), t("staff.menu.removed"))}
      />
    </div>
  );
}

function TranslatePanel({ language, onDone }: { language: string; onDone: () => Promise<void> }) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  const [refreshAll, setRefreshAll] = useState(false);
  const [result, setResult] = useState<TranslateResult | null>(null);
  const others = LOCALES.filter((l) => l.code !== language);
  const names = (codes: string[]) => codes.map((c) => localeInfo(c).label).join(", ");
  const go = () =>
    run(async () => {
      const r = await api<TranslateResult>("/api/m/menu/translate", { body: { refresh: refreshAll || undefined } });
      setResult(r);
      await onDone();
    }, t("staff.menu.translate.done"));
  return (
    <section className="card col" data-testid="menu-translate">
      <div className="row between">
        <div className="grow">
          <h2 style={{ marginBottom: 4 }}>{t("staff.menu.translate.title")}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {others.length ? t("staff.menu.translate.lead", { language: localeInfo(language).label, others: names(others.map((l) => l.code)) }) : t("staff.menu.translate.nothing")}
          </p>
        </div>
        <button className="btn sun" onClick={go} disabled={pending || !others.length}>
          {refreshAll ? <RefreshCw size={18} /> : <Languages size={18} />}
          {pending ? t("staff.menu.translate.working") : t("staff.menu.translate.action")}
        </button>
      </div>
      <label className="inline">
        <input type="checkbox" checked={refreshAll} onChange={(e) => setRefreshAll(e.target.checked)} />
        <span>
          {t("staff.menu.translate.refresh")} <span className="hint">· {t("staff.menu.translate.refreshHint")}</span>
        </span>
      </label>
      {result && (
        <div className="alert sun" role="status" data-testid="translate-result">
          <Languages size={18} />
          <div className="col tight">
            <span>
              {result.translated
                ? t("staff.menu.translate.result", { count: result.translated, languages: names(result.locales) })
                : t("staff.menu.translate.upToDate", { languages: names(result.locales) })}
            </span>
            {result.missing > 0 && <span className="muted">{t("staff.menu.translate.missing", { count: result.missing })}</span>}
            {result.engine && (
              <span>
                <span className="badge info">{t("staff.menu.translate.by", { engine: t(`staff.menu.translate.engine.${result.engine}` as MessageKey) })}</span>
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function ItemModal({ item, currency, language, categories, menus, onClose, onSave, onDelete, onTranslated }: { item: Partial<MenuItem> | null; currency: string; language: string; categories: { id: string; name: string }[]; menus: TimedMenu[]; onClose: () => void; onSave: (i: Partial<MenuItem>) => void; onDelete: (id: string) => void; onTranslated: () => Promise<void> }) {
  const { t, f: fmt } = useI18n();
  const toast = useToast();
  const [f, setF] = useState<Partial<MenuItem>>({});
  const [mods, setMods] = useState("");
  useEffect(() => {
    if (!item) return;
    setF(item);
    setMods(JSON.stringify(item.modifiers ?? [], null, 1));
  }, [item]);
  if (!item) return null;
  const set = (p: Partial<MenuItem>) => setF({ ...f, ...p });
  const toggle = (list: string[] | undefined, v: string, on: boolean) => (on ? [...(list ?? []), v] : (list ?? []).filter((x) => x !== v));
  return (
    <Modal open onClose={onClose} title={item.id ? t("staff.menu.editor.editTitle", { name: item.name ?? "" }) : t("staff.menu.editor.newTitle")}>
      <form
        className="col"
        onSubmit={(e) => {
          e.preventDefault();
          let modifiers = [];
          try {
            modifiers = JSON.parse(mods || "[]");
          } catch {
            toast(t("staff.menu.editor.modifiersInvalid"), true);
            return;
          }
          onSave({ ...f, modifiers, price: Math.round(Number(f.price)) });
        }}
      >
        <label>
          {t("staff.menu.editor.name")}
          <input value={f.name ?? ""} onChange={(e) => set({ name: e.target.value })} required />
        </label>
        <div className="row" style={{ alignItems: "flex-start" }}>
          <label style={{ flex: 1, minWidth: 140 }}>
            {t("staff.menu.editor.category")}
            <select value={f.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ flex: 1, minWidth: 120 }}>
            {t("staff.menu.editor.price")}
            <input type="number" min={0} value={f.price ?? 0} onChange={(e) => set({ price: Number(e.target.value) })} />
            <span className="hint">{t("staff.menu.editor.priceHint", { price: fmt.money(Math.round(Number(f.price) || 0), currency) })}</span>
          </label>
          <label style={{ flex: 1, minWidth: 120 }}>
            {t("staff.menu.editor.station")}
            <select value={f.station ?? "kitchen"} onChange={(e) => set({ station: e.target.value })}>
              {STATIONS.map((st) => (
                <option key={st} value={st}>
                  {t(`staff.menu.editor.stations.${st}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          {t("staff.menu.editor.description")}
          <input value={f.description ?? ""} onChange={(e) => set({ description: e.target.value })} />
        </label>
        <label>
          {t("staff.menu.editor.story")}
          <textarea value={f.story ?? ""} onChange={(e) => set({ story: e.target.value })} />
        </label>
        <fieldset className="menu-fieldset">
          <legend>{t("staff.menu.editor.allergens")}</legend>
          <div className="row">
            {ALLERGENS.map((a) => (
              <label key={a} className="inline" style={{ fontSize: 13 }}>
                <input type="checkbox" checked={f.allergens?.includes(a) ?? false} onChange={(e) => set({ allergens: toggle(f.allergens, a, e.target.checked) })} />
                {t(`allergens.${a}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="menu-fieldset">
          <legend>{t("staff.menu.editor.dietary")}</legend>
          <div className="row">
            {DIETS.map((d) => (
              <label key={d} className="inline">
                <input type="checkbox" checked={f.dietary?.includes(d) ?? false} onChange={(e) => set({ dietary: toggle(f.dietary, d, e.target.checked) })} />
                {t(`diet.${d}`)}
              </label>
            ))}
            <label className="inline">
              {t("staff.menu.editor.spice")}
              <select value={f.spiceLevel ?? 0} onChange={(e) => set({ spiceLevel: Number(e.target.value) })} style={{ width: 70 }}>
                {[0, 1, 2, 3].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="inline">
              <input type="checkbox" checked={!!f.isSignature} onChange={(e) => set({ isSignature: e.target.checked })} /> {t("staff.menu.editor.signature")}
            </label>
            <label className="inline">
              <input type="checkbox" checked={f.active !== false} onChange={(e) => set({ active: e.target.checked })} /> {t("staff.menu.editor.onMenu")}
            </label>
          </div>
        </fieldset>
        <ServedOnField menus={menus} value={f.menuIds ?? []} onChange={(menuIds) => set({ menuIds })} />
        <label>
          {t("staff.menu.editor.modifiers")}
          <span className="hint">{t("staff.menu.editor.modifiersHint")}</span>
          <textarea value={mods} onChange={(e) => setMods(e.target.value)} style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }} />
        </label>
        <div className="row between">
          <button className="btn primary">{t("common.save")}</button>
          {item.id && (
            <button type="button" className="btn danger" onClick={() => onDelete(item.id!)}>
              {t("staff.menu.editor.remove")}
            </button>
          )}
        </div>
      </form>
      <hr className="rule" style={{ margin: "18px 0" }} />
      <TranslationsSection item={item} language={language} onSaved={onTranslated} />
    </Modal>
  );
}

function TranslationsSection({ item, language, onSaved }: { item: Partial<MenuItem>; language: string; onSaved: () => Promise<void> }) {
  const { t } = useI18n();
  const others = LOCALES.filter((l) => l.code !== language);
  if (!others.length) return null;
  return (
    <section className="col" data-testid="item-translations">
      <div>
        <h3 style={{ marginBottom: 2 }}>
          <Languages size={16} style={{ verticalAlign: -2 }} /> {t("staff.menu.tr.title")}
        </h3>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          {item.id ? t("staff.menu.tr.lead", { language: localeInfo(language).label }) : t("staff.menu.tr.saveFirst")}
        </p>
      </div>
      {item.id && others.map((l) => <LocaleTranslation key={`${item.id}-${l.code}`} itemId={item.id!} locale={l.code} initial={item.translations?.[l.code]} onSaved={onSaved} />)}
    </section>
  );
}

function LocaleTranslation({ itemId, locale, initial, onSaved }: { itemId: string; locale: string; initial?: ItemTranslation; onSaved: () => Promise<void> }) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [source, setSource] = useState<string>(initial?.source ?? (initial?.name ? "ai" : "none"));
  const label = localeInfo(locale).label;
  const dirty = name !== (initial?.name ?? "") || description !== (initial?.description ?? "");
  const save = () =>
    run(async () => {
      await api(`/api/m/menu/items/${itemId}/translation`, { method: "PUT", body: { locale, name, description } });
      setSource("manual");
      await onSaved();
    }, t("staff.menu.tr.saved", { language: label }));
  return (
    <form className="card sunk col tight" data-testid="item-translation" onSubmit={(e) => (e.preventDefault(), save())}>
      <div className="row between">
        <b lang={locale}>{label}</b>
        <span className={`badge ${SOURCE_TONE[source] ?? ""}`} data-testid="translation-source">
          {t(`staff.menu.tr.source.${source}` as MessageKey)}
        </span>
      </div>
      <label>
        {t("staff.menu.tr.name", { language: label })}
        <input lang={locale} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
      </label>
      <label>
        {t("staff.menu.tr.description", { language: label })}
        <input lang={locale} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={600} />
      </label>
      <div className="row end">
        <button className="btn small" disabled={pending || (!dirty && source === "manual")}>
          {t("staff.menu.tr.save", { language: label })}
        </button>
      </div>
    </form>
  );
}
