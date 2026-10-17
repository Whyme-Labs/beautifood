// Queue ticket tracker: number, place in line, ETA, preorder, push alerts, and the table link once seated.
import { useEffect, useState } from "react";
import { useParams } from "@void/react";
import { api } from "../../src/ui/api";
import { usePoll, useQuery } from "../../src/ui/hooks";
import { ErrorBox, Logo, Mins, Status, useAction } from "../../src/ui/components";

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
  const { id } = useParams<{ id: string }>();
  const k = useQuery().get("k") ?? "";
  const { run, pending } = useAction();
  const [pushState, setPushState] = useState<"idle" | "on" | "unsupported">("idle");
  const { data: t, error, refresh } = usePoll(() => (k ? api<Ticket>(`/api/public/tickets/${id}?k=${encodeURIComponent(k)}`) : Promise.resolve(null)), { interval: 4000, deps: [k] });

  useEffect(() => {
    if (t?.status === "called" && "vibrate" in navigator) navigator.vibrate?.([200, 100, 200]);
  }, [t?.status]);

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
    }, "We'll notify you when your table is ready");

  const preorder = () =>
    run(async () => {
      const r = await api<{ url: string }>(`/api/public/tickets/${id}/preorder?k=${encodeURIComponent(k)}`, { method: "POST" });
      window.location.href = r.url;
    });

  const cancel = () =>
    confirm("Leave the queue?") &&
    run(async () => {
      await api(`/api/public/tickets/${id}?k=${encodeURIComponent(k)}`, { method: "DELETE" });
      try {
        localStorage.removeItem(`bf.ticket.${t?.branch.id}`);
      } catch {
        /* ignore */
      }
      await refresh();
    }, "You've left the queue");

  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <Logo />
          {t && <span className="muted">{t.branch.name}</span>}
        </div>
      </header>
      <main className="narrow">
        <ErrorBox error={error} />
        {t && (
          <div className="col">
            <section className="card" style={{ textAlign: "center" }}>
              <div className="muted">Your number</div>
              <div className="big-number" data-testid="ticket-number">
                {t.number}
              </div>
              <div style={{ marginTop: 8 }}>
                <Status s={t.status} /> <span className="muted">party of {t.partySize}</span>
              </div>
              {t.status === "waiting" && (
                <p style={{ marginTop: 12, fontSize: 18 }} data-testid="ticket-wait">
                  {t.ahead === 0 ? "You're next in line" : `${t.ahead} part${t.ahead === 1 ? "y" : "ies"} ahead`} · estimated wait <b><Mins v={t.etaMinutes} /></b>
                </p>
              )}
              {t.status === "called" && (
                <p style={{ marginTop: 12, fontSize: 20 }} data-testid="ticket-called">
                  🎉 Your table is ready! Please come to the host stand{t.calledTables.length ? ` — table ${t.calledTables.join(" + ")}` : ""}.
                </p>
              )}
              {t.status === "seated" && t.seating && (
                <p style={{ marginTop: 12, fontSize: 18 }}>
                  You're seated at <b>{t.seating.tables.join(" + ")}</b>. Enjoy!
                </p>
              )}
              {["cancelled", "no_show"].includes(t.status) && <p className="muted">This ticket is no longer active.</p>}
            </section>
            {t.tableLink && (
              <a className="btn primary big block" href={t.tableLink} data-testid="table-link">
                Open your table's menu & order
              </a>
            )}
            {["waiting", "called"].includes(t.status) && (
              <>
                <button className="btn big block" onClick={preorder} disabled={pending} data-testid="preorder">
                  🍜 {t.preorder ? "Continue your preorder" : "Order now — food comes when you sit down"}
                </button>
                {pushState !== "on" && (
                  <button className="btn block" onClick={enablePush} disabled={pending || pushState === "unsupported"}>
                    🔔 {pushState === "unsupported" ? "Notifications not available on this device" : "Notify me when my table is ready"}
                  </button>
                )}
                <button className="btn danger block" onClick={cancel} disabled={pending}>
                  Leave the queue
                </button>
              </>
            )}
            <p className="muted" style={{ textAlign: "center", fontSize: 13 }}>
              Keep this page open or bookmark it — it updates by itself.
            </p>
          </div>
        )}
      </main>
    </>
  );
}
