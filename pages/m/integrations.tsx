// Integrations: webhooks (which events go where, the signing secret, the delivery log), API keys,
// and the brief a restaurant hands its own coding agent to build connectors.
import { useEffect, useState } from "react";
import { Bot, Check, Copy, Download, KeyRound, Plus, RotateCcw, Send, Webhook } from "lucide-react";
import { api } from "../../src/ui/api";
import { usePoll } from "../../src/ui/hooks";
import { useStaff } from "../../src/ui/staff";
import { Empty, ErrorBox, Modal, useAction, useToast } from "../../src/ui/components";
import { useI18n } from "../../src/i18n/react";
import type { MessageKey } from "../../src/i18n/core";
import { WEBHOOK_EVENTS, WEBHOOK_GROUPS } from "../../src/shared/webhooks";

interface Endpoint {
  id: string;
  url: string;
  description: string;
  events: string[];
  branches: string[];
  active: boolean;
  createdAt: number;
  stats: { delivered: number; failed: number; pending: number; last_at: number | null } | null;
}
interface Delivery {
  id: string;
  type: string;
  status: "delivered" | "pending" | "failed";
  attempts: number;
  nextAt: number | null;
  responseStatus: number | null;
  responseBody: string | null;
  error: string | null;
  durationMs: number | null;
  createdAt: number;
  payload: unknown;
}
type Draft = { id?: string; url: string; description: string; events: string[]; branches: string[]; active: boolean };

const eventKey = (type: string) => `staff.integrations.hooks.eventNames.${type.replace(".", "_")}` as MessageKey;

async function copyText(s: string) {
  await navigator.clipboard.writeText(s);
}

