// Staff console shell: restaurant + branch switcher and a nav filtered by the user's permissions.
import type { ReactNode } from "react";
import { useRouter } from "@void/react";
import { auth } from "void/client";
import { StaffProvider, useStaff } from "../../src/ui/staff";
import { Empty, Logo } from "../../src/ui/components";

const NAV: { href: string; label: string; perm?: string; any?: string[] }[] = [
  { href: "/m", label: "Dashboard" },
  { href: "/m/host", label: "Host stand", perm: "queue.operate" },
  { href: "/m/pos", label: "POS", perm: "order.create" },
  { href: "/m/kitchen", label: "Kitchen", perm: "kds.operate" },
  { href: "/m/bookings", label: "Bookings", perm: "booking.manage" },
  { href: "/m/menu", label: "Menu", any: ["menu.manage", "menu.availability"] },
  { href: "/m/tables", label: "Tables & QR", perm: "table.manage" },
  { href: "/m/members", label: "Loyalty & promos", any: ["member.manage", "campaign.manage"] },
  { href: "/m/reports", label: "Reports", perm: "report.view" },
  { href: "/m/staff", label: "Team", perm: "staff.manage" },
  { href: "/m/settings", label: "Settings", perm: "settings.manage" },
  { href: "/m/setup", label: "✨ AI setup", perm: "menu.manage" },
];

function Shell({ children }: { children: ReactNode }) {
  const s = useStaff();
  const router = useRouter();
  const path = router.path;
  if (s.loading) return <Empty>Loading…</Empty>;
  if (!s.user) return <Empty>Redirecting to sign in…</Empty>;
  if (!s.tenant && path !== "/m/setup") {
    if (typeof window !== "undefined") window.location.href = "/m/setup";
    return <Empty>Let's set up your restaurant…</Empty>;
  }
  const visible = NAV.filter((n) => (!n.perm || s.can(n.perm)) && (!n.any || n.any.some((p) => s.can(p))));
  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <Logo />
          {s.tenant && (
            <>
              {s.memberships.length > 1 ? (
                <select value={s.tenant.id} onChange={(e) => s.setTenantId(e.target.value)} style={{ width: "auto" }} aria-label="Restaurant">
                  {s.memberships.map((m) => (
                    <option key={m.tenantId} value={m.tenantId}>
                      {m.tenantName}
                    </option>
                  ))}
                </select>
              ) : (
                <b>{s.tenant.name}</b>
              )}
              <select value={s.branchId ?? ""} onChange={(e) => s.setBranch(e.target.value)} style={{ width: "auto" }} aria-label="Branch" data-testid="branch-select">
                {s.tenant.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </>
          )}
          <span style={{ flex: 1 }} />
          <span className="muted" style={{ fontSize: 13 }}>
            {s.user.name} · {s.membership?.role.replace("_", " ")}
          </span>
          <button className="btn small ghost" onClick={async () => (await auth.signOut(), (location.href = "/m/login"))}>
            Sign out
          </button>
        </div>
        <div className="wrap" style={{ paddingTop: 0 }}>
          <nav className="nav" data-testid="staff-nav">
            {visible.map((n) => (
              <a key={n.href} href={n.href} className={path === n.href ? "active" : ""}>
                {n.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main className="wrap">{children}</main>
    </>
  );
}

export default function StaffLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  if (router.path.startsWith("/m/login") || router.path.startsWith("/m/join")) return <>{children}</>;
  return (
    <StaffProvider>
      <Shell>{children}</Shell>
    </StaffProvider>
  );
}
