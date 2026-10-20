// This terminal's receipt printer, shared by the till and the receipt settings: the connection
// (per device, reconnected without a prompt), the print queue, the printer settings dialog,
// and the restaurant's receipt design for the current branch.
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bluetooth, Cable, Printer, ReceiptText, Settings2, Usb, Wallet } from "lucide-react";
import { api } from "./api";
import { usePoll } from "./hooks";
import { useStaff } from "./staff";
import { Modal, useToast } from "./components";
import { useI18n } from "../i18n/react";
import type { MessageKey } from "../i18n/core";
import { DEFAULT_RECEIPT, type ReceiptConfig } from "../shared/receipt";
import { receiptBytes, type ReceiptJob } from "./receipt";
import { BAUDS, KINDS, concat, connect, drawerKick, englishTxt, init, loadSettings, printReceiptPage, reconnect, saveSettings, support, testBytes, type Kind, type PrinterLink, type PrinterSettings } from "./printer";

export interface ReceiptSettings {
  /** The restaurant's design, this branch's own (null when it uses the restaurant's), and the one in force. */
  restaurant: ReceiptConfig;
  branch: ReceiptConfig | null;
  effective: ReceiptConfig;
}

/** The current branch's receipt design (the defaults until it loads, or when it can't). */
export function useReceiptSettings() {
  const s = useStaff();
  const q = usePoll(() => (s.branchId ? api<ReceiptSettings>(`/api/m/branches/${s.branchId}/receipt`) : Promise.resolve(null)), { interval: 0, deps: [s.branchId] });
  return { ...q, design: q.data?.effective ?? DEFAULT_RECEIPT };
}

const KIND: Record<Kind, { key: MessageKey; Icon: typeof Usb }> = {
  builtin: { key: "staff.pos.printerBuiltin", Icon: ReceiptText },
  usb: { key: "staff.pos.printerUsb", Icon: Usb },
  serial: { key: "staff.pos.printerSerial", Icon: Cable },
  bluetooth: { key: "staff.pos.printerBluetooth", Icon: Bluetooth },
};

/**
 * This terminal's receipt printer: settings (per device), the live link (reconnected
 * without a prompt on load), and print helpers that report failures as toasts and never throw.
 */
export function usePrinter() {
  const toast = useToast();
  const { t, locale } = useI18n();
  const [settings, setSettings] = useState<PrinterSettings>(loadSettings);
  const [link, setLink] = useState<PrinterLink | null>(null);
  const [busy, setBusy] = useState(false);
  const supported = useMemo(support, []);
  const linkRef = useRef(link);
  const settingsRef = useRef(settings);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  linkRef.current = link;
  settingsRef.current = settings;
  const why = (e: unknown) => (e instanceof Error ? e.message : String(e));
  const lost = useRef(() => {});
  lost.current = () => {
    setLink(null);
    toast(t("staff.pos.printerLost"), true);
  };

  useEffect(() => {
    let live = true;
    reconnect(settingsRef.current.device, settingsRef.current.baud, () => lost.current()).then((l) => (live ? setLink(l) : l?.close().catch(() => {})));
    return () => {
      live = false;
      linkRef.current?.close().catch(() => {});
    };
  }, []);

  const update = (p: Partial<PrinterSettings>) =>
    setSettings((cur) => {
      const next = { ...cur, ...p };
      saveSettings(next);
      return next;
    });

  /** Queue a write so a receipt and a test print never interleave; false when it failed. */
  const write = (build: () => Uint8Array | Promise<Uint8Array>): Promise<boolean> => {
    const job = queue.current.then(async () => {
      const l = linkRef.current;
      if (!l) return false;
      try {
        await l.write(await build());
        return true;
      } catch (e) {
        toast(t("staff.pos.printerFailed", { error: why(e) }), true);
        return false;
      }
    });
    queue.current = job;
    return job;
  };
  const receipt = (job: () => ReceiptJob, openDrawer = false) => write(() => receiptBytes(job(), settingsRef.current.paper, openDrawer));
  const anySupport = supported.builtin || supported.usb || supported.serial || supported.bluetooth;

  return {
    settings,
    link,
    busy,
    supported,
    update,
    async connect(kind: Kind) {
      setBusy(true);
      try {
        await linkRef.current?.close().catch(() => {});
        const l = await connect(kind, settingsRef.current.baud, () => lost.current());
        setLink(l);
        update({ device: l.device });
        toast(t("staff.pos.printerConnected"));
      } catch (e) {
        // closing the browser's device chooser is not an error
        if (!(e instanceof DOMException && e.name === "NotFoundError")) toast(t("staff.pos.printerConnectFailed", { error: why(e) }), true);
      } finally {
        setBusy(false);
      }
    },
    async disconnect() {
      await linkRef.current?.close().catch(() => {});
      setLink(null);
      update({ device: null });
      toast(t("staff.pos.printerDisconnected"));
    },
    /** A sample receipt in the restaurant's design, or the text-mode test page without one. */
    test: (sample?: () => ReceiptJob) =>
      sample ? receipt(sample) : write(() => testBytes(englishTxt(locale, "staff.pos.printerTestTitle"), englishTxt(locale, "staff.pos.printerTestLine"), { paper: settingsRef.current.paper })),
    kick: () => write(() => concat([init(), drawerKick()])),
    /** After a saved payment: the receipt (when the bill settled) and the drawer kick (on cash). */
    afterPayment(cash: boolean, job: (() => ReceiptJob) | null, token: string | null) {
      const s = settingsRef.current;
      const kick = cash && s.drawerOnCash;
      try {
        if (linkRef.current) {
          if (job && s.autoPrint) receipt(job, kick);
          else if (kick) write(() => concat([init(), drawerKick()]));
        } else if (job && s.autoPrint && token && !anySupport) printReceiptPage(token);
      } catch (e) {
        toast(t("staff.pos.printerFailed", { error: why(e) }), true);
      }
    },
    /** Reprint: on the printer when connected, else the e-receipt in the print dialog. */
    printReceipt(job: () => ReceiptJob, token: string) {
      if (linkRef.current) receipt(job);
      else printReceiptPage(token);
    },
  };
}
export type PrinterApi = ReturnType<typeof usePrinter>;

