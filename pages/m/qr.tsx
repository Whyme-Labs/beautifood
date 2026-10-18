// Printable static table QR codes (one per table, never changes). Dynamic per-seating QRs are on the host stand.
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Info, Printer } from "lucide-react";
import { api } from "../../src/ui/api";
import { usePoll } from "../../src/ui/hooks";
import { useBranchApi, useStaff } from "../../src/ui/staff";
import { Empty } from "../../src/ui/components";
import { useI18n } from "../../src/i18n/react";

export default function QrSheet() {
  const s = useStaff();
  const b = useBranchApi();
  const { t } = useI18n();
  const { data } = usePoll(() => (s.branchId ? api<{ id: string; label: string; staticToken: string; parentId: string | null }[]>(b("tables")) : Promise.resolve(null)), { interval: 0, deps: [s.branchId] });
  const [imgs, setImgs] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!data) return;
    Promise.all(data.filter((t) => !t.parentId).map(async (t) => [t.id, await QRCode.toDataURL(`${location.origin}/t/${t.staticToken}`, { margin: 1, width: 220 })] as const)).then((x) => setImgs(Object.fromEntries(x)));
  }, [data]);
  const mode = s.branch?.config.qrMode;
  const tables = data?.filter((t) => !t.parentId);
  return (
    <div className="col">
      <div className="page-head no-print">
        <div>
          <h1>{t("staff.tables.qr.title")}</h1>
          <div className="muted">
            {s.branch?.name} · {t("staff.tables.qr.intro")}
          </div>
        </div>
        <button className="btn primary" disabled={!tables?.length} onClick={() => (window.print(), api("/api/m/tenant", { method: "PATCH", body: { onboarding: { qrPrinted: true } } }).catch(() => {}))}>
          <Printer size={18} aria-hidden /> {t("common.print")}
        </button>
      </div>
      {mode === "dynamic" && (
        <div className="alert info no-print">
          <Info size={18} aria-hidden />
          <span>{t("staff.tables.qr.dynamic")}</span>
        </div>
      )}
      {!tables ? (
        <div className="muted no-print">{t("common.loading")}</div>
      ) : !tables.length ? (
        <div className="card flat no-print">
          <Empty>
            {t("staff.tables.qr.empty")}{" "}
            <a href="/m/tables">{t("staff.tables.qr.setUp")}</a>
          </Empty>
        </div>
      ) : (
        <div className="qr-sheet">
          {tables.map((tb) => (
            <div key={tb.id} className="qr-card" data-testid="qr-card">
              {imgs[tb.id] ? <img src={imgs[tb.id]} alt={t("staff.tables.qr.alt", { label: tb.label })} width={180} height={180} /> : <div className="qr-ph" />}
              <div className="qr-label">{t("common.table", { label: tb.label })}</div>
              <div className="qr-scan">{t("staff.tables.qr.scan")}</div>
              <a className="no-print qr-link" href={`/t/${tb.staticToken}`}>
                /t/{tb.staticToken}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
