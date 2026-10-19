// Merchant settings: the printed receipt. A template picker with live thumbnails, the header,
// footer and what to print, and a preview drawn by the same renderer the till prints with
// (a sample bill of the restaurant's own dishes), with a test print on this terminal's printer.
import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, ReceiptText, RotateCcw, Trash2 } from "lucide-react";
import { api } from "./api";
import { usePoll } from "./hooks";
import { useStaff } from "./staff";
import { useAction, useToast } from "./components";
import { useI18n } from "../i18n/react";
import { RECEIPT_LANGUAGES, SHOW_KEYS, TEMPLATE_IDS, TEXT_SIZES, receiptLocale, type ReceiptConfig, type TemplateId } from "../shared/receipt";
import type { Menu } from "../shared/types";
import { paintBitmap, prepareLogo, renderReceipt, sampleBill, type ReceiptJob } from "./receipt";
import { PrinterControl, usePrinter, useReceiptSettings, type ReceiptSettings } from "./receiptPrinter";
import type { Paper } from "./printer";

type Scope = "restaurant" | "branch";

/** Draws a receipt job onto a canvas whenever it changes (after a short pause while typing). */
function ReceiptCanvas({ job, paper, delay = 120, label }: { job: ReceiptJob | null; paper: Paper; delay?: number; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!job) return;
    let live = true;
    const timer = setTimeout(async () => {
      const drawn = await renderReceipt(job, paper).catch(() => null);
      if (live && drawn && ref.current) paintBitmap(ref.current, drawn.bitmap);
    }, delay);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [job, paper, delay]);
  return <canvas ref={ref} role="img" aria-label={label} style={{ width: `${paper === 58 ? 66.7 : 100}%` }} />;
}

