// Team → roles: the built-in roles (what each can do) and the restaurant's own. A new role starts
// from a description ("a supervisor who can refund and void, but not see reports"): the AI proposes
// the permissions, shows how it differs from the nearest built-in role, and a person confirms.
// Nobody can tick a permission they don't hold.
import { useEffect, useState } from "react";
import { Check, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { api } from "./api";
import { Modal, useAction } from "./components";
import { useI18n } from "../i18n/react";
import type { MessageKey } from "../i18n/core";
import { PERMISSION_GROUPS, type Permission } from "../shared/rbac";

export interface RolesData {
  builtIn: { id: string; permissions: Permission[]; tenantWide: boolean; grantable: boolean }[];
  custom: { id: string; name: string; description: string; permissions: Permission[]; tenantWide: boolean; members: number; grantable: boolean }[];
  mine: { permissions: Permission[]; tenantWide: boolean };
}
interface Suggestion {
  name: string;
  permissions: Permission[];
  tenantWide: boolean;
  explanation: string;
  closest: { role: string; adds: Permission[]; removes: Permission[] };
  withheld: Permission[];
  engine: "claude" | "rules";
}
type Draft = { id?: string; name: string; description: string; permissions: Permission[]; tenantWide: boolean };

export const permKey = (p: string) => `staff.team.perms.${p.replace(".", "_")}` as MessageKey;

export function RolesCard({ data, onChange }: { data: RolesData; onChange: () => Promise<void> }) {
  const { t } = useI18n();
  const [edit, setEdit] = useState<Draft | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const label = (id: string) => t(`staff.shell.roles.${id}` as MessageKey);
  const chips = (ps: Permission[]) => (
    <div className="tag-row">
      {ps.map((p) => (
        <span key={p} className="badge">
          {t(permKey(p))}
        </span>
      ))}
    </div>
  );
  return (
    <section className="card col" aria-labelledby="roles-h" data-testid="roles">
      <div className="section-title">
        <h2 id="roles-h" className="row nowrap" style={{ margin: 0 }}>
          <ShieldCheck size={18} strokeWidth={1.75} aria-hidden="true" /> {t("staff.team.roles.title")}
        </h2>
        <button className="btn small" onClick={() => setEdit({ name: "", description: "", permissions: [], tenantWide: false })} data-testid="new-role">
          <Plus size={16} /> {t("staff.team.roles.new")}
        </button>
      </div>
      <p className="muted" style={{ margin: 0 }}>{t("staff.team.roles.lead")}</p>
      {data.custom.length > 0 && (
        <div className="list">
          {data.custom.map((r) => (
            <div key={r.id} className="timed-row" data-testid="custom-role">
              <div className="meta">
                <div className="row" style={{ gap: 6 }}>
                  <b>{r.name}</b>
                  {r.tenantWide && <span className="badge info">{t("staff.team.roles.allBranches")}</span>}
                  <span className="muted" style={{ fontSize: 13 }}>{t("staff.team.roles.members", { count: r.members })}</span>
                </div>
                {r.description && <div className="muted" style={{ fontSize: 13 }}>{r.description}</div>}
                {chips(r.permissions)}
              </div>
              {r.grantable && (
                <button className="btn small" onClick={() => setEdit({ id: r.id, name: r.name, description: r.description, permissions: r.permissions, tenantWide: r.tenantWide })}>
                  {t("common.edit")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <details>
        <summary className="muted" style={{ cursor: "pointer" }}>{t("staff.team.roles.builtIn")}</summary>
        <div className="list" style={{ marginTop: 8 }}>
          {data.builtIn.map((r) => (
            <div key={r.id} className="col tight">
              <button type="button" className="delivery-head" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}>
                <b>{label(r.id)}</b>
                <span className="muted">{t("staff.team.roles.permCount", { count: r.permissions.length })}</span>
                {r.tenantWide && <span className="badge info">{t("staff.team.roles.allBranches")}</span>}
              </button>
              {open === r.id && chips(r.permissions)}
            </div>
          ))}
        </div>
      </details>
      {edit && <RoleModal draft={edit} data={data} onClose={() => setEdit(null)} onDone={async () => (setEdit(null), await onChange())} />}
    </section>
  );
}

function RoleModal({ draft, data, onClose, onDone }: { draft: Draft; data: RolesData; onClose: () => void; onDone: () => Promise<void> }) {
  const { t, locale } = useI18n();
  const { run, pending } = useAction();
  const [d, setD] = useState(draft);
  const [hint, setHint] = useState<Suggestion | null>(null);
  useEffect(() => setD(draft), [draft]);
  const mine = new Set(data.mine.permissions);
  const toggle = (p: Permission) => setD({ ...d, permissions: d.permissions.includes(p) ? d.permissions.filter((x) => x !== p) : [...d.permissions, p] });
  const suggest = () =>
    run(async () => {
      const s = await api<Suggestion>("/api/m/roles/suggest", { body: { description: d.description, locale: locale === "zh" ? "zh" : "en" } });
      setHint(s);
      setD({ ...d, name: d.name || s.name, permissions: s.permissions, tenantWide: s.tenantWide });
    });
  const save = () =>
    run(async () => {
      await api("/api/m/roles", { body: { id: d.id, name: d.name, description: d.description, permissions: d.permissions, tenantWide: d.tenantWide } });
      await onDone();
    }, t("staff.team.roles.saved"));
  const closest = hint?.closest;
  return (
    <Modal open onClose={onClose} title={d.id ? t("staff.team.roles.editTitle", { name: draft.name }) : t("staff.team.roles.newTitle")}>
      <form className="col" onSubmit={(e) => (e.preventDefault(), save())}>
        <label>
          {t("staff.team.roles.describe")}
          <textarea value={d.description} maxLength={300} rows={3} placeholder={t("staff.team.roles.describePlaceholder")} onChange={(e) => setD({ ...d, description: e.target.value })} data-testid="role-description" />
        </label>
        <button type="button" className="btn" style={{ alignSelf: "flex-start" }} disabled={pending || d.description.trim().length < 3} onClick={suggest} data-testid="suggest-role">
          <Sparkles size={16} /> {t("staff.team.roles.suggest")}
        </button>
        {hint && (
          <div className="alert sun col tight" data-testid="role-suggestion">
            {hint.explanation && <span>{hint.explanation}</span>}
            {closest && (
              <span>
                {t("staff.team.roles.closest", { role: t(`staff.shell.roles.${closest.role}` as MessageKey) })}
                {closest.adds.length > 0 && ` ${t("staff.team.roles.plus", { list: closest.adds.map((p) => t(permKey(p))).join(", ") })}`}
                {closest.removes.length > 0 && ` ${t("staff.team.roles.minus", { list: closest.removes.map((p) => t(permKey(p))).join(", ") })}`}
              </span>
            )}
            {hint.withheld.length > 0 && <span className="muted">{t("staff.team.roles.withheld", { list: hint.withheld.map((p) => t(permKey(p))).join(", ") })}</span>}
            <span className="muted" style={{ fontSize: 12.5 }}>{t("staff.team.roles.checkIt")}</span>
          </div>
        )}
        <label>
          {t("staff.team.roles.name")}
          <input value={d.name} required minLength={2} maxLength={40} placeholder={t("staff.team.roles.namePlaceholder")} onChange={(e) => setD({ ...d, name: e.target.value })} data-testid="role-name" />
        </label>
        {PERMISSION_GROUPS.map((g) => {
          const ps = g.perms.filter((p) => p !== "tenant.manage");
          if (!ps.length) return null;
          return (
            <fieldset key={g.group} className="menu-fieldset">
              <legend>{t(`staff.team.permGroups.${g.group}` as MessageKey)}</legend>
              <div className="row">
                {ps.map((p) => (
                  <label key={p} className={`inline ${mine.has(p) ? "" : "muted"}`} title={mine.has(p) ? undefined : t("staff.team.roles.notYours")} style={{ fontSize: 14 }}>
                    <input type="checkbox" checked={d.permissions.includes(p)} disabled={!mine.has(p)} onChange={() => toggle(p)} data-testid={`perm-${p}`} /> {t(permKey(p))}
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
        <label className="inline">
          <input type="checkbox" checked={d.tenantWide} disabled={!data.mine.tenantWide} onChange={(e) => setD({ ...d, tenantWide: e.target.checked })} /> {t("staff.team.roles.tenantWide")}
        </label>
        <div className="row between">
          <button className="btn primary" disabled={pending || !d.permissions.length || d.name.trim().length < 2} data-testid="save-role">
            <Check size={16} /> {t("common.save")}
          </button>
          {d.id && (
            <button type="button" className="btn danger" disabled={pending} onClick={() => run(async () => (await api(`/api/m/roles/${d.id}`, { method: "DELETE" }), await onDone()), t("staff.team.roles.removed"))}>
              {t("staff.team.roles.remove")}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
