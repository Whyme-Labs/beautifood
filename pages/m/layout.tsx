// Staff console shell: restaurant + branch switcher and a nav filtered by the user's permissions.
import type { ReactNode } from "react";
import { useRouter } from "@void/react";
import { auth } from "void/client";
import { StaffProvider, useStaff } from "../../src/ui/staff";
import { BarChart3, BookOpen, CalendarDays, ChefHat, Gift, LayoutDashboard, LogOut, QrCode, Receipt, Settings, Sparkles, Webhook, UserCog, Users, type LucideIcon } from "lucide-react";
import { Empty, LangSwitch, Logo } from "../../src/ui/components";
import { useI18n } from "../../src/i18n/react";
import type { MessageKey } from "../../src/i18n/core";
import type { Messages } from "../../src/i18n/locales/en";

const NAV: { href: string; key: keyof Messages["staff"]["shell"]["nav"]; icon: LucideIcon; perm?: string; any?: string[] }[] = [
  { href: "/m", key: "dashboard", icon: LayoutDashboard },
  { href: "/m/host", key: "host", icon: Users, perm: "queue.operate" },
  { href: "/m/pos", key: "pos", icon: Receipt, perm: "order.create" },
  { href: "/m/kitchen", key: "kitchen", icon: ChefHat, perm: "kds.operate" },
  { href: "/m/bookings", key: "bookings", icon: CalendarDays, perm: "booking.manage" },
  { href: "/m/menu", key: "menu", icon: BookOpen, any: ["menu.manage", "menu.availability"] },
  { href: "/m/tables", key: "tables", icon: QrCode, perm: "table.manage" },
  { href: "/m/members", key: "members", icon: Gift, any: ["member.manage", "campaign.manage"] },
  { href: "/m/reports", key: "reports", icon: BarChart3, perm: "report.view" },
  { href: "/m/staff", key: "team", icon: UserCog, perm: "staff.manage" },
  { href: "/m/settings", key: "settings", icon: Settings, perm: "settings.manage" },
  { href: "/m/integrations", key: "integrations", icon: Webhook, perm: "integrations.manage" },
  { href: "/m/setup", key: "setup", icon: Sparkles, perm: "menu.manage" },
];

function Shell({ children }: { children: ReactNode }) {
  const s = useStaff();
  const { t } = useI18n();
  const router = useRouter();
  const path = router.path;
  if (s.loading) return <Empty>{t("common.loading")}</Empty>;
  if (!s.user) return <Empty>{t("staff.shell.redirecting")}</Empty>;
  if (!s.tenant && path !== "/m/setup") {
    if (typeof window !== "undefined") window.location.href = "/m/setup";
    return <Empty>{t("staff.shell.settingUp")}</Empty>;
  }
  const visible = NAV.filter((n) => (!n.perm || s.can(n.perm)) && (!n.any || n.any.some((p) => s.can(p))));
  const role = s.membership?.role;
  return (
    <>
      <header className="topbar staff">
        <div className="wrap">
          <Logo href="/m" />
          {s.tenant && (
            <div className="row nowrap switchers">
              {s.memberships.length > 1 ? (
                <select value={s.tenant.id} onChange={(e) => s.setTenantId(e.target.value)} aria-label={t("staff.shell.restaurant")}>
                  {s.memberships.map((m) => (
                    <option key={m.tenantId} value={m.tenantId}>
                      {m.tenantName}
                    </option>
                  ))}
                </select>
              ) : (
                <b className="tenant-name">{s.tenant.name}</b>
              )}
              <select value={s.branchId ?? ""} onChange={(e) => s.setBranch(e.target.value)} aria-label={t("staff.shell.branch")} data-testid="branch-select">
                {s.tenant.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <span className="grow" />
          <span className="who hide-sm">
            {s.user.name}
            {role && <span className="role">{role.startsWith("rl_") ? s.membership?.roleName : t(`staff.shell.roles.${role}` as MessageKey)}</span>}
          </span>
          <LangSwitch />
          <button className="btn small ghost icon" onClick={async () => (await auth.signOut(), (location.href = "/m/login"))} aria-label={t("common.signOut")} title={t("common.signOut")}>
            <LogOut size={17} />
          </button>
        </div>
        <div className="wrap navwrap">
          <nav className="nav" data-testid="staff-nav" aria-label={t("staff.shell.nav.label")}>
            {visible.map((n) => (
              <a key={n.href} href={n.href} className={path === n.href ? "active" : ""} aria-current={path === n.href ? "page" : undefined}>
                <n.icon aria-hidden="true" />
                {t(`staff.shell.nav.${n.key}`)}
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
