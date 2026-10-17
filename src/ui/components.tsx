import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { formatMoney, minutesLabel } from "../shared/format";
import { ALLERGEN_LABELS } from "../shared/allergens";
import { ApiError } from "./api";

export const Money = ({ v, c = "MYR" }: { v: number; c?: string }) => <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatMoney(v, c)}</span>;
export const Mins = ({ v }: { v: number | null | undefined }) => <>{minutesLabel(v)}</>;

type Toast = { id: number; text: string; bad?: boolean };
const ToastCtx = createContext<(text: string, bad?: boolean) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const show = useCallback((text: string, bad = false) => setToast({ id: Date.now(), text, bad }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && (
        <div className={`toast ${toast.bad ? "bad" : ""}`} role="status" aria-live="polite" data-testid="toast">
          {toast.text}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/** Run an async action with pending state and error toasts. */
export function useAction() {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> => {
      setPending(true);
      try {
        const r = await fn();
        if (ok) toast(ok);
        return r;
      } catch (e) {
        toast(e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong", true);
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [toast],
  );
  return { run, pending };
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="btn ghost small" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const STATUS: Record<string, string> = {
  waiting: "warn",
  called: "info",
  seated: "ok",
  cancelled: "",
  no_show: "bad",
  free: "ok",
  reserved: "info",
  dirty: "warn",
  blocked: "",
  open: "warn",
  paid: "ok",
  refunded: "bad",
  partially_refunded: "warn",
  held: "info",
  pending: "warn",
  fired: "brand",
  preparing: "warn",
  ready: "ok",
  served: "",
  void: "bad",
  confirmed: "info",
  checked_in: "ok",
  completed: "",
  draft: "",
  sending: "warn",
  sent: "ok",
};

export const Status = ({ s }: { s: string }) => <span className={`badge ${STATUS[s] ?? ""}`}>{s.replace(/_/g, " ")}</span>;

export const Allergens = ({ list }: { list: string[] }) =>
  list.length ? (
    <div className="tag-row">
      {list.map((a) => (
        <span key={a} className="badge warn" title={ALLERGEN_LABELS[a as keyof typeof ALLERGEN_LABELS] ?? a}>
          {(ALLERGEN_LABELS[a as keyof typeof ALLERGEN_LABELS] ?? a).split(" (")[0]}
        </span>
      ))}
    </div>
  ) : null;

export const Dietary = ({ list, spice }: { list: string[]; spice?: number }) => (
  <div className="tag-row">
    {list.includes("vegan") ? <span className="badge ok">vegan</span> : list.includes("vegetarian") ? <span className="badge ok">vegetarian</span> : null}
    {spice ? <span className="badge bad">{"🌶".repeat(spice)}</span> : null}
  </div>
);

export const Empty = ({ children }: { children: ReactNode }) => <div className="muted" style={{ padding: "18px 0", textAlign: "center" }}>{children}</div>;

export const ErrorBox = ({ error }: { error: Error | null }) => (error ? <div className="card flat" style={{ borderColor: "var(--bad)", color: "var(--bad)" }}>{error.message}</div> : null);

export function Stat({ label, value, testId }: { label: string; value: ReactNode; testId?: string }) {
  return (
    <div className="stat" data-testid={testId}>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

export function Logo() {
  return (
    <a href="/" className="logo" style={{ textDecoration: "none" }}>
      beauti<span>food</span>
    </a>
  );
}
