// Static table QR landing: join the table's cart if seated, self-seat if allowed, else ask staff.
import { useEffect, useState } from "react";
import { useParams } from "@void/react";
import { api } from "../../src/ui/api";
import { ErrorBox, Logo, useAction } from "../../src/ui/components";

interface QR {
  action: "join" | "self_seat" | "ask_staff";
  url?: string;
  message?: string;
  branch: { name: string; restaurant: string };
  table: { label: string; seatsMax: number };
}

export default function StaticQr() {
  const { token } = useParams<{ token: string }>();
  const [qr, setQr] = useState<QR | null>(null);
  const [err, setErr] = useState<Error | null>(null);
  const [party, setParty] = useState(2);
  const { run, pending } = useAction();
  useEffect(() => {
    api<QR>(`/api/public/qr/${token}`)
      .then((r) => (r.action === "join" && r.url ? window.location.replace(r.url) : setQr(r)))
      .catch(setErr);
  }, [token]);
  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <Logo />
        </div>
      </header>
      <main className="narrow">
        <ErrorBox error={err} />
        {qr && (
          <div className="card" style={{ textAlign: "center" }}>
            <h1>
              {qr.branch.restaurant} · Table {qr.table.label}
            </h1>
            {qr.action === "ask_staff" && <p data-testid="qr-message">{qr.message}</p>}
            {qr.action === "self_seat" && (
              <div className="col">
                <p>This table is free. How many of you are there?</p>
                <input type="number" min={1} max={qr.table.seatsMax} value={party} onChange={(e) => setParty(Number(e.target.value))} aria-label="Party size" />
                <button
                  className="btn primary big"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const r = await api<{ url: string }>(`/api/public/qr/${token}/seat`, { body: { partySize: party } });
                      window.location.href = r.url;
                    })
                  }
                >
                  Sit here & start ordering
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
