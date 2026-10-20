// The storefront's web addresses: the page on Beautifood, the restaurant's subdomain, and its own
// domains. Adding a domain shows the DNS record to add; it goes live by itself once Cloudflare sees
// the record (checked every minute at first), or right away with "Check now".
import { useState } from "react";
import { Check, Copy, Globe, RefreshCw, Trash2 } from "lucide-react";
import { api } from "./api";
import { usePoll } from "./hooks";
import { useAction, useToast } from "./components";
import { useI18n } from "../i18n/react";
import type { MessageKey } from "../i18n/core";
import type { CustomDomain, DomainStatus } from "../shared/domains";

interface Domains {
  domains: CustomDomain[];
  target: string;
  available: boolean;
  urls: { primary: string; subdomain: string | null; path: string; custom: string[] };
}

const TONE: Record<DomainStatus, string> = { active: "ok", pending: "warn", failed: "bad" };
const shown = (u: string) => u.replace(/^https?:\/\//, "");

export function StorefrontDomains({ tenantId }: { tenantId?: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const { run, pending } = useAction();
  const [host, setHost] = useState("");
  const { data, refresh } = usePoll(() => api<Domains>("/api/m/storefront/domains"), { interval: 20_000, deps: [tenantId] });
  if (!data) return null;
  const k = (s: string) => t(`staff.storefront.domains.${s}` as MessageKey);
  const add = () =>
    run(async () => {
      await api("/api/m/storefront/domains", { body: { hostname: host } });
      setHost("");
      await refresh();
    });
  const check = (h: string) =>
    run(async () => {
      const r = await api<CustomDomain>(`/api/m/storefront/domains/${encodeURIComponent(h)}`, { method: "POST" });
      await refresh();
      if (r.status === "active") toast(k("nowLive"));
    });
  const remove = (h: string) =>
    run(async () => {
      if (!confirm(t("staff.storefront.domains.removeConfirm", { host: h }))) return;
      await api(`/api/m/storefront/domains/${encodeURIComponent(h)}`, { method: "DELETE" });
      await refresh();
    });
  const copy = (v: string) => navigator.clipboard.writeText(v).then(() => toast(k("copied")));

  return (
    <section className="card col" data-testid="sf-domains">
      <h2 className="row nowrap" style={{ margin: 0 }}>
        <Globe size={18} strokeWidth={1.75} aria-hidden="true" /> {k("title")}
      </h2>
      <div className="list">
        {[...(data.urls.subdomain ? [data.urls.subdomain] : []), data.urls.path].map((u) => (
          <div key={u} className="row between nowrap">
            <a href={u} target="_blank" rel="noreferrer" style={{ overflowWrap: "anywhere" }}>
              {shown(u)}
            </a>
            <span className="badge ok">{k("status.active")}</span>
          </div>
        ))}
      </div>

      {data.domains.map((d) => (
        <div key={d.hostname} className="col sf-domain" data-testid="sf-domain" data-status={d.status}>
          <div className="row between nowrap">
            {d.status === "active" ? (
              <a href={`https://${d.hostname}`} target="_blank" rel="noreferrer" style={{ overflowWrap: "anywhere" }}>
                {d.hostname}
              </a>
            ) : (
              <b style={{ overflowWrap: "anywhere" }}>{d.hostname}</b>
            )}
            <span className="row nowrap">
              <span className={`badge ${TONE[d.status]}`}>{k(`status.${d.status}`)}</span>
              {d.status !== "active" && (
                <button type="button" className="btn small ghost icon" disabled={pending} onClick={() => check(d.hostname)} aria-label={k("check")} title={k("check")}>
                  <RefreshCw size={15} />
                </button>
              )}
              <button type="button" className="btn small ghost icon" disabled={pending} onClick={() => remove(d.hostname)} aria-label={k("remove")} title={k("remove")}>
                <Trash2 size={15} />
              </button>
            </span>
          </div>
          {d.status !== "active" && (
            <>
              <p className="hint" style={{ margin: 0 }}>{d.status === "failed" ? k("failedHint") : k("pendingHint")}</p>
              {d.detail && <div className={`alert ${d.status === "failed" ? "bad" : "sun"}`}>{d.detail}</div>}
              <div className="sf-records" role="table" aria-label={k("records")}>
                <div role="row" className="sf-record head">
                  <span role="columnheader">{k("type")}</span>
                  <span role="columnheader">{k("name")}</span>
                  <span role="columnheader">{k("value")}</span>
                </div>
                {d.records.map((r) => (
                  <div role="row" key={r.type + r.name} className="sf-record">
                    <span role="cell">
                      <code>{r.type}</code>
                    </span>
                    <span role="cell">
                      <code>{r.name}</code>
                    </span>
                    <span role="cell" className="row nowrap">
                      <code>{r.value}</code>
                      <button type="button" className="btn small ghost icon" onClick={() => copy(r.value)} aria-label={k("copy")}>
                        <Copy size={14} />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ))}

      {data.available ? (
        data.domains.length < 3 && (
          <form className="col" onSubmit={(e) => (e.preventDefault(), host.trim() && add())}>
            <label>
              {k("own")}
              <span className="row nowrap">
                <input className="grow" value={host} onChange={(e) => setHost(e.target.value)} placeholder="www.yourrestaurant.com" autoCapitalize="off" spellCheck={false} inputMode="url" data-testid="sf-domain-input" />
                <button className="btn" disabled={pending || !host.trim()} data-testid="sf-domain-add">
                  <Check size={16} /> {k("add")}
                </button>
              </span>
              <span className="hint">{t("staff.storefront.domains.ownHint", { target: data.target })}</span>
            </label>
          </form>
        )
      ) : (
        <p className="hint" style={{ margin: 0 }}>{k("unavailable")}</p>
      )}
    </section>
  );
}
