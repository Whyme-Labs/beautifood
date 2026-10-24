// Menu editor: timed menus (Breakfast 7–11 am, Lunch…) and happy hours (drinks −30%, weekdays
// 3–6 pm). Each has weekly times in the branch's local time and the branches it runs at, and may
// run only between two dates (a season, a Raya promotion); a happy hour also has its discount and
// the categories or dishes it covers.
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, Plus, Tag, X } from "lucide-react";
import { api } from "./api";
import { useStaff } from "./staff";
import { Modal, useAction } from "./components";
import { useI18n } from "../i18n/react";
import { localeInfo } from "../i18n/core";
import { clockAt, clockLabel, daysLabel, isOn, weekdayNames, toMinutes, type PriceRule, type TimedMenu, type Window } from "../shared/schedule";
import type { Menu } from "../shared/types";

const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAYS = [1, 2, 3, 4, 5];

type MenuDraft = Omit<TimedMenu, "id" | "sort" | "translations"> & { id?: string };
type RuleDraft = Omit<PriceRule, "id" | "translations"> & { id?: string };

/** The dates its times run between: the same for every time (as the editor sets them), or `mixed`. */
function datesOf(ws: Window[]) {
  const start = ws[0]?.start ?? "";
  const end = ws[0]?.end ?? "";
  return { start, end, mixed: ws.some((w) => (w.start ?? "") !== start || (w.end ?? "") !== end) };
}

/** Every time with these dates; an empty one is open (from the start, or with no end). */
const withDates = (ws: Window[], start: string, end: string): Window[] =>
  ws.map(({ start: _s, end: _e, ...w }) => ({ ...w, ...(start ? { start } : {}), ...(end ? { end } : {}) }));

/** "1 Oct", or "1 Oct 2027" when it isn't this year. */
function useDayLabel() {
  const { locale } = useI18n();
  const intl = localeInfo(locale).intl;
  const year = new Date().getFullYear();
  return (ymd: string) =>
    new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", ...(Number(ymd.slice(0, 4)) !== year ? { year: "numeric" } : {}), timeZone: "UTC" }).format(new Date(`${ymd}T12:00:00Z`));
}

/** "1 Oct – 30 Nov", "From 1 Oct", "Until 30 Nov", or "" for all year. */
function useRangeLabel() {
  const { t } = useI18n();
  const day = useDayLabel();
  return (w: Pick<Window, "start" | "end">) =>
    w.start && w.end ? t("staff.menu.timed.range", { start: day(w.start), end: day(w.end) }) : w.start ? t("staff.menu.timed.fromDate", { date: day(w.start) }) : w.end ? t("staff.menu.timed.untilDate", { date: day(w.end) }) : "";
}

/** "Mon–Fri 7:00 am–11:00 am · Sat, Sun 8:00 am–12:00 pm", then its dates: "· 1 Oct – 30 Nov" */
export function useWindowsLabel() {
  const { t, locale } = useI18n();
  const names = weekdayNames(locale);
  const range = useRangeLabel();
  return (ws: Window[]) => {
    const { mixed } = datesOf(ws);
    const times = ws.map((w) => [`${daysLabel(w.days, names, t("staff.menu.timed.everyDay"))} ${clockLabel(w.from, locale)}–${clockLabel(w.to, locale)}`, mixed ? range(w) : ""].filter(Boolean).join(", ")).join(" · ");
    return [times, mixed ? "" : range(ws[0] ?? {})].filter(Boolean).join(" · ");
  };
}

/** Before its first day, or past its last: "Starts 1 Oct", "Ended 30 Nov". */
function useSeasonBadge() {
  const { t } = useI18n();
  const day = useDayLabel();
  return (ws: Window[], today: string | undefined) => {
    if (!today || !ws.length) return null;
    if (ws.every((w) => w.start && w.start > today)) return t("staff.menu.timed.upcoming", { date: day(ws.map((w) => w.start!).sort()[0]) });
    if (ws.every((w) => w.end && w.end < today)) return t("staff.menu.timed.ended", { date: day(ws.map((w) => w.end!).sort().at(-1)!) });
    return null;
  };
}

/** A time whose last day is before its first. */
const datesBackwards = (ws: Window[]) => ws.some((w) => w.start && w.end && w.start > w.end);

