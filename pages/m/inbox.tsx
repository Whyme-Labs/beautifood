// Outbox: every email sent to this restaurant's guests (receipts, sign-in codes, campaigns, queue notifications).
import { useState } from "react";
import { Mail, MailOpen, Search } from "lucide-react";
import { api } from "../../src/ui/api";
import { usePoll } from "../../src/ui/hooks";
import { Empty, ErrorBox, Status } from "../../src/ui/components";
import { useI18n } from "../../src/i18n/react";
import type { MessageKey } from "../../src/i18n/core";

interface Email {
  id: string;
  to_email: string;
  subject: string;
  kind: string;
  status: string;
  created_at: number;
  html?: string;
}

export default function Inbox() {
  const { t, f } = useI18n();
  const [to, setTo] = useState("");
  const [open, setOpen] = useState<Email | null>(null);
  const { data, error } = usePoll(() => api<Email[]>(`/api/m/outbox${to ? `?to=${encodeURIComponent(to)}` : ""}`), { interval: 4000, deps: [to] });
  const kind = (k: string) => {
    const key = `staff.inbox.kinds.${k}` as MessageKey;
    const v = t(key);
    return v === key ? k.replace(/_/g, " ") : v;
  };
  return (
    <div className="col">
      <div className="page-head">
        <div>
          <h1>{t("staff.inbox.title")}</h1>
          <div className="muted">{t("staff.inbox.about")}</div>
        </div>
      </div>
      <div className="split">
        <section className="card col">
          <div className="members-search">
            <Search size={16} aria-hidden="true" />
            <input type="search" value={to} onChange={(e) => setTo(e.target.value)} placeholder={t("staff.inbox.filterPlaceholder")} aria-label={t("staff.inbox.filter")} />
          </div>
          <ErrorBox error={error} />
          {data && !data.length ? (
            <Empty icon={<Mail size={28} strokeWidth={1.5} />}>{to ? t("staff.inbox.noMatch") : t("staff.inbox.none")}</Empty>
          ) : (
            <div className="list inbox-list">
              {data?.map((e) => (
                <button key={e.id} className={`inbox-row${open?.id === e.id ? " on" : ""}`} aria-current={open?.id === e.id ? "true" : undefined} onClick={() => setOpen(e)}>
                  <span className="row between nowrap">
                    <b className="inbox-subject">{e.subject}</b>
                    <span className="muted tabular" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{f.dateTime(e.created_at)}</span>
                  </span>
                  <span className="row nowrap" style={{ fontSize: 12 }}>
                    <span className="muted inbox-to">{e.to_email}</span>
                    <span className="badge">{kind(e.kind)}</span>
                    <Status s={e.status} />
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
        <section className="card inbox-preview">
          {open ? (
            <div className="col">
              <div>
                <h2 style={{ margin: 0 }}>{open.subject}</h2>
                <div className="muted" style={{ fontSize: 13 }}>
                  {t("staff.inbox.to", { email: open.to_email })} · {f.dateTime(open.created_at)}
                </div>
              </div>
              <iframe title={t("staff.inbox.preview")} srcDoc={open.html} style={{ width: "100%", height: 600, border: "none", background: "#fff", borderRadius: 8 }} />
            </div>
          ) : (
            <Empty icon={<MailOpen size={28} strokeWidth={1.5} />}>{t("staff.inbox.select")}</Empty>
          )}
        </section>
      </div>
    </div>
  );
}
