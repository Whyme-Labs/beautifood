// Branch settings: queue size classes, seating strategy, QR mode, rates, modules, bookings; loyalty program;
// the printed receipt's design (restaurant-wide, or this branch's own).
import { useEffect, useState } from "react";
import { Languages, Plus, Store, X } from "lucide-react";
import { api } from "../../src/ui/api";
import { useStaff, type TenantInfo } from "../../src/ui/staff";
import { useAction } from "../../src/ui/components";
import { ReceiptSettingsCard } from "../../src/ui/receiptSettings";
import { LOCALES, type MessageKey } from "../../src/i18n/core";
import { useI18n } from "../../src/i18n/react";
import type { BranchConfig } from "../../src/shared/types";

const STRATEGIES = ["smart", "best_fit", "category_fifo", "fifo"] as const;

export default function Settings() {
  const s = useStaff();
  const { t } = useI18n();
  const { run, pending } = useAction();
  const [c, setC] = useState<BranchConfig | null>(null);
  const [newBranch, setNewBranch] = useState("");
  const tenantLang = s.tenant?.menuLanguage ?? "en";
  const [menuLang, setMenuLang] = useState(tenantLang);
  useEffect(() => setC(s.branch?.config ?? null), [s.branch]);
  useEffect(() => setMenuLang(tenantLang), [tenantLang]);
  if (!c) return null;
  const set = (p: Partial<BranchConfig>) => setC({ ...c, ...p });
  const setCat = (i: number, p: Partial<BranchConfig["categories"][number]>) => set({ categories: c.categories.map((x, n) => (n === i ? { ...x, ...p } : x)) });
  const branch = s.branch?.name ?? "";
  const save = () =>
    run(async () => {
      await api(`/api/m/branches/${s.branchId}/settings`, {
        method: "PATCH",
        body: { categories: c.categories, strategy: c.strategy, maxSkips: c.maxSkips, qrMode: c.qrMode, staticQrSelfSeat: c.staticQrSelfSeat, serviceChargePct: c.serviceChargePct, taxPct: c.taxPct, taxInclusive: c.taxInclusive, cashRounding: c.cashRounding, maxWaiting: c.maxWaiting, holdCalledMinutes: c.holdCalledMinutes, autoCloseOnPay: c.autoCloseOnPay, preorderFire: c.preorderFire, booking: c.booking, modules: c.modules },
      });
      await api("/api/m/tenant", { method: "PATCH", body: { onboarding: { queueReviewed: true } } });
      await s.reload();
    }, t("staff.settings.saved"));
  const saveLanguage = () =>
    run(async () => {
      await api("/api/m/tenant", { method: "PATCH", body: { menuLanguage: menuLang } });
      await s.reload();
    }, t("staff.settings.restaurant.saved"));
  return (
    <div className="col settings" style={{ maxWidth: 900 }}>
      <div className="page-head">
        <div>
          <h1>{t("staff.settings.title", { branch })}</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>{t("staff.settings.lead", { branch })}</p>
        </div>
      </div>
      {s.can("settings.manage") && (
        <section className="card col" data-testid="restaurant-settings">
          <h2>
            <Store size={18} className="settings-icon" aria-hidden="true" /> {t("staff.settings.restaurant.title")}
          </h2>
          <div className="row" style={{ alignItems: "flex-end" }}>
            <label style={{ flex: 1, minWidth: 200 }}>
              {t("staff.settings.restaurant.menuLanguage")}
              <select value={menuLang} onChange={(e) => setMenuLang(e.target.value)} data-testid="menu-language">
                {LOCALES.map((l) => (
                  <option key={l.code} value={l.code} lang={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn" onClick={saveLanguage} disabled={pending || menuLang === tenantLang}>
              <Languages size={18} /> {t("staff.settings.restaurant.save")}
            </button>
          </div>
          <p className="hint" style={{ margin: 0 }}>{t("staff.settings.restaurant.menuLanguageHint")}</p>
        </section>
      )}
      <section className="card col">
        <div>
          <h2 style={{ marginBottom: 4 }}>{t("staff.settings.classes.title")}</h2>
          <p className="muted" style={{ margin: 0 }}>{t("staff.settings.classes.lead")}</p>
        </div>
        {c.categories.map((cat, i) => (
          <div key={i} className="row settings-class" data-stock={/^[A-D]$/.test(cat.prefix) ? cat.prefix : "X"}>
            <span className="settings-swatch" aria-hidden="true" />
            <input value={cat.label} onChange={(e) => setCat(i, { label: e.target.value })} style={{ width: 120 }} aria-label={t("staff.settings.classes.label")} />
            <input value={cat.code} onChange={(e) => setCat(i, { code: e.target.value })} style={{ width: 60 }} aria-label={t("staff.settings.classes.code")} />
            <span className="muted">{t("staff.settings.classes.prefix")}</span>
            <input value={cat.prefix} onChange={(e) => setCat(i, { prefix: e.target.value })} style={{ width: 50 }} aria-label={t("staff.settings.classes.prefix")} />
            <span className="muted">{t("staff.settings.classes.from")}</span>
            <input type="number" value={cat.min} onChange={(e) => setCat(i, { min: Number(e.target.value) })} style={{ width: 64 }} aria-label={t("staff.settings.classes.min")} />
            <span className="muted">{t("staff.settings.classes.to")}</span>
            <input type="number" value={cat.max} onChange={(e) => setCat(i, { max: Number(e.target.value) })} style={{ width: 64 }} aria-label={t("staff.settings.classes.max")} />
            <span className="muted">{t("staff.settings.classes.people")}</span>
            <button className="btn small ghost icon" onClick={() => set({ categories: c.categories.filter((_, n) => n !== i) })} aria-label={t("staff.settings.classes.remove")}>
              <X size={16} />
            </button>
          </div>
        ))}
        <div>
          <button className="btn small" onClick={() => set({ categories: [...c.categories, { code: "X", label: t("staff.settings.classes.newLabel"), prefix: "E", min: 31, max: 40 }] })}>
            <Plus size={15} /> {t("staff.settings.classes.add")}
          </button>
        </div>
      </section>
      <section className="card col">
        <h2>{t("staff.settings.seating.title")}</h2>
        {STRATEGIES.map((k) => (
          <label key={k} className="inline">
            <input type="radio" name="strategy" checked={c.strategy === k} onChange={() => set({ strategy: k })} /> {t(`staff.settings.seating.strategy.${k}`)}
          </label>
        ))}
        <div className="row" style={{ alignItems: "flex-end" }}>
          <label>
            {t("staff.settings.seating.maxSkips")}
            <input type="number" min={0} value={c.maxSkips} onChange={(e) => set({ maxSkips: Number(e.target.value) })} />
          </label>
          <label>
            {t("staff.settings.seating.holdCalled")}
            <input type="number" min={1} value={c.holdCalledMinutes} onChange={(e) => set({ holdCalledMinutes: Number(e.target.value) })} />
          </label>
          <label>
            {t("staff.settings.seating.maxWaiting")}
            <input type="number" min={1} value={c.maxWaiting} onChange={(e) => set({ maxWaiting: Number(e.target.value) })} />
          </label>
        </div>
      </section>
      <section className="card col">
        <h2>{t("staff.settings.qr.title")}</h2>
        <label className="inline">
          <input type="radio" name="qrMode" checked={c.qrMode === "both"} onChange={() => set({ qrMode: "both" })} /> {t("staff.settings.qr.both")}
        </label>
        <label className="inline">
          <input type="radio" name="qrMode" checked={c.qrMode === "static"} onChange={() => set({ qrMode: "static" })} /> {t("staff.settings.qr.static")}
        </label>
        <label className="inline">
          <input type="radio" name="qrMode" checked={c.qrMode === "dynamic"} onChange={() => set({ qrMode: "dynamic" })} /> {t("staff.settings.qr.dynamic")}
        </label>
        <label className="inline">
          <input type="checkbox" checked={c.staticQrSelfSeat} onChange={(e) => set({ staticQrSelfSeat: e.target.checked })} /> {t("staff.settings.qr.selfSeat")}
        </label>
        <label className="inline">
          {t("staff.settings.qr.preorderFire")}
          <select value={c.preorderFire} onChange={(e) => set({ preorderFire: e.target.value as BranchConfig["preorderFire"] })} style={{ width: "auto" }}>
            <option value="on_seat">{t("staff.settings.qr.onSeat")}</option>
            <option value="on_call">{t("staff.settings.qr.onCall")}</option>
          </select>
        </label>
      </section>
      <section className="card col">
        <h2>{t("staff.settings.bill.title")}</h2>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <label>
            {t("staff.settings.bill.serviceCharge")}
            <input type="number" step="0.5" value={c.serviceChargePct} onChange={(e) => set({ serviceChargePct: Number(e.target.value) })} />
          </label>
          <label>
            {t("staff.settings.bill.tax")}
            <input type="number" step="0.5" value={c.taxPct} onChange={(e) => set({ taxPct: Number(e.target.value) })} />
          </label>
          <label>
            {t("staff.settings.bill.rounding")}
            <input type="number" value={c.cashRounding} onChange={(e) => set({ cashRounding: Number(e.target.value) })} />
          </label>
        </div>
        <label className="inline">
          <input type="checkbox" checked={c.taxInclusive} onChange={(e) => set({ taxInclusive: e.target.checked })} /> {t("staff.settings.bill.taxInclusive")}
        </label>
        <label className="inline">
          <input type="checkbox" checked={c.autoCloseOnPay} onChange={(e) => set({ autoCloseOnPay: e.target.checked })} /> {t("staff.settings.bill.autoClose")}
        </label>
      </section>
      <section className="card col">
        <h2>{t("staff.settings.modules.title")}</h2>
        <div className="grid tight">
          {Object.entries(c.modules).map(([k, v]) => {
            const key = `staff.settings.modules.names.${k}` as MessageKey;
            const name = t(key);
            return (
              <label key={k} className="inline">
                <input type="checkbox" checked={v} onChange={(e) => set({ modules: { ...c.modules, [k]: e.target.checked } })} /> {name === key ? k.replace(/([A-Z])/g, " $1").toLowerCase() : name}
              </label>
            );
          })}
        </div>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <label>
            {t("staff.settings.modules.bookingsOpen")}
            <input type="number" min={0} max={23} value={c.booking.openHour} onChange={(e) => set({ booking: { ...c.booking, openHour: Number(e.target.value) } })} />
          </label>
          <label>
            {t("staff.settings.modules.bookingsClose")}
            <input type="number" min={1} max={24} value={c.booking.closeHour} onChange={(e) => set({ booking: { ...c.booking, closeHour: Number(e.target.value) } })} />
          </label>
          <label>
            {t("staff.settings.modules.slot")}
            <input type="number" value={c.booking.slotMinutes} onChange={(e) => set({ booking: { ...c.booking, slotMinutes: Number(e.target.value) } })} />
          </label>
          <label>
            {t("staff.settings.modules.duration")}
            <input type="number" value={c.booking.durationMinutes} onChange={(e) => set({ booking: { ...c.booking, durationMinutes: Number(e.target.value) } })} />
          </label>
        </div>
      </section>
      <div className="sticky-bottom row">
        <button className="btn primary big" onClick={save} disabled={pending}>
          {t("staff.settings.save")}
        </button>
      </div>
      {s.can("settings.manage") && <ReceiptSettingsCard />}
      {s.can("branch.manage") && (
        <section className="card col">
          <h2>{t("staff.settings.branches.title")}</h2>
          <form className="row" onSubmit={(e) => (e.preventDefault(), run(async () => (await api("/api/m/branches", { body: { name: newBranch } }), setNewBranch(""), await s.reload()), t("staff.settings.branches.added")))}>
            <input value={newBranch} onChange={(e) => setNewBranch(e.target.value)} placeholder={t("staff.settings.branches.newName")} style={{ maxWidth: 260 }} aria-label={t("staff.settings.branches.newName")} />
            <button className="btn" disabled={!newBranch}>
              <Plus size={18} /> {t("staff.settings.branches.add")}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