export function TimedMenusCard({ menu, currency, onChange }: { menu: Menu; currency: string; onChange: () => Promise<void> }) {
  const s = useStaff();
  const { t, f } = useI18n();
  const when = useWindowsLabel();
  const season = useSeasonBadge();
  const [editMenu, setEditMenu] = useState<MenuDraft | null>(null);
  const [editRule, setEditRule] = useState<RuleDraft | null>(null);
  const clock = clockAt(Date.now(), s.branch?.config.timezone ?? "Asia/Kuala_Lumpur");
  const branchName = (ids: string[]) => (ids.includes("*") ? t("staff.menu.timed.allBranches") : ids.map((id) => s.tenant?.branches.find((b) => b.id === id)?.name ?? id).join(", "));
  const covered = (r: PriceRule) => {
    const names = [...r.categories.map((id) => menu.categories.find((c) => c.id === id)?.name), ...r.items.map((id) => menu.items.find((i) => i.id === id)?.name)].filter(Boolean);
    return names.length ? names.join(", ") : t("staff.menu.timed.wholeMenu");
  };
  const menus = menu.menus ?? [];
  const rules = menu.rules ?? [];
  return (
    <section className="card col" data-testid="timed-menus" aria-labelledby="timed-h">
      <div className="section-title">
        <h2 id="timed-h">
          <Clock size={18} strokeWidth={1.75} className="settings-icon" aria-hidden="true" /> {t("staff.menu.timed.title")}
        </h2>
      </div>
      <p className="muted" style={{ margin: 0 }}>{t("staff.menu.timed.lead")}</p>

      <div className="row between">
        <h3 style={{ margin: 0 }}>{t("staff.menu.timed.menus")}</h3>
        <button className="btn small" onClick={() => setEditMenu({ name: "", windows: [{ days: [...MON_FIRST], from: "07:00", to: "11:00" }], branches: ["*"], active: true })} data-testid="new-timed-menu">
          <Plus size={16} /> {t("staff.menu.timed.newMenu")}
        </button>
      </div>
      {!menus.length && <p className="muted" style={{ margin: 0 }}>{t("staff.menu.timed.noMenus")}</p>}
      <div className="list">
        {menus.map((m) => {
          const count = menu.items.filter((i) => i.active && i.menuIds?.includes(m.id)).length;
          const on = m.active && isOn(m.windows, clock);
          return (
            <div key={m.id} className="timed-row" data-testid="timed-menu">
              <div className="meta">
                <div className="row" style={{ gap: 6 }}>
                  <b>{m.name}</b>
                  {on && <span className="badge ok">{t("staff.menu.timed.onNow")}</span>}
                  {m.active && season(m.windows, clock.date) && <span className="badge">{season(m.windows, clock.date)}</span>}
                  {!m.active && <span className="badge">{t("staff.menu.timed.off")}</span>}
                </div>
                <div className="muted">{when(m.windows)}</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {t("staff.menu.timed.dishes", { count })} · {branchName(m.branches)}
                </div>
              </div>
              <button className="btn small" onClick={() => setEditMenu(m)}>
                {t("common.edit")}
              </button>
            </div>
          );
        })}
      </div>

      <div className="row between" style={{ marginTop: 8 }}>
        <h3 style={{ margin: 0 }}>{t("staff.menu.timed.deals")}</h3>
        <button className="btn small" onClick={() => setEditRule({ name: "", kind: "percent", value: 20, categories: [], items: [], windows: [{ days: [...WEEKDAYS], from: "15:00", to: "18:00" }], branches: ["*"], active: true })} data-testid="new-price-rule">
          <Plus size={16} /> {t("staff.menu.timed.newDeal")}
        </button>
      </div>
      {!rules.length && <p className="muted" style={{ margin: 0 }}>{t("staff.menu.timed.noDeals")}</p>}
      <div className="list">
        {rules.map((r) => {
          const on = r.active && isOn(r.windows, clock);
          return (
            <div key={r.id} className="timed-row" data-testid="price-rule">
              <div className="meta">
                <div className="row" style={{ gap: 6 }}>
                  <b>{r.name}</b>
                  <span className="badge deal">
                    <Tag size={12} /> {r.kind === "percent" ? t("staff.menu.timed.summaryPercent", { value: r.value }) : t("staff.menu.timed.summaryAmount", { amount: f.money(r.value, currency) })}
                  </span>
                  {on && <span className="badge ok">{t("staff.menu.timed.onNow")}</span>}
                  {r.active && season(r.windows, clock.date) && <span className="badge">{season(r.windows, clock.date)}</span>}
                  {!r.active && <span className="badge">{t("staff.menu.timed.off")}</span>}
                </div>
                <div className="muted">{when(r.windows)}</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {covered(r)} · {branchName(r.branches)}
                </div>
              </div>
              <button className="btn small" onClick={() => setEditRule(r)}>
                {t("common.edit")}
              </button>
            </div>
          );
        })}
      </div>

      {editMenu && <TimedMenuModal draft={editMenu} onClose={() => setEditMenu(null)} onDone={async () => (setEditMenu(null), await onChange())} />}
      {editRule && <PriceRuleModal draft={editRule} menu={menu} currency={currency} onClose={() => setEditRule(null)} onDone={async () => (setEditRule(null), await onChange())} />}
    </section>
  );
}

