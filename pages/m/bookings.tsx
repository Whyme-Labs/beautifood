import { useState } from "react";
import { api } from "../../src/ui/api";
import { usePoll } from "../../src/ui/hooks";
import { useBranchApi, useStaff } from "../../src/ui/staff";
import { Empty, Status, useAction } from "../../src/ui/components";

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

export default function Bookings() {
  const s = useStaff();
  const b = useBranchApi();
  const tz = s.branch?.config.timezone ?? "Asia/Kuala_Lumpur";
  const [day, setDay] = useState(new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date()));
  const { run } = useAction();
  const { data, refresh } = usePoll(() => (s.branchId ? api<Booking[]>(b(`bookings?day=${day}`)) : Promise.resolve(null)), { interval: 30_000, deps: [s.branchId, day] });
  const { data: tables } = usePoll(() => (s.branchId ? api<{ id: string; label: string }[]>(b("tables")) : Promise.resolve(null)), { interval: 0, deps: [s.branchId] });
  const label = (ids: string[]) => ids.map((id) => tables?.find((t) => t.id === id)?.label ?? "?").join("+");
  const act = (id: string, action: string, ok: string) => run(async () => (await api(b(`bookings/${id}/${action}`), { body: {} }), await refresh()), ok);
  return (
    <div className="col">
      <div className="row between">
        <h1 style={{ margin: 0 }}>Bookings</h1>
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} style={{ width: "auto" }} aria-label="Day" />
      </div>
      {!data?.length && <Empty>No bookings on this day.</Empty>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Guest</th>
              <th>Pax</th>
              <th>Tables</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.map((bk) => (
              <tr key={bk.id} data-testid="booking-row">
                <td>{new Intl.DateTimeFormat("en-MY", { timeZone: tz, timeStyle: "short" }).format(new Date(bk.slotStart))}</td>
                <td>
                  {bk.name}
                  <div className="muted" style={{ fontSize: 12 }}>
                    {[bk.phone, bk.email, bk.notes].filter(Boolean).join(" · ")}
                    {bk.sessionId ? " · preordered" : ""}
                  </div>
                </td>
                <td>{bk.partySize}</td>
                <td>{label(bk.tableIds)}</td>
                <td>
                  <Status s={bk.status} />
                </td>
                <td>
                  {bk.status === "confirmed" && (
                    <div className="row" style={{ gap: 6 }}>
                      <button className="btn small primary" onClick={() => act(bk.id, "check_in", `${bk.name} seated`)}>
                        Check in
                      </button>
                      <button className="btn small" onClick={() => act(bk.id, "no_show", "Marked no-show")}>
                        No-show
                      </button>
                      <button className="btn small danger" onClick={() => act(bk.id, "cancel", "Cancelled")}>
                        Cancel
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
