import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Flame, Inbox, Leaf, X } from "lucide-react";
import { MARK_PATH, MARK_VIEWBOX } from "./brand";
import { LOCALES, translate, type MessageKey } from "../i18n/core";
import { useI18n } from "../i18n/react";
import { ApiError } from "./api";

export const Money = ({ v, c = "MYR" }: { v: number; c?: string }) => {
  const { f } = useI18n();
  return <span className="tabular">{f.money(v, c)}</span>;
};
export const Mins = ({ v }: { v: number | null | undefined }) => <>{useI18n().mins(v)}</>;

/** A user-facing message for an error: the server's detailed English text, or the translated code. */
export function errorText(e: unknown, locale: string): string {
  if (e instanceof ApiError) {
    if (locale !== "en") {
      const key = `errors.${e.code}`;
      const msg = translate(locale, key);
      if (msg !== key) return msg;
    }
    return e.message;
  }
  if (e instanceof TypeError) return translate(locale, "errors.network");
  return e instanceof Error ? e.message : translate(locale, "common.somethingWrong");
}

type Toast = { id: number; text: string; bad?: boolean };
const ToastCtx = createContext<(text: string, bad?: boolean) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const show = useCallback((text: string, bad = false) => setToast({ id: Date.now(), text, bad }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.bad ? 5000 : 3200);
    return () => clearTimeout(t);
  }, [toast]);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && (
        <div key={toast.id} className={`toast ${toast.bad ? "bad" : ""}`} role="status" aria-live="polite" data-testid="toast">
          {toast.bad ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          {toast.text}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/** Run an async action with pending state and (translated) error toasts. */
export function useAction() {
  const toast = useToast();
  const { locale } = useI18n();
  const [pending, setPending] = useState(false);
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> => {
      setPending(true);
      try {
        const r = await fn();
        if (ok) toast(ok);
        return r;
      } catch (e) {
        toast(errorText(e, locale), true);
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [toast, locale],
  );
  return { run, pending };
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const { t } = useI18n();
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="grip" />
        <div className="row between nowrap" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="btn ghost small icon" onClick={onClose} aria-label={t("common.close")}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  waiting: "warn",
  called: "brand",
  seated: "ok",
  no_show: "bad",
  free: "ok",
  reserved: "info",
  dirty: "warn",
  open: "warn",
  paid: "ok",
  captured: "ok",
  refunded: "bad",
  partially_refunded: "warn",
  held: "info",
  pending: "warn",
  fired: "brand",
  preparing: "warn",
  ready: "ok",
  void: "bad",
  confirmed: "info",
  checked_in: "ok",
  sending: "warn",
  sent: "ok",
  logged: "info",
  failed: "bad",
  rejected: "bad",
  unconfigured: "warn",
};

export function Status({ s }: { s: string }) {
  const { t } = useI18n();
  const key = `status.${s}` as MessageKey;
  const label = t(key);
  return <span className={`badge ${STATUS_TONE[s] ?? ""}`}>{label === key ? s.replace(/_/g, " ") : label}</span>;
}

export function Allergens({ list }: { list: string[] }) {
  const { t } = useI18n();
  if (!list.length) return null;
  return (
    <div className="tag-row">
      {list.map((a) => (
        <span key={a} className="badge warn">
          {t(`allergens.${a}` as MessageKey)}
        </span>
      ))}
    </div>
  );
}

export function Dietary({ list, spice }: { list: string[]; spice?: number }) {
  const { t } = useI18n();
  const diet = list.includes("vegan") ? "vegan" : list.includes("vegetarian") ? "vegetarian" : null;
  if (!diet && !spice) return null;
  return (
    <div className="tag-row">
      {diet && (
        <span className="badge ok">
          <Leaf /> {t(`diet.${diet}`)}
        </span>
      )}
      {spice ? (
        <span className="badge bad" title={t("diet.spicy", { count: spice })}>
          {Array.from({ length: spice }, (_, i) => (
            <Flame key={i} />
          ))}
          <span className="sr-only">{t("diet.spicy", { count: spice })}</span>
        </span>
      ) : null}
    </div>
  );
}

export const Empty = ({ children, icon }: { children: ReactNode; icon?: ReactNode }) => (
  <div className="empty">
    {icon ?? <Inbox size={28} strokeWidth={1.5} />}
    <div>{children}</div>
  </div>
);

export function ErrorBox({ error }: { error: Error | null }) {
  const { locale } = useI18n();
  if (!error) return null;
  return (
    <div className="alert bad" role="alert">
      <AlertTriangle size={18} />
      <span>{errorText(error, locale)}</span>
    </div>
  );
}

export function Stat({ label, value, testId }: { label: string; value: ReactNode; testId?: string }) {
  return (
    <div className="stat" data-testid={testId}>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

/** The wordmark: the spoon-b mark and the name. */
export function Logo({ href = "/" }: { href?: string }) {
  return (
    <a href={href} className="logo" aria-label="Beautifood">
      <svg viewBox={MARK_VIEWBOX} aria-hidden="true">
        <path d={MARK_PATH} fill="currentColor" fillRule="evenodd" />
      </svg>
      beautifood
    </a>
  );
}

/** EN | 中 switcher. Every registered locale appears; adding a language adds a button. */
export function LangSwitch() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div className="lang-switch" role="group" aria-label={t("common.language")}>
      {LOCALES.map((l) => (
        <button key={l.code} type="button" aria-pressed={locale === l.code} onClick={() => setLocale(l.code)} lang={l.code} title={l.label}>
          {l.code === "en" ? "EN" : l.code === "zh" ? "中" : l.code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/** The signature: a perforated ticket stub, coloured by stock (party-size class letter). */
export function Stub({ stock = "A", tear = 66, issued, children, className = "", testId }: { stock?: string; tear?: number; issued?: boolean; children: ReactNode; className?: string; testId?: string }) {
  const s = /^[A-D]$/.test(stock) ? stock : "X";
  return (
    <div className={`stub ${issued ? "issued" : ""} ${className}`} data-stock={s} style={{ ["--tear" as string]: `${tear}%` }} data-testid={testId}>
      {children}
    </div>
  );
}

/** Punches: how many parties are ahead, with your own hole last. Capped for long queues. */
export function Punches({ ahead, max = 12, label }: { ahead: number; max?: number; label: string }) {
  const shown = Math.min(ahead, max);
  return (
    <div className="punches" role="img" aria-label={label}>
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} className="punch" />
      ))}
      {ahead > max && <span className="muted" style={{ fontWeight: 700 }}>+{ahead - max}</span>}
      <span className="punch you" />
    </div>
  );
}

/** A queue class's display name: the four defaults are translated, custom names shown as written. */
export function useClassLabel() {
  const { t } = useI18n();
  return (label: string) => {
    const key = `queueClass.${label}` as MessageKey;
    const tr = t(key);
    return tr === key ? label : tr;
  };
}

/** The stock letter for a ticket number like "B012" or a category prefix. */
export const stockOf = (numberOrCode: string | null | undefined) => (numberOrCode ?? "").trim().charAt(0).toUpperCase();