/** Weekly times: for each, the days and from–to. */
function WindowsField({ windows, onChange }: { windows: Window[]; onChange: (w: Window[]) => void }) {
  const { t, locale } = useI18n();
  const names = weekdayNames(locale);
  const set = (i: number, p: Partial<Window>) => onChange(windows.map((w, j) => (j === i ? { ...w, ...p } : w)));
  return (
    <fieldset className="menu-fieldset col">
      <legend>{t("staff.menu.timed.when")}</legend>
      {windows.map((w, i) => (
        <div key={i} className="timed-window" data-testid="timed-window">
          <div className="day-picks" role="group" aria-label={t("staff.menu.timed.when")}>
            {MON_FIRST.map((d) => (
              <button key={d} type="button" className="chip" aria-pressed={w.days.includes(d)} onClick={() => set(i, { days: w.days.includes(d) ? w.days.filter((x) => x !== d) : [...w.days, d] })}>
                {names[d]}
              </button>
            ))}
          </div>
          <div className="row nowrap" style={{ alignItems: "flex-end" }}>
            <label>
              {t("staff.menu.timed.from")}
              <input type="time" value={w.from} required onChange={(e) => set(i, { from: e.target.value })} />
            </label>
            <label>
              {t("staff.menu.timed.to")}
              <input type="time" value={w.to} required onChange={(e) => set(i, { to: e.target.value })} />
            </label>
            {windows.length > 1 && (
              <button type="button" className="btn small icon ghost" onClick={() => onChange(windows.filter((_, j) => j !== i))} aria-label={t("staff.menu.timed.removeTime")}>
                <X size={16} />
              </button>
            )}
          </div>
          {toMinutes(w.to) <= toMinutes(w.from) && <span className="hint">{t("staff.menu.timed.overnight")}</span>}
        </div>
      ))}
      <button type="button" className="btn small ghost" style={{ alignSelf: "flex-start" }} onClick={() => onChange([...windows, { ...windows[windows.length - 1] }])}>
        <Plus size={15} /> {t("staff.menu.timed.addTime")}
      </button>
    </fieldset>
  );
}

/** The first and last day it runs, for every time at once: a season or a promotion. Empty: all year. */
function DatesField({ windows, onChange }: { windows: Window[]; onChange: (w: Window[]) => void }) {
  const { t } = useI18n();
  const { start, end, mixed } = datesOf(windows);
  return (
    <fieldset className="menu-fieldset col" data-testid="timed-dates">
      <legend>
        <CalendarDays size={15} strokeWidth={1.75} aria-hidden="true" /> {t("staff.menu.timed.dates")}
      </legend>
      <span className="hint">{t("staff.menu.timed.datesHint")}</span>
      <div className="row nowrap" style={{ alignItems: "flex-end" }}>
        <label>
          {t("staff.menu.timed.startDate")}
          <input type="date" value={start} max={end || undefined} onChange={(e) => onChange(withDates(windows, e.target.value, end))} data-testid="timed-start" />
        </label>
        <label>
          {t("staff.menu.timed.endDate")}
          <input type="date" value={end} min={start || undefined} onChange={(e) => onChange(withDates(windows, start, e.target.value))} data-testid="timed-end" />
        </label>
        {(start || end || mixed) && (
          <button type="button" className="btn small ghost" onClick={() => onChange(withDates(windows, "", ""))}>
            {t("staff.menu.timed.allYear")}
          </button>
        )}
      </div>
      {mixed && <span className="hint">{t("staff.menu.timed.datesMixed")}</span>}
    </fieldset>
  );
}