export default function Integrations() {
  const s = useStaff();
  const { t } = useI18n();
  const { data: hooks, error, refresh } = usePoll(() => api<Endpoint[]>("/api/m/webhooks"), { interval: 15_000, deps: [s.tenant?.id] });
  const [edit, setEdit] = useState<Draft | null>(null);
  const [created, setCreated] = useState<{ id: string; secret: string } | null>(null);
  return (
    <div className="col">
      <div className="page-head">
        <div>
          <h1>{t("staff.integrations.title")}</h1>
          <p className="muted" style={{ margin: "4px 0 0", maxWidth: 760 }}>{t("staff.integrations.lead")}</p>
        </div>
      </div>
      <ErrorBox error={error} />
      <AgentBrief />

      <section className="card col" aria-labelledby="hooks-h" data-testid="webhooks">
        <div className="section-title">
          <h2 id="hooks-h" className="row nowrap" style={{ margin: 0 }}>
            <Webhook size={18} strokeWidth={1.75} aria-hidden="true" /> {t("staff.integrations.hooks.title")}
          </h2>
          <button className="btn small" onClick={() => setEdit({ url: "", description: "", events: ["order.paid"], branches: ["*"], active: true })} data-testid="add-webhook">
            <Plus size={16} /> {t("staff.integrations.hooks.add")}
          </button>
        </div>
        {hooks && !hooks.length && <Empty icon={<Webhook size={28} strokeWidth={1.5} />}>{t("staff.integrations.hooks.none")}</Empty>}
        <div className="list">
          {hooks?.map((h) => (
            <EndpointRow key={h.id} hook={h} justCreated={created?.id === h.id ? created.secret : null} onEdit={() => setEdit({ ...h })} onChanged={refresh} />
          ))}
        </div>
      </section>

      <ApiKeys />
      <StarterKits />

      <p className="muted" style={{ fontSize: 13 }}>
        {(() => {
          const [a, rest] = t("staff.integrations.docs").split("{openapi}");
          const [b, c] = rest.split("{llms}");
          return (
            <>
              {a}
              <a href="/openapi.json">openapi.json</a>
              {b}
              <a href="/llms.txt">llms.txt</a>
              {c}
            </>
          );
        })()}
      </p>

      {edit && (
        <EndpointModal
          draft={edit}
          onClose={() => setEdit(null)}
          onSaved={async (r) => {
            setEdit(null);
            if (r?.secret) setCreated({ id: r.id, secret: r.secret });
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function AgentBrief() {
  const { t } = useI18n();
  const toast = useToast();
  const { data } = usePoll(() => api<{ markdown: string }>("/api/m/integrations/brief?format=json"), { interval: 0 });
  const [open, setOpen] = useState(false);
  const md = data?.markdown ?? "";
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    a.download = "beautifood-integration-brief.md";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <section className="card col agent-brief" aria-labelledby="brief-h" data-testid="agent-brief">
      <h2 id="brief-h" className="row nowrap" style={{ margin: 0 }}>
        <Bot size={18} strokeWidth={1.75} aria-hidden="true" /> {t("staff.integrations.agent.title")}
      </h2>
      <p className="muted" style={{ margin: 0, maxWidth: 760 }}>{t("staff.integrations.agent.lead")}</p>
      <div className="row">
        <button className="btn primary" disabled={!md} onClick={() => copyText(md).then(() => toast(t("staff.integrations.agent.copied")))} data-testid="copy-brief">
          <Copy size={16} /> {t("staff.integrations.agent.copy")}
        </button>
        <button className="btn" disabled={!md} onClick={download}>
          <Download size={16} /> {t("staff.integrations.agent.download")}
        </button>
        <button className="btn ghost" disabled={!md} aria-expanded={open} onClick={() => setOpen(!open)}>
          {t("staff.integrations.agent.preview")}
        </button>
      </div>
      {open && <pre className="brief-preview" data-testid="brief-preview">{md}</pre>}
    </section>
  );
}

function EndpointRow({ hook, justCreated, onEdit, onChanged }: { hook: Endpoint; justCreated: string | null; onEdit: () => void; onChanged: () => Promise<void> }) {
  const { t, f } = useI18n();
  const toast = useToast();
  const { run, pending } = useAction();
  const [secret, setSecret] = useState<string | null>(justCreated);
  const [log, setLog] = useState(false);
  useEffect(() => setSecret(justCreated), [justCreated]);
  const names = hook.events.includes("*") ? [t("staff.integrations.hooks.allEvents")] : hook.events.map((e) => t(eventKey(e)));
  const test = () =>
    run(async () => {
      const r = await api<{ status: string; response_status: number | null; error: string | null }>(`/api/m/webhooks/${hook.id}/test`, { method: "POST" });
      toast(r.status === "delivered" ? t("staff.integrations.hooks.testOk", { status: r.response_status ?? "" }) : t("staff.integrations.hooks.testFailed", { error: r.error ?? "" }), r.status !== "delivered");
      await onChanged();
      setLog(true);
    });
  return (
    <div className="hook-row" data-testid="webhook">
      <div className="row between" style={{ alignItems: "flex-start" }}>
        <div className="meta" style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 6 }}>
            <b className="hook-url">{hook.url}</b>
            <span className={`badge ${hook.active ? "ok" : ""}`}>{hook.active ? t("staff.integrations.hooks.active") : t("staff.integrations.hooks.paused")}</span>
          </div>
          {hook.description && <div className="muted">{hook.description}</div>}
          <div className="muted" style={{ fontSize: 13 }}>{names.join(" · ")}</div>
          {hook.stats && <div className="muted" style={{ fontSize: 13 }}>{t("staff.integrations.hooks.stats", { delivered: hook.stats.delivered, failed: hook.stats.failed, pending: hook.stats.pending })}</div>}
        </div>
        <div className="row nowrap">
          <button className="btn small" disabled={pending} onClick={test} data-testid="test-webhook">
            <Send size={15} /> {t("staff.integrations.hooks.test")}
          </button>
          <button className="btn small" onClick={onEdit}>
            {t("common.edit")}
          </button>
        </div>
      </div>
      <div className="row secret-row">
        <span className="muted">{t("staff.integrations.hooks.secret")}</span>
        {secret ? (
          <>
            <code data-testid="webhook-secret">{secret}</code>
            <button className="btn small ghost icon" aria-label={t("staff.integrations.hooks.copySecret")} onClick={() => copyText(secret).then(() => toast(t("staff.integrations.hooks.secretCopied")))}>
              <Copy size={15} />
            </button>
            <button className="btn small ghost" onClick={() => setSecret(null)}>
              {t("staff.integrations.hooks.hide")}
            </button>
          </>
        ) : (
          <button className="btn small ghost" onClick={() => run(async () => setSecret((await api<{ secret: string }>(`/api/m/webhooks/${hook.id}/secret`)).secret))}>
            {t("staff.integrations.hooks.show")}
          </button>
        )}
        <button
          className="btn small ghost"
          onClick={() => confirm(t("staff.integrations.hooks.rotateConfirm")) && run(async () => setSecret((await api<{ secret: string }>(`/api/m/webhooks/${hook.id}/secret`, { method: "POST" })).secret), t("staff.integrations.hooks.rotated"))}
        >
          <RotateCcw size={14} /> {t("staff.integrations.hooks.rotate")}
        </button>
      </div>
      <span className="hint">{t("staff.integrations.hooks.secretHint")}</span>
      <details open={log} onToggle={(e) => setLog((e.target as HTMLDetailsElement).open)}>
        <summary className="muted" style={{ cursor: "pointer" }}>{t("staff.integrations.hooks.log")}</summary>
        {log && <DeliveryLog id={hook.id} onChanged={onChanged} />}
      </details>
    </div>
  );
}

function DeliveryLog({ id, onChanged }: { id: string; onChanged: () => Promise<void> }) {
  const { t, f } = useI18n();
  const { run } = useAction();
  const { data, refresh } = usePoll(() => api<Delivery[]>(`/api/m/webhooks/${id}/deliveries`), { interval: 10_000 });
  const [open, setOpen] = useState<string | null>(null);
  if (!data) return <div className="muted">{t("common.loading")}</div>;
  if (!data.length) return <div className="muted" style={{ padding: "8px 0" }}>{t("staff.integrations.hooks.noDeliveries")}</div>;
  return (
    <div className="list delivery-log" data-testid="delivery-log">
      {data.map((d) => (
        <div key={d.id} className="delivery" data-testid="delivery">
          <button type="button" className="delivery-head" aria-expanded={open === d.id} onClick={() => setOpen(open === d.id ? null : d.id)}>
            <span className={`badge ${d.status === "delivered" ? "ok" : d.status === "failed" ? "bad" : "warn"}`}>{t(`staff.integrations.hooks.status.${d.status}` as MessageKey)}</span>
            <span className="grow">
              <b>{t(eventKey(d.type))}</b> <code className="muted">{d.type}</code>
            </span>
            <span className="muted tabular">{d.responseStatus ? `HTTP ${d.responseStatus}` : d.error ?? ""}</span>
            <span className="muted">{f.dateTime(d.createdAt)}</span>
          </button>
          {open === d.id && (
            <div className="col tight delivery-body">
              <div className="muted" style={{ fontSize: 13 }}>
                {t("staff.integrations.hooks.attempts", { count: d.attempts })}
                {d.durationMs != null && ` · ${d.durationMs} ms`}
                {d.nextAt && ` · ${t("staff.integrations.hooks.nextTry", { when: f.time(d.nextAt) })}`}
                {d.error && ` · ${d.error}`}
              </div>
              <span className="muted">{t("staff.integrations.hooks.payload")}</span>
              <pre className="brief-preview small">{JSON.stringify(d.payload, null, 2)}</pre>
              {d.responseBody && (
                <>
                  <span className="muted">{t("staff.integrations.hooks.response")}</span>
                  <pre className="brief-preview small">{d.responseBody}</pre>
                </>
              )}
              <button className="btn small" style={{ alignSelf: "flex-start" }} onClick={() => run(async () => (await api(`/api/m/webhooks/deliveries/${d.id}/resend`, { method: "POST" }), await refresh(), await onChanged()), t("staff.integrations.hooks.resent"))}>
                <Send size={14} /> {t("staff.integrations.hooks.resend")}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function EndpointModal({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: (r: { id: string; secret?: string } | undefined) => Promise<void> }) {
  const s = useStaff();
  const { t } = useI18n();
  const { run, pending } = useAction();
  const [d, setD] = useState(draft);
  const all = d.events.includes("*");
  const toggle = (type: string) => setD({ ...d, events: d.events.includes(type) ? d.events.filter((x) => x !== type) : [...d.events.filter((x) => x !== "*"), type] });
  const branches = s.tenant?.branches ?? [];
  const save = () =>
    run(async () => {
      const body = { url: d.url, description: d.description, events: d.events, branches: d.branches, active: d.active };
      const r = d.id ? await api<{ id: string }>(`/api/m/webhooks/${d.id}`, { method: "PATCH", body }) : await api<{ id: string; secret: string }>("/api/m/webhooks", { body });
      await onSaved(r ?? undefined);
    }, t("staff.integrations.hooks.saved"));
  return (
    <Modal open onClose={onClose} title={d.id ? t("staff.integrations.hooks.editTitle") : t("staff.integrations.hooks.newTitle")}>
      <form className="col" onSubmit={(e) => (e.preventDefault(), save())}>
        <label>
          {t("staff.integrations.hooks.url")}
          <input type="url" required value={d.url} placeholder="https://" onChange={(e) => setD({ ...d, url: e.target.value })} data-testid="webhook-url" />
          <span className="hint">{t("staff.integrations.hooks.urlHint")}</span>
        </label>
        <label>
          {t("staff.integrations.hooks.description")}
          <input value={d.description} maxLength={120} placeholder={t("staff.integrations.hooks.descriptionPlaceholder")} onChange={(e) => setD({ ...d, description: e.target.value })} />
        </label>
        <fieldset className="menu-fieldset col">
          <legend>{t("staff.integrations.hooks.events")}</legend>
          <label className="inline">
            <input type="checkbox" checked={all} onChange={(e) => setD({ ...d, events: e.target.checked ? ["*"] : [] })} /> {t("staff.integrations.hooks.allEvents")}
          </label>
          {!all &&
            WEBHOOK_GROUPS.map((g) => (
              <div key={g} className="col tight">
                <b style={{ fontSize: 13 }}>{t(`staff.integrations.hooks.groups.${g}` as MessageKey)}</b>
                <div className="row">
                  {WEBHOOK_EVENTS.filter((e) => e.group === g).map((e) => (
                    <label key={e.type} className="inline" style={{ fontSize: 14 }}>
                      <input type="checkbox" checked={d.events.includes(e.type)} onChange={() => toggle(e.type)} /> {t(eventKey(e.type))}
                    </label>
                  ))}
                </div>
              </div>
            ))}
        </fieldset>
        {branches.length > 1 && (
          <fieldset className="menu-fieldset">
            <legend>{t("staff.integrations.hooks.branches")}</legend>
            <div className="row">
              <label className="inline">
                <input type="checkbox" checked={d.branches.includes("*")} onChange={(e) => setD({ ...d, branches: e.target.checked ? ["*"] : [] })} /> {t("staff.integrations.hooks.allBranches")}
              </label>
              {!d.branches.includes("*") &&
                branches.map((b) => (
                  <label key={b.id} className="inline">
                    <input type="checkbox" checked={d.branches.includes(b.id)} onChange={(e) => setD({ ...d, branches: e.target.checked ? [...d.branches, b.id] : d.branches.filter((x) => x !== b.id) })} /> {b.name}
                  </label>
                ))}
            </div>
          </fieldset>
        )}
        <label className="inline">
          <input type="checkbox" checked={d.active} onChange={(e) => setD({ ...d, active: e.target.checked })} /> {t("staff.integrations.hooks.active")}
        </label>
        <div className="row between">
          <button className="btn primary" disabled={pending || !d.url || !d.events.length} data-testid="save-webhook">
            <Check size={16} /> {t("staff.integrations.hooks.save")}
          </button>
          {d.id && (
            <button type="button" className="btn danger" disabled={pending} onClick={() => run(async () => (await api(`/api/m/webhooks/${d.id}`, { method: "DELETE" }), await onSaved(undefined)), t("staff.integrations.hooks.removed"))}>
              {t("staff.integrations.hooks.remove")}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

const KIT_REPO = "https://github.com/Whyme-Labs/beautifood/tree/main/templates";

function StarterKits() {
  const { t } = useI18n();
  const kits = [
    { id: "connectors-worker", name: t("staff.integrations.kits.connectors"), hint: t("staff.integrations.kits.connectorsHint") },
    { id: "storefront-worker", name: t("staff.integrations.kits.storefront"), hint: t("staff.integrations.kits.storefrontHint") },
  ];
  return (
    <section className="card col" aria-labelledby="kits-h" data-testid="starter-kits">
      <h2 id="kits-h" style={{ margin: 0 }}>{t("staff.integrations.kits.title")}</h2>
      <p className="muted" style={{ margin: 0 }}>{t("staff.integrations.kits.lead")}</p>
      <div className="list">
        {kits.map((k) => (
          <div key={k.id} className="row between">
            <span className="col tight" style={{ minWidth: 0 }}>
              <b>{k.name}</b>
              <span className="muted" style={{ fontSize: 13 }}>{k.hint}</span>
            </span>
            <span className="row nowrap">
              <a className="btn small" href={`${KIT_REPO}/${k.id}`} target="_blank" rel="noreferrer">
                {t("staff.integrations.kits.code")}
              </a>
              <a className="btn small primary" href={`https://deploy.workers.cloudflare.com/?url=${encodeURIComponent(`${KIT_REPO}/${k.id}`)}`} target="_blank" rel="noreferrer">
                {t("staff.integrations.kits.deploy")}
              </a>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ApiKeys() {
  const { t, f } = useI18n();
  const { run } = useAction();
  const { data: keys, refresh } = usePoll(() => api<{ id: string; name: string; created_at: number; last_used_at: number | null }[]>("/api/m/tokens"), { interval: 0 });
  const [fresh, setFresh] = useState<string | null>(null);
  const [before, after] = t("staff.integrations.keys.lead").split("{mcp}");
  return (
    <section className="card col" aria-labelledby="keys-h" data-testid="api-keys">
      <h2 id="keys-h" className="row nowrap" style={{ margin: 0 }}>
        <KeyRound size={18} strokeWidth={1.75} aria-hidden="true" /> {t("staff.integrations.keys.title")}
      </h2>
      <p className="muted" style={{ margin: 0 }}>
        {before}
        <code>/mcp</code>
        {after}
      </p>
      {keys && !keys.length ? (
        <div className="muted" style={{ fontSize: 13 }}>{t("staff.integrations.keys.none")}</div>
      ) : (
        <div className="list">
          {keys?.map((k) => (
            <div key={k.id} className="row between">
              <span className="row nowrap" style={{ minWidth: 0 }}>
                <KeyRound size={16} strokeWidth={1.75} aria-hidden="true" />
                <span>
                  {k.name} <span className="muted">· {k.last_used_at ? t("staff.integrations.keys.lastUsed", { when: f.dateTime(k.last_used_at) }) : t("staff.integrations.keys.never")}</span>
                </span>
              </span>
              <button className="btn small danger" aria-label={t("staff.integrations.keys.revokeName", { name: k.name })} onClick={() => run(async () => (await api(`/api/m/tokens?id=${k.id}`, { method: "DELETE" }), await refresh()), t("staff.integrations.keys.revoked"))}>
                {t("staff.integrations.keys.revoke")}
              </button>
            </div>
          ))}
        </div>
      )}
      <button className="btn" style={{ alignSelf: "flex-start" }} onClick={() => run(async () => { const r = await api<{ token: string }>("/api/m/tokens", { body: { name: t("staff.integrations.keys.defaultName", { date: f.date(Date.now()) }) } }); setFresh(r.token); await refresh(); })} data-testid="create-key">
        <KeyRound size={16} /> {t("staff.integrations.keys.create")}
      </button>
      {fresh && (
        <div className="alert sun">
          <KeyRound size={18} />
          <span style={{ minWidth: 0 }}>
            {t("staff.integrations.keys.copyNow")} <code style={{ wordBreak: "break-all" }} data-testid="new-key">{fresh}</code>
          </span>
        </div>
      )}
    </section>
  );
}
