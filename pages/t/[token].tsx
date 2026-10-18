// Static table QR landing: join the table's cart if seated, self-seat if allowed, else ask staff.
import { useEffect, useState } from "react";
import { useParams } from "@void/react";
import { HandPlatter, Minus, Plus, UtensilsCrossed } from "lucide-react";
import { api } from "../../src/ui/api";
import { ErrorBox, Stub, useAction } from "../../src/ui/components";
import { GuestBar } from "../../src/ui/guest";
import { useI18n } from "../../src/i18n/react";

interface QR {
  action: "join" | "self_seat" | "ask_staff";
  url?: string;
  message?: string;
  reason?: "dynamic" | "free" | "not_ready";
  branch: { name: string; restaurant: string };
  table: { label: string; seatsMax: number };
}

export default function StaticQr() {
  const { t } = useI18n();
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
      <GuestBar>{qr?.branch.restaurant}</GuestBar>
      <main className="narrow">
        <ErrorBox error={err} />
        {qr && (
          <Stub stock="A" tear={58}>
            <div className="stub-label">{qr.branch.name}</div>
            <h1 className="serial big" style={{ margin: "6px 0 26px" }}>
              {t("common.table", { label: qr.table.label })}
            </h1>
            {qr.action === "ask_staff" && (
              <p data-testid="qr-message" className="row" style={{ fontWeight: 650 }}>
                <HandPlatter size={18} /> {t(qr.reason === "dynamic" ? "qr.askDynamic" : qr.reason === "not_ready" ? "qr.askNotReady" : "qr.askStaff")}
              </p>
            )}
            {qr.action === "self_seat" && (
              <div className="col">
                <p style={{ fontWeight: 650 }}>{t("qr.free")}</p>
                <div className="stepper" style={{ alignSelf: "flex-start" }}>
                  <button type="button" className="btn" aria-label={t("branch.fewer")} onClick={() => setParty(Math.max(1, party - 1))}>
                    <Minus size={18} />
                  </button>
                  <input type="number" min={1} max={qr.table.seatsMax} value={party} onChange={(e) => setParty(Number(e.target.value))} aria-label={t("branch.partySize")} />
                  <button type="button" className="btn" aria-label={t("branch.more")} onClick={() => setParty(Math.min(qr.table.seatsMax, party + 1))}>
                    <Plus size={18} />
                  </button>
                </div>
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
                  <UtensilsCrossed size={18} /> {t("qr.sit")}
                </button>
              </div>
            )}
          </Stub>
        )}
      </main>
    </>
  );
}