function BranchesField({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const s = useStaff();
  const { t } = useI18n();
  const branches = s.tenant?.branches ?? [];
  if (branches.length < 2) return null;
  const all = value.includes("*");
  return (
    <fieldset className="menu-fieldset">
      <legend>{t("staff.menu.timed.branches")}</legend>
      <div className="row">
        <label className="inline">
          <input type="checkbox" checked={all} onChange={(e) => onChange(e.target.checked ? ["*"] : [])} /> {t("staff.menu.timed.allBranches")}
        </label>
        {!all &&
          branches.map((b) => (
            <label key={b.id} className="inline">
              <input type="checkbox" checked={value.includes(b.id)} onChange={(e) => onChange(e.target.checked ? [...value, b.id] : value.filter((x) => x !== b.id))} /> {b.name}
            </label>
          ))}
      </div>
    </fieldset>
  );
}

function TimedMenuModal({ draft, onClose, onDone }: { draft: MenuDraft; onClose: () => void; onDone: () => Promise<void> }) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  const [m, setM] = useState(draft);
  useEffect(() => setM(draft), [draft]);
  const ok = m.windows.every((w) => w.days.length) && !datesBackwards(m.windows);
  const save = () =>
    run(async () => {
      await api("/api/m/menu/timed", { body: { id: m.id, name: m.name, windows: m.windows, branches: m.branches.length ? m.branches : ["*"], active: m.active } });
      await onDone();
    }, t("staff.menu.timed.saved"));
  return (
    <Modal open onClose={onClose} title={m.id ? t("staff.menu.timed.menuTitleEdit", { name: draft.name }) : t("staff.menu.timed.menuTitleNew")}>
      <form className="col" onSubmit={(e) => (e.preventDefault(), ok && save())}>
        <label>
          {t("staff.menu.timed.name")}
          <input value={m.name} maxLength={40} required placeholder={t("staff.menu.timed.menuNamePlaceholder")} onChange={(e) => setM({ ...m, name: e.target.value })} />
        </label>
        <WindowsField windows={m.windows} onChange={(windows) => setM({ ...m, windows })} />
        <DatesField windows={m.windows} onChange={(windows) => setM({ ...m, windows })} />
        <BranchesField value={m.branches} onChange={(branches) => setM({ ...m, branches })} />
        <label className="inline">
          <input type="checkbox" checked={m.active} onChange={(e) => setM({ ...m, active: e.target.checked })} /> {t("staff.menu.timed.active")}
        </label>
        {!ok && <p className="hint" role="alert">{t(datesBackwards(m.windows) ? "staff.menu.timed.datesOrder" : "staff.menu.timed.needsDay")}</p>}
        <div className="row between">
          <button className="btn primary" disabled={pending || !ok}>
            {t("common.save")}
          </button>
          {m.id && (
            <button type="button" className="btn danger" disabled={pending} onClick={() => run(async () => (await api(`/api/m/menu/timed/${m.id}`, { method: "DELETE" }), await onDone()), t("staff.menu.timed.removed"))}>
              {t("staff.menu.timed.remove")}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

function PriceRuleModal({ draft, menu, currency, onClose, onDone }: { draft: RuleDraft; menu: Menu; currency: string; onClose: () => void; onDone: () => Promise<void> }) {
  const { t, f } = useI18n();
  const { run, pending } = useAction();
  const [r, setR] = useState(draft);
  useEffect(() => setR(draft), [draft]);
  const ok = r.windows.every((w) => w.days.length) && !datesBackwards(r.windows) && r.value > 0 && (r.kind !== "percent" || r.value < 100);
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const dishes = useMemo(() => menu.items.filter((i) => i.active), [menu]);
  const save = () =>
    run(async () => {
      await api("/api/m/menu/rules", { body: { id: r.id, name: r.name, kind: r.kind, value: r.value, categories: r.categories, items: r.items, windows: r.windows, branches: r.branches.length ? r.branches : ["*"], active: r.active } });
      await onDone();
    }, t("staff.menu.timed.saved"));
  return (
    <Modal open onClose={onClose} title={r.id ? t("staff.menu.timed.dealTitleEdit", { name: draft.name }) : t("staff.menu.timed.dealTitleNew")}>
      <form className="col" onSubmit={(e) => (e.preventDefault(), ok && save())}>
        <label>
          {t("staff.menu.timed.name")}
          <input value={r.name} maxLength={40} required placeholder={t("staff.menu.timed.dealNamePlaceholder")} onChange={(e) => setR({ ...r, name: e.target.value })} />
        </label>
        <fieldset className="menu-fieldset">
          <legend>{t("staff.menu.timed.discount")}</legend>
          <div className="row nowrap" style={{ alignItems: "center" }}>
            <input
              type="number"
              min={1}
              max={r.kind === "percent" ? 99 : undefined}
              step={r.kind === "percent" ? 1 : 0.1}
              value={r.kind === "percent" ? r.value : r.value / 100}
              onChange={(e) => setR({ ...r, value: r.kind === "percent" ? Number(e.target.value) : Math.round(Number(e.target.value) * 100) })}
              style={{ width: 110 }}
              aria-label={t("staff.menu.timed.discount")}
              data-testid="rule-value"
            />
            <div className="segmented" role="group" aria-label={t("staff.menu.timed.discount")}>
              <button type="button" aria-pressed={r.kind === "percent"} className={r.kind === "percent" ? "active" : ""} onClick={() => setR({ ...r, kind: "percent", value: 20 })}>
                {t("staff.menu.timed.percentOff")}
              </button>
              <button type="button" aria-pressed={r.kind === "amount"} className={r.kind === "amount" ? "active" : ""} onClick={() => setR({ ...r, kind: "amount", value: 200 })}>
                {t("staff.menu.timed.amountOff", { currency })}
              </button>
            </div>
            {r.kind === "amount" && <span className="muted">{f.money(r.value, currency)}</span>}
          </div>
        </fieldset>
        <fieldset className="menu-fieldset col">
          <legend>{t("staff.menu.timed.covers")}</legend>
          <span className="hint">{t("staff.menu.timed.coversHint")}</span>
          <div className="chips" style={{ flexWrap: "wrap" }}>
            {menu.categories.map((c) => (
              <button key={c.id} type="button" className="chip" aria-pressed={r.categories.includes(c.id)} onClick={() => setR({ ...r, categories: toggle(r.categories, c.id) })}>
                {c.name}
              </button>
            ))}
          </div>
          <details>
            <summary className="muted" style={{ cursor: "pointer" }}>
              {t("staff.menu.timed.dishes", { count: r.items.length })}
            </summary>
            <div className="chips" style={{ flexWrap: "wrap", marginTop: 8 }}>
              {dishes.map((i) => (
                <button key={i.id} type="button" className="chip" aria-pressed={r.items.includes(i.id)} onClick={() => setR({ ...r, items: toggle(r.items, i.id) })}>
                  {i.name}
                </button>
              ))}
            </div>
          </details>
        </fieldset>
        <WindowsField windows={r.windows} onChange={(windows) => setR({ ...r, windows })} />
        <DatesField windows={r.windows} onChange={(windows) => setR({ ...r, windows })} />
        <BranchesField value={r.branches} onChange={(branches) => setR({ ...r, branches })} />
        <label className="inline">
          <input type="checkbox" checked={r.active} onChange={(e) => setR({ ...r, active: e.target.checked })} /> {t("staff.menu.timed.active")}
        </label>
        {!ok && <p className="hint" role="alert">{t(datesBackwards(r.windows) ? "staff.menu.timed.datesOrder" : r.windows.every((w) => w.days.length) ? "staff.menu.timed.needsDiscount" : "staff.menu.timed.needsDay")}</p>}
        <div className="row between">
          <button className="btn primary" disabled={pending || !ok}>
            {t("common.save")}
          </button>
          {r.id && (
            <button type="button" className="btn danger" disabled={pending} onClick={() => run(async () => (await api(`/api/m/menu/rules/${r.id}`, { method: "DELETE" }), await onDone()), t("staff.menu.timed.removed"))}>
              {t("staff.menu.timed.remove")}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

/** In the dish editor: which timed menus the dish is on (none = all day). */
export function ServedOnField({ menus, value, onChange }: { menus: TimedMenu[]; value: string[]; onChange: (v: string[]) => void }) {
  const { t } = useI18n();
  if (!menus.length) return null;
  return (
    <fieldset className="menu-fieldset col">
      <legend>{t("staff.menu.timed.servedOn")}</legend>
      <span className="hint">{t("staff.menu.timed.servedOnHint")}</span>
      <div className="chips" style={{ flexWrap: "wrap" }} data-testid="served-on">
        {menus.map((m) => (
          <button key={m.id} type="button" className="chip" aria-pressed={value.includes(m.id)} onClick={() => onChange(value.includes(m.id) ? value.filter((x) => x !== m.id) : [...value, m.id])}>
            {m.name}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
