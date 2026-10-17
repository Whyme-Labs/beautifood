// Team & roles (RBAC): invite staff with a role and branch scope; API tokens for your own AI agent.
import { useState } from "react";
import { api } from "../../src/ui/api";
import { usePoll } from "../../src/ui/hooks";
import { useStaff } from "../../src/ui/staff";
import { useAction } from "../../src/ui/components";
import { GRANTABLE } from "../../src/shared/rbac";
import type { Role } from "../../src/shared/types";

interface Team {
  staff: { userId: string; email: string; name: string; role: Role; branchIds: string[] }[];
  invites: { code: string; email: string; name: string; role: Role; branchIds: string[] }[];
}

export default function Staff() {
  const s = useStaff();
  const { run, pending } = useAction();
  const { data, refresh } = usePoll(() => api<Team>("/api/m/staff"), { interval: 0 });
  const { data: tokens, refresh: refreshTokens } = usePoll(() => api<{ id: string; name: string; created_at: number; last_used_at: number | null }[]>("/api/m/tokens"), { interval: 0 });
  const roles = s.membership ? GRANTABLE[s.membership.role] : [];
  const [inv, setInv] = useState<{ email: string; name: string; role: Role; branchIds: string[] }>({ email: "", name: "", role: roles[roles.length - 1] ?? "waiter", branchIds: [] });
  const [newToken, setNewToken] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const bname = (ids: string[]) => (ids.includes("*") ? "All branches" : ids.map((id) => s.tenant?.branches.find((b) => b.id === id)?.name ?? id).join(", "));
  return (
    <div className="col">
      <h1>Team</h1>
      <div className="split">
        <section className="card">
          <h2>People</h2>
          <table>
            <tbody>
              {data?.staff.map((p) => (
                <tr key={p.userId} data-testid="staff-row">
                  <td>
                    {p.name}
                    <div className="muted" style={{ fontSize: 12 }}>{p.email}</div>
                  </td>
                  <td>{p.role.replace("_", " ")}</td>
                  <td className="muted">{bname(p.branchIds)}</td>
                  <td>
                    {p.userId !== s.user?.id && roles.includes(p.role) && (
                      <button className="btn small danger" onClick={() => confirm(`Remove ${p.name}?`) && run(async () => (await api(`/api/m/staff/${p.userId}`, { method: "DELETE" }), await refresh()), "Removed")}>
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {data?.invites.map((i) => (
                <tr key={i.code} className="muted">
                  <td>
                    {i.name} <span className="badge">invited</span>
                    <div style={{ fontSize: 12 }}>{i.email}</div>
                  </td>
                  <td>{i.role.replace("_", " ")}</td>
                  <td>{bname(i.branchIds)}</td>
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="col">
          <form
            className="card col"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                const r = await api<{ url: string }>("/api/m/staff", { body: { ...inv, branchIds: inv.branchIds.length ? inv.branchIds : ["*"] } });
                setLink(location.origin + r.url);
                await refresh();
              }, "Invitation created");
            }}
          >
            <h2>Invite someone</h2>
            <label>
              Name
              <input value={inv.name} onChange={(e) => setInv({ ...inv, name: e.target.value })} required />
            </label>
            <label>
              Email
              <input type="email" value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} required />
            </label>
            <label>
              Role
              <select value={inv.role} onChange={(e) => setInv({ ...inv, role: e.target.value as Role })} aria-label="Role">
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <div className="row">
              {s.tenant?.branches.map((b) => (
                <label key={b.id} className="inline">
                  <input type="checkbox" checked={inv.branchIds.includes(b.id)} onChange={(e) => setInv({ ...inv, branchIds: e.target.checked ? [...inv.branchIds, b.id] : inv.branchIds.filter((x) => x !== b.id) })} />
                  {b.name}
                </label>
              ))}
            </div>
            <button className="btn primary" disabled={pending}>
              Create invite link
            </button>
            {link && (
              <div className="card flat tight" data-testid="invite-link">
                Send this link: <code style={{ wordBreak: "break-all" }}>{link}</code>
              </div>
            )}
          </form>
          <div className="card col">
            <h2>AI agent access</h2>
            <p className="muted">Let your own AI assistant (via MCP at <code>/mcp</code>) check queues, sales and stock. Tokens act as you.</p>
            {tokens?.map((t) => (
              <div key={t.id} className="row between">
                <span>
                  {t.name} <span className="muted">· last used {t.last_used_at ? new Date(t.last_used_at).toLocaleString() : "never"}</span>
                </span>
                <button className="btn small danger" onClick={() => run(async () => (await api(`/api/m/tokens?id=${t.id}`, { method: "DELETE" }), await refreshTokens()))}>
                  Revoke
                </button>
              </div>
            ))}
            <button className="btn" onClick={() => run(async () => { const r = await api<{ token: string }>("/api/m/tokens", { body: { name: `Agent ${new Date().toLocaleDateString()}` } }); setNewToken(r.token); await refreshTokens(); })}>
              Create token
            </button>
            {newToken && (
              <div className="card flat tight">
                Copy now (shown once): <code style={{ wordBreak: "break-all" }} data-testid="new-token">{newToken}</code>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
