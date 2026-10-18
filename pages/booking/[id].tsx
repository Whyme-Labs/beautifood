import { useParams } from "@void/react";
import { UtensilsCrossed, X } from "lucide-react";
import { api } from "../../src/ui/api";
import { usePoll, useQuery } from "../../src/ui/hooks";
import { ErrorBox, Status, Stub, useAction } from "../../src/ui/components";
import { GuestBar } from "../../src/ui/guest";
import { useI18n } from "../../src/i18n/react";

interface Booking {
  id: string;
  name: string;
  partySize: number;
  slotStart: number;
  durationMinutes: number;
  status: string;
  branch: { name: string; restaurant: string; timezone: string };
  preorderUrl: string | null;
}

export default function BookingPage() {
  const { t, f } = useI18n();
  const { id } = useParams<{ id: string }>();
  const k = useQuery().get("k") ?? "";
  const { run, pending } = useAction();
  const { data: b, error, refresh } = usePoll(() => (k ? api<Booking>(`/api/public/bookings/${id}?k=${encodeURIComponent(k)}`) : Promise.resolve(null)), { interval: 0, deps: [k] });
  return (
    <>
      <GuestBar>{b?.branch.restaurant}</GuestBar>
      <main className="narrow">
        <ErrorBox error={error} />
        {b && (
          <div className="col" style={{ gap: 16 }}>
            <Stub stock={b.status === "confirmed" || b.status === "checked_in" ? "C" : "X"} tear={64}>
              <div className="row between nowrap">
                <span className="stub-label">
                  {b.branch.restaurant} · {b.branch.name}
                </span>
                <Status s={b.status} />
              </div>
              <div className="serial big" style={{ margin: "12px 0 4px" }}>
                {f.time(b.slotStart, b.branch.timezone)}
              </div>
              <div style={{ fontWeight: 700 }}>{f.weekday(b.slotStart, b.branch.timezone)}</div>
              <p style={{ marginTop: 34, fontWeight: 650 }} data-testid="booking-summary">
                {t("booking.summary", { count: b.partySize, when: f.fullDateTime(b.slotStart, b.branch.timezone) })} · {b.name}
              </p>
            </Stub>
            {b.status === "confirmed" && (
              <>
                <button
                  className="btn primary big"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const r = await api<{ url: string }>(`/api/public/bookings/${id}/preorder?k=${encodeURIComponent(k)}`, { method: "POST" });
                      window.location.href = r.url;
                    })
                  }
                >
                  <UtensilsCrossed size={19} /> {b.preorderUrl ? t("booking.editPreorder") : t("booking.preorder")}
                </button>
                <button className="btn ghost danger" disabled={pending} onClick={() => confirm(t("booking.cancelConfirm")) && run(async () => (await api(`/api/public/bookings/${id}?k=${encodeURIComponent(k)}`, { method: "DELETE" }), refresh()), t("booking.cancelled"))}>
                  <X size={17} /> {t("booking.cancel")}
                </button>
              </>
            )}
          </div>
        )}
      </main>
    </>
  );
}
