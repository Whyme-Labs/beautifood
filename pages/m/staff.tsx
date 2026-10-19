// Team & roles (RBAC): invite staff with a role and branch scope; API tokens for your own AI agent.
import { useState } from "react";
import { Bot, KeyRound, Link2, Trash2, UserPlus, Users } from "lucide-react";
import { api } from "../../src/ui/api";
import { usePoll } from "../../src/ui/hooks";
import { useStaff } from "../../src/ui/staff";
import { Empty, useAction } from "../../src/ui/components";
import { useI18n } from "../../src/i18n/react";
import type { MessageKey } from "../../src/i18n/core";
import { GRANTABLE, isBuiltInRole } from "../../src/shared/rbac";
import { RolesCard, type RolesData } from "../../src/ui/rolesCard";

interface Team {
  staff: { userId: string; email: string; name: string; role: string; branchIds: string[] }[];
  invites: { code: string; email: string; name: string; role: string; branchIds: string[] }[];
}

export default function Staff() {
  const s = useStaff();
  const { t, f } = useI18n();
  const { run, pending } = useAction();
  const { data, refresh } = usePoll(() => api<Team>("/api/m/staff"), { interval: 0 });
  const { data: tokens, refresh: refreshTokens } = usePoll(() => api<{ id: string; name: string; created_at: number; last_used_at: number | null }[]>("/api/m/tokens"), { interval: 0 });
  const { data: roleData, refresh: refreshRoles } = usePoll(() => api<RolesData>("/api/m/roles"), { interval: 0 });
  // the roles I may hand out: built-in and the restaurant's own (before they load, the built-in table)
  const roles: string[] = roleData ? [...roleData.builtIn.filter((r) => r.grantable).map((r) => r.id), ...roleData.custom.filter((r) => r.grantable).map((r) => r.id)] : s.membership && isBuiltInRole(s.membership.role) ? GRANTABLE[s.membership.role] : [];
  const [inv, setInv] = useState<{ email: string; name: string; role: string; branchIds: string[] }>({ email: "", name: "", role: "waiter", branchIds: [] });
  const [newToken, setNewToken] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const roleName = (r: string) => (isBuiltInRole(r) ? t(`staff.shell.roles.${r}` as MessageKey) : (roleData?.custom.find((c) => c.id === r)?.name ?? r));
  const bname = (ids: string[]) => (ids.includes("*") ? t("staff.team.allBranches") : ids.map((id) => s.tenant?.branches.find((b) => b.id === id)?.name ?? id).join(", "));
  const [mcpBefore, mcpAfter] = t("staff.team.tokens.about").split("{mcp}");
  return (
    <div className="col">
      <div className="page-head">
        <h1>{t("staff.team.title")}</h1>
      </div>
      <div className="split">
        <section className="card">
          <h2 className="row nowrap">
            <Users size={18} strokeWidth={1.75} aria-hidden="true" /> {t("staff.team.people")}
          </h2>
          <table>
            <thead>
              <tr>
                <th>{t("staff.team.person")}</th>
                <th>{t("staff.team.role")}</th>
                <th>{t("staff.team.branches")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data?.staff.map((p) => (
                <tr key={p.userId} data-testid="staff-row">
                  <td style={{ wordBreak: "break-word" }}>
                    {p.name} {p.userId === s.user?.id && <span className="muted">({t("staff.team.you")})</span>}
                    <div className="muted" style={{ fontSize: 12 }}>{p.email}</div>
                  </td>
                  <td>
                    <span className={`badge ${p.role === "owner" ? "brand" : ""}`}>{roleName(p.role)}</span>
                  </td>
                  <td className="muted">{bname(p.branchIds)}</td>
                  <td className="num">
                    {p.userId !== s.user?.id && roles.includes(p.role) && (
                      <button
                        className="btn small ghost icon danger"
                        aria-label={t("staff.team.removeName", { name: p.name })}
                        title={t("common.remove")}
                        onClick={() => confirm(t("staff.team.confirmRemove", { name: p.name })) && run(async () => (await api(`/api/m/staff/${p.userId}`, { method: "DELETE" }), await refresh()), t("staff.team.removed"))}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {data?.invites.map((i) => (
                <tr key={i.code} className="team-invite">
                  <td style={{ wordBreak: "break-word" }}>
                    {i.name} <span className="badge warn">{t("staff.team.invited")}</span>
                    <div className="muted" style={{ fontSize: 12 }}>{i.email}</div>
                  </td>
                  <td>
                    <span className="badge">{roleName(i.role)}</span>
                  </td>
                  <td className="muted">{bname(i.branchIds)}</td>
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.staff.length <= 1 && !data.invites.length && <Empty icon={<UserPlus size={28} strokeWidth={1.5} />}>{t("staff.team.noPeople")}</Empty>}
        </section>
        <section className="col">
            <form
              className="card col"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  const r = await api<{ url: string }>("/api/m/staff", { body: { ...inv, role: roles.includes(inv.role) ? inv.role : roles[roles.length - 1], branchIds: inv.branchIds.length ? inv.branchIds : ["*"] } });
                  setLink(location.origin + r.url);
                  await refresh();
                }, t("staff.team.invite.created"));
              }}
            >
              <h2 className="row nowrap" style={{ margin: 0 }}>
                <UserPlus size={18} strokeWidth={1.75} aria-hidden="true" /> {t("staff.team.invite.title")}
              </h2>
              <label>
                {t("common.name")}
                <input value={inv.name} onChange={(e) => setInv({ ...inv, name: e.target.value })} required />
              </label>
              <label>
                {t("common.email")}
                <input type="email" value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} required />
              </label>
              <label>
                {t("staff.team.role")}
                <select value={roles.includes(inv.role) ? inv.role : (roles[roles.length - 1] ?? "")} onChange={(e) => setInv({ ...inv, role: e.target.value })} aria-label={t("staff.team.role")} data-testid="invite-role">
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {roleName(r)}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="team-branches">
                <legend>{t("staff.team.branches")}</legend>
                <div className="row">
                  {s.tenant?.branches.map((b) => (
                    <label key={b.id} className="inline">
                      <input type="checkbox" checked={inv.branchIds.includes(b.id)} onChange={(e) => setInv({ ...inv, branchIds: e.target.checked ? [...inv.branchIds, b.id] : inv.branchIds.filter((x) => x !== b.id) })} />
                      {b.name}
                    </label>
                  ))}
                </div>
                <div className="hint">{t("staff.team.invite.branchesHint")}</div>
              </fieldset>
              <button className="btn primary" disabled={pending}>
                <Link2 size={16} /> {t("staff.team.invite.create")}
              </button>
              {link && (
                <div className="alert sun" data-testid="invite-link">
                  <Link2 size={18} />
                  <span style={{ minWidth: 0 }}>
                    {t("staff.team.invite.sendLink")} <code style={{ wordBreak: "break-all" }}>{link}</code>
                  </span>
                </div>
              )}
            </form>
          <div className="card col">
            <h2 className="row nowrap" style={{ margin: 0 }}>
              <Bot size={18} strokeWidth={1.75} aria-hidden="true" /> {t("staff.team.tokens.title")}
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              {mcpBefore}
              <code>/mcp</code>
              {mcpAfter}
            </p>
            {tokens && !tokens.length ? (
              <div className="muted" style={{ fontSize: 13 }}>{t("staff.team.tokens.none")}</div>
            ) : (
              <div className="list">
                {tokens?.map((tk) => (
                  <div key={tk.id} className="row between">
                    <span className="row nowrap" style={{ minWidth: 0 }}>
                      <KeyRound size={16} strokeWidth={1.75} aria-hidden="true" />
                      <span>
                        {tk.name} <span className="muted">· {tk.last_used_at ? t("staff.team.tokens.lastUsed", { when: f.dateTime(tk.last_used_at) }) : t("staff.team.tokens.never")}</span>
                      </span>
                    </span>
                    <button className="btn small danger" aria-label={t("staff.team.tokens.revokeName", { name: tk.name })} onClick={() => run(async () => (await api(`/api/m/tokens?id=${tk.id}`, { method: "DELETE" }), await refreshTokens()), t("staff.team.tokens.revoked"))}>
                      {t("staff.team.tokens.revoke")}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button className="btn" onClick={() => run(async () => { const r = await api<{ token: string }>("/api/m/tokens", { body: { name: t("staff.team.tokens.defaultName", { date: f.date(Date.now()) }) } }); setNewToken(r.token); await refreshTokens(); })}>
              <KeyRound size={16} /> {t("staff.team.tokens.create")}
            </button>
            {newToken && (
              <div className="alert sun">
                <KeyRound size={18} />
                <span style={{ minWidth: 0 }}>
                  {t("staff.team.tokens.copyNow")} <code style={{ wordBreak: "break-all" }} data-testid="new-token">{newToken}</code>
                </span>
              </div>
            )}
          </div>
        </section>
      </div>
      {roleData && <RolesCard data={roleData} onChange={async () => (await refreshRoles(), await refresh())} />}
    </div>
  );
}
