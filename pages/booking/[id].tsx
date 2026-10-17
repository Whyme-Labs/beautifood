import { useParams } from "@void/react";
import { api } from "../../src/ui/api";
import { usePoll, useQuery } from "../../src/ui/hooks";
import { ErrorBox, Logo, Status, useAction } from "../../src/ui/components";

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
  const { id } = useParams<{ id: string }>();
  const k = useQuery().get("k") ?? "";
  const { run, pending } = useAction();
  const { data: b, error, refresh } = usePoll(() => (k ? api<Booking>(`/api/public/bookings/${id}?k=${encodeURIComponent(k)}`) : Promise.resolve(null)), { interval: 0, deps: [k] });
  const when = b ? new Intl.DateTimeFormat("en-MY", { timeZone: b.branch.timezone, dateStyle: "full", timeStyle: "short" }).format(new Date(b.slotStart)) : "";
  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <Logo />
        </div>
      </header>
      <main className="narrow">
        <ErrorBox error={error} />
        {b && (
          <div className="card col">
            <h1>
              {b.branch.restaurant} {b.branch.name}
            </h1>
            <p data-testid="booking-summary">
              Table for <b>{b.partySize}</b> on <b>{when}</b> · <Status s={b.status} />
            </p>
            {b.status === "confirmed" && (
              <>
                <button
                  className="btn primary"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const r = await api<{ url: string }>(`/api/public/bookings/${id}/preorder?k=${encodeURIComponent(k)}`, { method: "POST" });
                      window.location.href = r.url;
                    })
                  }
                >
                  🍽 {b.preorderUrl ? "Edit your preorder" : "Preorder so food is ready when you arrive"}
                </button>
                <button className="btn danger" disabled={pending} onClick={() => confirm("Cancel this booking?") && run(async () => (await api(`/api/public/bookings/${id}?k=${encodeURIComponent(k)}`, { method: "DELETE" }), refresh()), "Booking cancelled")}>
                  Cancel booking
                </button>
              </>
            )}
          </div>
        )}
      </main>
    </>
  );
}