export function ReceiptSettingsCard() {
  const s = useStaff();
  const { t, locale } = useI18n();
  const toast = useToast();
  const { run, pending } = useAction();
  const { data, refresh } = useReceiptSettings();
  const { data: menu } = usePoll(() => (s.branchId ? api<Menu>(`/api/m/menu?branch=${s.branchId}`) : Promise.resolve(null)), { interval: 0, deps: [s.branchId] });
  const printer = usePrinter();
  const [scope, setScope] = useState<Scope>("restaurant");
  const [draft, setDraft] = useState<ReceiptConfig | null>(null);
  const [paper, setPaper] = useState<Paper>(printer.settings.paper);
  const fileRef = useRef<HTMLInputElement>(null);
  const branch = s.branch?.name ?? "";

  // start from the design this branch prints with
  const load = (d: ReceiptSettings, sc: Scope) => (setScope(sc), setDraft(sc === "branch" ? (d.branch ?? d.restaurant) : d.restaurant));
  useEffect(() => {
    if (data) load(data, data.branch ? "branch" : "restaurant");
  }, [data]);

  const bill = useMemo(
    () =>
      sampleBill({
        restaurant: s.tenant?.name ?? "",
        branch: s.branch?.name,
        address: s.branch?.address,
        currency: s.tenant?.currency ?? "MYR",
        timezone: s.tenant?.timezone,
        cashier: s.tenant?.me.name,
        menu,
        serviceChargePct: s.branch?.config.serviceChargePct,
        taxPct: s.branch?.config.taxPct,
        cashRounding: s.branch?.config.cashRounding,
        origin: typeof location === "undefined" ? "" : location.origin,
        tenantSlug: s.tenant?.slug,
      }),
    [s.tenant, s.branch, menu],
  );
  const job = useMemo<ReceiptJob | null>(() => (draft ? { bill, config: draft, locale: receiptLocale(draft.language, locale) } : null), [bill, draft, locale]);
  const thumbs = useMemo(() => (job ? Object.fromEntries(TEMPLATE_IDS.map((id) => [id, { ...job, config: { ...job.config, template: id } }])) : null) as Record<TemplateId, ReceiptJob> | null, [job]);
  if (!draft || !data || !job) return null;

  const set = (p: Partial<ReceiptConfig>) => setDraft({ ...draft, ...p });
  const pickLogo = async (f: File | undefined) => {
    if (!f) return;
    try {
      set({ logo: await prepareLogo(f) });
    } catch (e) {
      toast(t(e instanceof Error && e.message === "logo_too_large" ? "staff.settings.receipts.logoTooLarge" : "staff.settings.receipts.logoUnreadable"), true);
    }
  };
  const save = () =>
    run(async () => {
      await api(`/api/m/branches/${s.branchId}/receipt`, { method: "PUT", body: { scope, config: draft } });
      await refresh();
    }, t("staff.settings.receipts.saved"));
  const reset = () =>
    run(async () => {
      await api(`/api/m/branches/${s.branchId}/receipt`, { method: "DELETE" });
      await refresh();
    }, t("staff.settings.receipts.resetDone"));

  return (
    <section className="card col" data-testid="receipt-settings" aria-labelledby="receipts-h">
      <div>
        <h2 id="receipts-h" style={{ marginBottom: 4 }}>
          <ReceiptText size={18} strokeWidth={1.75} className="settings-icon" aria-hidden="true" /> {t("staff.settings.receipts.title")}
        </h2>
        <p className="muted" style={{ margin: 0 }}>{t("staff.settings.receipts.lead")}</p>
      </div>
      {s.tenant && s.tenant.branches.length > 1 && (
        <div className="row">
          <span className="muted">{t("staff.settings.receipts.scope")}</span>
          <div className="segmented" role="group" aria-label={t("staff.settings.receipts.scope")}>
            {(["restaurant", "branch"] as const).map((sc) => (
              <button key={sc} type="button" className={scope === sc ? "active" : ""} aria-pressed={scope === sc} onClick={() => load(data, sc)}>
                {sc === "restaurant" ? t("staff.settings.receipts.scopeRestaurant") : t("staff.settings.receipts.scopeBranch", { branch })}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="receipt-editor">
        <div className="col">
          <fieldset className="menu-fieldset">
            <legend>{t("staff.settings.receipts.template")}</legend>
            <div className="receipt-templates">
              {TEMPLATE_IDS.map((id) => (
                <button key={id} type="button" className="receipt-template" aria-pressed={draft.template === id} onClick={() => set({ template: id })} data-testid={`receipt-template-${id}`}>
                  <span className="rt-thumb" aria-hidden="true">
                    {thumbs && <ReceiptCanvas job={thumbs[id]} paper={58} delay={400} label="" />}
                  </span>
                  <span className="rt-label">
                    <b>{t(`staff.settings.receipts.templates.${id}.name`)}</b>
                    <span className="rt-hint">{t(`staff.settings.receipts.templates.${id}.hint`)}</span>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="menu-fieldset col tight">
            <legend>{t("staff.settings.receipts.logo")}</legend>
            <div className="row receipt-logo">
              {draft.logo && <img src={draft.logo.src} alt={t("staff.settings.receipts.logoAlt")} />}
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" tabIndex={-1} onChange={(e) => (pickLogo(e.target.files?.[0]), (e.target.value = ""))} data-testid="receipt-logo-file" />
              <button type="button" className="btn small" onClick={() => fileRef.current?.click()}>
                <ImagePlus size={16} aria-hidden /> {draft.logo ? t("staff.settings.receipts.logoReplace") : t("staff.settings.receipts.logoUpload")}
              </button>
              {draft.logo && (
                <button type="button" className="btn small ghost" onClick={() => set({ logo: null })}>
                  <Trash2 size={16} aria-hidden /> {t("staff.settings.receipts.logoRemove")}
                </button>
              )}
            </div>
            <span className="hint">{t("staff.settings.receipts.logoHint")}</span>
          </fieldset>

          <fieldset className="menu-fieldset col">
            <legend>{t("staff.settings.receipts.header")}</legend>
            <label>
              {t("staff.settings.receipts.businessName")}
              <input value={draft.businessName} maxLength={80} placeholder={s.tenant?.name} onChange={(e) => set({ businessName: e.target.value })} />
              <span className="hint">{t("staff.settings.receipts.businessNameHint", { name: s.tenant?.name ?? "" })}</span>
            </label>
            <label>
              {t("staff.settings.receipts.address")}
              <textarea value={draft.address} maxLength={200} rows={2} style={{ minHeight: 64 }} placeholder={s.branch?.address} onChange={(e) => set({ address: e.target.value })} />
              <span className="hint">{t("staff.settings.receipts.addressHint")}</span>
            </label>
            <div className="row" style={{ alignItems: "flex-start" }}>
              <label className="grow">
                {t("staff.settings.receipts.phone")}
                <input value={draft.phone} maxLength={40} inputMode="tel" onChange={(e) => set({ phone: e.target.value })} />
              </label>
              <label className="grow">
                {t("staff.settings.receipts.taxId")}
                <input value={draft.taxId} maxLength={60} onChange={(e) => set({ taxId: e.target.value })} />
              </label>
            </div>
            <label>
              {t("staff.settings.receipts.footer")}
              <textarea value={draft.footer} maxLength={300} rows={2} style={{ minHeight: 64 }} placeholder={t("staff.pos.receiptThanks")} onChange={(e) => set({ footer: e.target.value })} />
              <span className="hint">{t("staff.settings.receipts.footerHint", { thanks: t("staff.pos.receiptThanks") })}</span>
            </label>
          </fieldset>

          <fieldset className="menu-fieldset">
            <legend>{t("staff.settings.receipts.show.title")}</legend>
            <div className="grid tight">
              {SHOW_KEYS.map((k) => (
                <label key={k} className="inline">
                  <input type="checkbox" checked={draft.show[k]} onChange={(e) => set({ show: { ...draft.show, [k]: e.target.checked } })} /> {t(`staff.settings.receipts.show.${k}`)}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="row" style={{ alignItems: "flex-end" }}>
            <label style={{ flex: 1, minWidth: 200 }}>
              {t("staff.settings.receipts.language")}
              <select value={draft.language} onChange={(e) => set({ language: e.target.value as ReceiptConfig["language"] })} data-testid="receipt-language">
                {RECEIPT_LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {t(`staff.settings.receipts.languages.${l}`)}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="menu-fieldset">
              <legend>{t("staff.settings.receipts.textSize")}</legend>
              <div className="segmented" role="group" aria-label={t("staff.settings.receipts.textSize")}>
                {TEXT_SIZES.map((z) => (
                  <button key={z} type="button" className={draft.textSize === z ? "active" : ""} aria-pressed={draft.textSize === z} onClick={() => set({ textSize: z })}>
                    {t(`staff.settings.receipts.sizes.${z}`)}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="row">
            <button className="btn primary" onClick={save} disabled={pending} data-testid="receipt-save">
              {t("staff.settings.receipts.save")}
            </button>
            {scope === "branch" && data.branch && (
              <button className="btn ghost" onClick={reset} disabled={pending}>
                <RotateCcw size={16} aria-hidden /> {t("staff.settings.receipts.reset")}
              </button>
            )}
          </div>
        </div>

        <div className="receipt-side">
          <div className="row between">
            <h3 style={{ margin: 0 }}>{t("staff.settings.receipts.preview")}</h3>
            <div className="segmented" role="group" aria-label={t("staff.pos.printerPaper")}>
              {([58, 80] as const).map((mm) => (
                <button key={mm} type="button" className={paper === mm ? "active" : ""} aria-pressed={paper === mm} onClick={() => setPaper(mm)}>
                  {t("staff.pos.printerPaperMm", { mm })}
                </button>
              ))}
            </div>
          </div>
          <div className="receipt-paper" data-testid="receipt-preview">
            <ReceiptCanvas job={job} paper={paper} label={t("staff.settings.receipts.preview")} />
          </div>
          <span className="hint">{t("staff.settings.receipts.previewHint")}</span>
          <PrinterControl p={printer} sample={() => job} />
        </div>
      </div>
    </section>
  );
}
