// Printable static table QR codes (one per table, never changes). Dynamic per-seating QRs are on the host stand.
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { api } from "../../src/ui/api";
import { usePoll } from "../../src/ui/hooks";
import { useBranchApi, useStaff } from "../../src/ui/staff";

export default function QrSheet() {
  const s = useStaff();
  const b = useBranchApi();
  const { data } = usePoll(() => (s.branchId ? api<{ id: string; label: string; staticToken: string; parentId: string | null }[]>(b("tables")) : Promise.resolve(null)), { interval: 0, deps: [s.branchId] });
  const [imgs, setImgs] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!data) return;
    Promise.all(data.filter((t) => !t.parentId).map(async (t) => [t.id, await QRCode.toDataURL(`${location.origin}/t/${t.staticToken}`, { margin: 1, width: 220 })] as const)).then((x) => setImgs(Object.fromEntries(x)));
  }, [data]);
  const mode = s.branch?.config.qrMode;
  return (
    <div className="col">
      <div className="row between no-print">
        <h1 style={{ margin: 0 }}>Table QR codes · {s.branch?.name}</h1>
        <button className="btn primary" onClick={() => (window.print(), api("/api/m/tenant", { method: "PATCH", body: { onboarding: { qrPrinted: true } } }).catch(() => {}))}>
          Print
        </button>
      </div>
      {mode === "dynamic" && <p className="muted no-print">This branch is in dynamic-QR mode: printed codes direct guests to staff, who show a per-seating code from the host stand.</p>}
      <div className="qr-sheet">
        {data
          ?.filter((t) => !t.parentId)
          .map((t) => (
            <div key={t.id} className="qr-card" data-testid="qr-card">
              {imgs[t.id] && <img src={imgs[t.id]} alt={`QR for table ${t.label}`} width={180} height={180} />}
              <div style={{ fontWeight: 800, fontSize: 22 }}>Table {t.label}</div>
              <div style={{ fontSize: 12 }}>Scan to see the menu & order</div>
              <a className="no-print" href={`/t/${t.staticToken}`} style={{ fontSize: 11 }}>
                /t/{t.staticToken}
              </a>
            </div>
          ))}
      </div>
    </div>
  );
}
