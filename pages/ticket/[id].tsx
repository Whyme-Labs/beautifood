// Queue ticket tracker: number, place in line, ETA, preorder, push alerts, and the table link once seated.
import { useEffect, useRef, useState } from "react";
import { useParams } from "@void/react";
import { Bell, BellOff, LogOut, PartyPopper, UtensilsCrossed } from "lucide-react";
import { api } from "../../src/ui/api";
import { usePoll, useQuery } from "../../src/ui/hooks";
import { ErrorBox, Mins, Punches, Status, Stub, stockOf, useAction } from "../../src/ui/components";
import { GuestBar } from "../../src/ui/guest";
import { useI18n } from "../../src/i18n/react";

interface Ticket {
  id: string;
  number: string;
  status: string;
  partySize: number;
  name: string;
  position: number;
  ahead: number;
  etaMinutes: number | null;
  calledTables: string[];
  seating: { tables: string[] } | null;
  tableLink: string | null;
  preorder: { url: string } | null;
  branch: { id: string; name: string };
}

export default function TicketPage() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const k = useQuery().get("k") ?? "";
  const { run, pending } = useAction();
  const [pushState, setPushState] = useState<"idle" | "on" | "unsupported">("idle");
  const { data: tk, error, refresh } = usePoll(() => (k ? api<Ticket>(`/api/public/tickets/${id}?k=${encodeURIComponent(k)}`) : Promise.resolve(null)), { interval: 4000, deps: [k] });
  const firstSeen = useRef(true);

  useEffect(() => {
    if (tk?.status === "called" && "vibrate" in navigator) navigator.vibrate?.([200, 100, 200]);
  }, [tk?.status]);
  useEffect(() => {
    if (tk) firstSeen.current = false;
  }, [tk]);

  const enablePush = () =>
    run(async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setPushState("unsupported");
      const { publicKey } = await api<{ publicKey: string | null }>("/api/public/push-key");
      if (!publicKey) return setPushState("unsupported");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
      const key = Uint8Array.from(atob(publicKey.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (publicKey.length % 4)) % 4)), (ch) => ch.charCodeAt(0));
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      await api(`/api/public/tickets/${id}/push?k=${encodeURIComponent(k)}`, { body: { endpoint: sub.endpoint } });
      (reg.active ?? (await navigator.serviceWorker.ready).active)?.postMessage({ ticketUrl: `/api/public/tickets/${id}?k=${encodeURIComponent(k)}` });
      setPushState("on");
    }, t("ticket.notifyOn"));

  const preorder = () =>
    run(async () => {
      const r = await api<{ url: string }>(`/api/public/tickets/${id}/preorder?k=${encodeURIComponent(k)}`, { method: "POST" });
      window.location.href = r.url;
    });

  const cancel = () =>
    confirm(t("ticket.leaveConfirm")) &&
    run(async () => {
      await api(`/api/public/tickets/${id}?k=${encodeURIComponent(k)}`, { method: "DELETE" });
      try {
        localStorage.removeItem(`bf.ticket.${tk?.branch.id}`);
      } catch {
        /* ignore */
      }
      await refresh();
    }, t("ticket.left"));

  const live = tk && ["waiting", "called"].includes(tk.status);

  return (
    <>
      <GuestBar>{tk?.branch.name}</GuestBar>
      <main className="narrow">
        <ErrorBox error={error} />
        {tk && (
          <div className="col" style={{ gap: 16 }}>
            <Stub stock={["cancelled", "no_show"].includes(tk.status) ? "X" : stockOf(tk.number)} tear={tk.status === "waiting" ? 76 : 70} issued={firstSeen.current} testId="ticket-stub">
              <div className="row between nowrap">
                <span className="sr-only">{t("ticket.yourNumber")}</span>
                <span />
                <Status s={tk.status} />
              </div>
              <div className="serial mega" data-testid="ticket-number" style={{ margin: "10px 0 4px" }}>
                {tk.number}
              </div>
              <div style={{ fontWeight: 650 }}>
                {tk.name} · {t("ticket.partyOf", { count: tk.partySize })}
              </div>
              {tk.status === "waiting" && (
                <div style={{ marginTop: 14 }}>
                  <Punches ahead={tk.ahead} label={t("ticket.progress")} />
                </div>
              )}
              <div style={{ marginTop: 34, fontSize: 17, fontWeight: 650 }}>
                {tk.status === "waiting" && (
                  <>
                    <div className="ticket-fields">
                      <div>
                        <span>{t("ticket.aheadLabel")}</span>
                        <b className="serial">{tk.ahead}</b>
                      </div>
                      <div>
                        <span>{t("ticket.etaLabel")}</span>
                        <b className="serial">
                          <Mins v={tk.etaMinutes} />
                        </b>
                      </div>
                    </div>
                    <p style={{ margin: "12px 0 0" }} data-testid="ticket-wait">
                      {tk.ahead === 0 ? t("ticket.next") : t("ticket.ahead", { count: tk.ahead })}
                    </p>
                  </>
                )}
                {tk.status === "called" && (
                  <p style={{ margin: 0, fontSize: 19 }} data-testid="ticket-called">
                    <PartyPopper size={20} style={{ verticalAlign: -3, marginRight: 6 }} />
                    {tk.calledTables.length ? t("ticket.calledTable", { tables: tk.calledTables.join(" + ") }) : t("ticket.called")}
                  </p>
                )}
                {tk.status === "seated" && tk.seating && <p style={{ margin: 0 }}>{t("ticket.seated", { tables: tk.seating.tables.join(" + ") })}</p>}
                {["cancelled", "no_show"].includes(tk.status) && <p style={{ margin: 0 }} className="muted">{t("ticket.inactive")}</p>}
              </div>
            </Stub>

            {tk.tableLink && (
              <a className="btn primary big block" href={tk.tableLink} data-testid="table-link">
                <UtensilsCrossed size={20} /> {t("ticket.openTable")}
              </a>
            )}
            {live && (
              <>
                <button className="btn primary big block" onClick={preorder} disabled={pending} data-testid="preorder">
                  <UtensilsCrossed size={20} /> {tk.preorder ? t("ticket.continuePreorder") : t("ticket.preorder")}
                </button>
                {!tk.preorder && (
                  <p className="muted" style={{ margin: "-6px 0 0", textAlign: "center", fontSize: 14 }}>
                    {t("ticket.preorderHint")}
                  </p>
                )}
                {pushState !== "on" && (
                  <button className="btn big block" onClick={enablePush} disabled={pending || pushState === "unsupported"}>
                    {pushState === "unsupported" ? <BellOff size={18} /> : <Bell size={18} />}
                    {pushState === "unsupported" ? t("ticket.notifyUnsupported") : t("ticket.notify")}
                  </button>
                )}
                <button className="btn ghost block danger" onClick={cancel} disabled={pending}>
                  <LogOut size={17} /> {t("ticket.leave")}
                </button>
              </>
            )}
            <p className="muted" style={{ textAlign: "center", fontSize: 13 }}>
              {t("ticket.keepOpen")}
            </p>
          </div>
        )}
      </main>
    </>
  );
}
