// Staff console context: signed-in user, restaurant (tenant), branch selection, permissions.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, setTenant } from "./api";
import type { BranchConfig, Role } from "../shared/types";

export interface Membership {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  /** A built-in role, or a custom role id (rl_…) whose name is roleName. */
  role: Role | string;
  roleName?: string;
  tenantWide?: boolean;
  branchIds: string[];
  permissions: string[];
}

export interface TenantInfo {
  id: string;
  slug: string;
  name: string;
  description: string;
  cuisine: string;
  story: string;
  currency: string;
  timezone: string;
  /** The language the menu is written in. */
  menuLanguage?: string;
  loyalty: { enabled: boolean; earnPerUnit: number; redeemValue: number; minRedeem: number; tiers: { name: string; minLifetime: number; multiplier: number }[] };
  onboarding: Record<string, boolean>;
  branches: { id: string; slug: string; name: string; address: string; active: boolean; config: BranchConfig }[];
  me: { role: Role; branches: string[]; name: string; email: string };
}

interface StaffState {
  user: { id: string; email: string; name: string } | null;
  memberships: Membership[];
  membership: Membership | null;
  tenant: TenantInfo | null;
  branchId: string | null;
  branch: TenantInfo["branches"][number] | null;
  branchRef: string;
  can: (perm: string) => boolean;
  setBranch: (id: string) => void;
  setTenantId: (id: string) => void;
  reload: () => Promise<void>;
  loading: boolean;
}

const Ctx = createContext<StaffState | null>(null);

export function StaffProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StaffState["user"]>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [tenantId, setTenantIdState] = useState<string | null>(null);
  const [tenant, setTenantInfo] = useState<TenantInfo | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const me = await api<{ user: StaffState["user"]; memberships: Membership[] }>("/api/m/me");
      setUser(me.user);
      setMemberships(me.memberships);
      const saved = localStorage.getItem("bf.tenant");
      const m = me.memberships.find((x) => x.tenantId === (tenantId ?? saved)) ?? me.memberships[0] ?? null;
      if (!m) {
        setTenantInfo(null);
        return;
      }
      setTenant(m.tenantId);
      setTenantIdState(m.tenantId);
      const t = await api<TenantInfo>("/api/m/tenant");
      setTenantInfo(t);
      const savedBranch = localStorage.getItem(`bf.branch.${m.tenantId}`);
      const urlBranch = new URLSearchParams(location.search).get("b");
      const pick = [urlBranch, savedBranch].find((b) => b && t.branches.some((x) => x.id === b)) ?? t.branches[0]?.id ?? null;
      setBranchId(pick);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        if (!location.pathname.startsWith("/m/login") && !location.pathname.startsWith("/m/join")) location.href = `/m/login?next=${encodeURIComponent(location.pathname + location.search)}`;
      } else throw e;
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    reload().catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const membership = memberships.find((m) => m.tenantId === tenantId) ?? null;
  const branch = tenant?.branches.find((b) => b.id === branchId) ?? null;
  const value = useMemo<StaffState>(
    () => ({
      user,
      memberships,
      membership,
      tenant,
      branchId,
      branch,
      branchRef: branch ? `${tenant!.slug}~${branch.slug}` : "",
      can: (p) => !!membership?.permissions.includes(p),
      setBranch: (id) => {
        setBranchId(id);
        try {
          localStorage.setItem(`bf.branch.${tenantId}`, id);
        } catch {
          /* ignore */
        }
      },
      setTenantId: (id) => {
        localStorage.setItem("bf.tenant", id);
        location.reload();
      },
      reload,
      loading,
    }),
    [user, memberships, membership, tenant, branchId, branch, tenantId, reload, loading],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStaff(): StaffState {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStaff outside StaffProvider");
  return s;
}

/** Branch-scoped API path helper: bapi("board") → /api/m/branches/<id>/board */
export function useBranchApi() {
  const { branchId } = useStaff();
  return useCallback((path: string) => `/api/m/branches/${branchId}/${path}`, [branchId]);
}

/**
 * Staff screens stay live by polling the branch change feed (one cheap query)
 * and reloading their data only when something relevant changed.
 */
export function useBranchChanges(onChange: (types: string[]) => void, scopes?: string[]) {
  const { branchId } = useStaff();
  const cb = useCallback(onChange, [onChange]);
  useEffect(() => {
    if (!branchId) return;
    let cursor = -1;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        if (!document.hidden) {
          const r = await api<{ cursor: number; types: string[]; scopes: string[] }>(`/api/m/branches/${branchId}/changes?since=${Math.max(cursor, 0)}`);
          if (cursor >= 0 && r.cursor !== cursor && (!scopes || r.scopes.some((s) => scopes.includes(s)))) cb(r.types);
          cursor = r.cursor;
        }
      } catch {
        /* transient */
      }
      if (!stop) timer = setTimeout(tick, 1500);
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, cb]);
}
