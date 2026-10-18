import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, UtensilsCrossed } from "lucide-react";
import { api } from "../../src/ui/api";
import { usePoll } from "../../src/ui/hooks";
import { useBranchApi, useStaff } from "../../src/ui/staff";
import { Empty, ErrorBox, Stat, Status, useAction } from "../../src/ui/components";
import { useI18n } from "../../src/i18n/react";

interface Booking {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  partySize: number;
  slotStart: number;
  status: string;
  tableIds: string[];
  notes: string;
  sessionId: string | null;
}

/** Shift a YYYY-MM-DD day by n days (calendar arithmetic, no time zone). */
const shiftDay = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export default function Bookings() {
  const { t, f } = useI18n();
  const s = useStaff();
  const b = useBranchApi();
  const tz = s.branch?.config.timezone ?? "Asia/Kuala_Lumpur";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  const [day, setDay] = useState(today);
  const { run, pending } = useAction();
  const { data, error, refresh } = usePoll(() => (s.branchId ? api<Booking[]>(b(`bookings?day=${day}`)) : Promise.resolve(null)), { interval: 30_000, deps: [s.branchId, day] });
  const { data: tables } = usePoll(() => (s.branchId ? api<{ id: string; label: string }[]>(b("tables")) : Promise.resolve(null)), { interval: 0, deps: [s.branchId] });
  const label = (ids: string[]) => ids.map((id) => tables?.find((x) => x.id === id)?.label ?? "?").join("+");
  const act = (id: string, action: string, ok: string) => run(async () => (await api(b(`bookings/${id}/${action}`), { body: {} }), await refresh()), ok);
  const live = (data ?? []).filter((x) => x.status !== "cancelled" && x.status !== "no_show");
  const noon = Date.parse(`${day}T12:00:00Z`);

  return (
    <div className="col">
      <div className="page-head">
        <div>
          <h1>{t("staff.bookings.title")}</h1>
          <div className="muted">{Number.isNaN(noon) ? "" : f.weekday(noon, "UTC")}</div>
        </div>
        <div className="row nowrap bk-day">
          <button className="btn icon" onClick={() => setDay(shiftDay(day, -1))} aria-label={t("staff.bookings.prevDay")}>
            <ChevronLeft size={18} />
          </button>
          <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label={t("staff.bookings.day")} />
          <button className="btn icon" onClick={() => setDay(shiftDay(day, 1))} aria-label={t("staff.bookings.nextDay")}>
            <ChevronRight size={18} />
          </button>
          {day !== today && (
            <button className="btn" onClick={() => setDay(today)}>
              {t("common.today")}
            </button>
          )}
        </div>
      </div>
      <ErrorBox error={error} />
      {data && data.length > 0 && (
        <div className="card flat stats" style={{ padding: 0 }}>
          <Stat label={t("staff.bookings.stats.bookings")} value={f.number(live.length)} />
          <Stat label={t("staff.bookings.stats.guests")} value={f.number(live.reduce((n, x) => n + x.partySize, 0))} />
          <Stat label={t("staff.bookings.stats.confirmed")} value={f.number(live.filter((x) => x.status === "confirmed").length)} />
          <Stat label={t("staff.bookings.stats.checkedIn")} value={f.number(live.filter((x) => x.status === "checked_in").length)} />
        </div>
      )}
      {data && !data.length ? (
        <div className="card">
          <Empty icon={<CalendarDays size={28} strokeWidth={1.5} />}>{t("staff.bookings.empty")}</Empty>
        </div>
      ) : (
        <div className="card bk-card">
          <table className="bk-table">
            <thead>
              <tr>
                <th>{t("staff.bookings.cols.time")}</th>
                <th>{t("staff.bookings.cols.guest")}</th>
                <th className="num">{t("staff.bookings.cols.pax")}</th>
                <th>{t("staff.bookings.cols.tables")}</th>
                <th>{t("staff.bookings.cols.status")}</th>
                <th>
                  <span className="sr-only">{t("staff.bookings.cols.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data?.map((bk) => (
                <tr key={bk.id} data-testid="booking-row" className={bk.status === "cancelled" || bk.status === "no_show" ? "off" : ""}>
                  <td className="bk-time serial">{f.time(bk.slotStart, tz)}</td>
                  <td className="bk-guest">
                    <b>{bk.name}</b>
                    {bk.sessionId && (
                      <span className="badge brand">
                        <UtensilsCrossed /> {t("staff.bookings.preordered")}
                      </span>
                    )}
                    {(bk.phone || bk.email || bk.notes) && <div className="muted">{[bk.phone, bk.email, bk.notes].filter(Boolean).join(" · ")}</div>}
                  </td>
                  <td className="num">
                    <span className="serial bk-pax">{bk.partySize}</span>
                  </td>
                  <td className="bk-tables">{bk.tableIds.length ? label(bk.tableIds) : "—"}</td>
                  <td>
                    <Status s={bk.status} />
                  </td>
                  <td>
                    {bk.status === "confirmed" && (
                      <div className="row nowrap bk-actions">
                        <button className="btn small primary" disabled={pending} onClick={() => act(bk.id, "check_in", t("staff.bookings.toasts.seated", { name: bk.name }))}>
                          {t("staff.bookings.checkIn")}
                        </button>
                        <button className="btn small" disabled={pending} onClick={() => act(bk.id, "no_show", t("staff.bookings.toasts.noShow"))}>
                          {t("staff.bookings.noShow")}
                        </button>
                        <button className="btn small danger" disabled={pending} onClick={() => act(bk.id, "cancel", t("staff.bookings.toasts.cancelled"))}>
                          {t("common.cancel")}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