/** The printer chip (name, connect or test) and its settings dialog; `sample` is what "Test print" prints. */
export function PrinterControl({ p, sample }: { p: PrinterApi; sample?: () => ReceiptJob }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const kinds = KINDS.filter((k) => p.supported[k]);
  const kindName = (k: Kind) => t(KIND[k].key);
  const name = p.link ? p.link.name || t("staff.pos.printerDevice", { kind: kindName(p.link.kind) }) : null;
  const test = () => p.test(sample);
  return (
    <>
      <div className="pos-drawer" data-testid="printer">
        <Printer size={16} aria-hidden />
        {name ? <span>{name}</span> : <span className="muted">{t("staff.pos.printerNone")}</span>}
        {p.link ? (
          <button className="btn small" onClick={test}>
            {t("staff.pos.printerTest")}
          </button>
        ) : (
          kinds.length > 0 && (
            <button className="btn small" disabled={p.busy} onClick={() => (kinds.length === 1 ? p.connect(kinds[0]) : setOpen(true))}>
              {t("staff.pos.printerConnect")}
            </button>
          )
        )}
        <button className="btn small icon ghost" onClick={() => setOpen(true)} aria-label={t("staff.pos.printerSettings")} title={t("staff.pos.printerSettings")}>
          <Settings2 size={16} />
        </button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={t("staff.pos.printer")}>
        <div className="col" data-testid="printer-settings">
          {kinds.length ? (
            <p className="muted" style={{ margin: 0 }}>
              {t("staff.pos.printerHint")}
            </p>
          ) : (
            <div className="alert info" role="status">
              <AlertTriangle size={18} />
              <span>{t("staff.pos.printerUnsupported")}</span>
            </div>
          )}
          {p.link ? (
            <div className="row">
              <span className="badge ok">{t("staff.pos.printerConnected")}</span>
              <b>{name}</b>
              <button className="btn small" onClick={test}>
                <Printer size={16} aria-hidden /> {t("staff.pos.printerTest")}
              </button>
              <button className="btn small" onClick={p.kick}>
                <Wallet size={16} aria-hidden /> {t("staff.pos.printerKick")}
              </button>
              <button className="btn small ghost" onClick={p.disconnect}>
                {t("staff.pos.printerDisconnect")}
              </button>
            </div>
          ) : (
            kinds.length > 0 && (
              <div className="row">
                {kinds.map((k) => {
                  const { Icon } = KIND[k];
                  return (
                    <button key={k} className="btn small" disabled={p.busy} onClick={() => p.connect(k)}>
                      <Icon size={16} aria-hidden /> {t("staff.pos.printerConnectVia", { kind: kindName(k) })}
                    </button>
                  );
                })}
              </div>
            )
          )}
          <div className="row">
            <span className="muted">{t("staff.pos.printerPaper")}</span>
            <div className="segmented" role="group" aria-label={t("staff.pos.printerPaper")}>
              {([58, 80] as const).map((mm) => (
                <button key={mm} type="button" className={p.settings.paper === mm ? "active" : ""} aria-pressed={p.settings.paper === mm} onClick={() => p.update({ paper: mm })}>
                  {t("staff.pos.printerPaperMm", { mm })}
                </button>
              ))}
            </div>
          </div>
          {p.supported.serial && (
            <label className="inline">
              {t("staff.pos.printerBaud")}
              <select value={p.settings.baud} onChange={(e) => p.update({ baud: Number(e.target.value) })} style={{ width: "auto" }}>
                {BAUDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="inline">
            <input type="checkbox" checked={p.settings.drawerOnCash} onChange={(e) => p.update({ drawerOnCash: e.target.checked })} /> {t("staff.pos.printerDrawerOnCash")}
          </label>
          <label className="inline">
            <input type="checkbox" checked={p.settings.autoPrint} onChange={(e) => p.update({ autoPrint: e.target.checked })} /> {t("staff.pos.printerAutoPrint")}
          </label>
        </div>
      </Modal>
    </>
  );
}
