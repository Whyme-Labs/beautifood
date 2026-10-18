// TV "now calling" board for the restaurant entrance. Speaks new numbers aloud in the board's language.
import { useEffect, useRef } from "react";
import { useParams } from "@void/react";
import { QrCode } from "lucide-react";
import { api } from "../../../src/ui/api";
import { usePoll } from "../../../src/ui/hooks";
import { Mins, Stub, stockOf, useClassLabel } from "../../../src/ui/components";
import { localeInfo } from "../../../src/i18n/core";
import { useI18n } from "../../../src/i18n/react";

interface Status {
  name: string;
  categories: { code: string; prefix: string; label: string; waiting: number; estimateMinutes: number; min: number; max: number }[];
  nowCalling: { number: string; tables: string[] }[];
}

export default function Display() {
  const { t, locale } = useI18n();
  const classLabel = useClassLabel();
  const { ref } = useParams<{ ref: string }>();
  const { data } = usePoll(() => api<Status>(`/api/public/branches/${ref}/status`), { interval: 3000, maxInterval: 3000 });
  const last = useRef<string>("");
  useEffect(() => {
    const now = data?.nowCalling.map((n) => n.number).join(",") ?? "";
    if (now && now !== last.current && "speechSynthesis" in window) {
      const fresh = data!.nowCalling.filter((n) => !last.current.split(",").includes(n.number));
      for (const n of fresh) {
        const u = new SpeechSynthesisUtterance(n.tables.length ? t("display.sayTable", { number: n.number.split("").join(" "), tables: n.tables.join(", ") }) : t("display.say", { number: n.number.split("").join(" ") }));
        u.lang = localeInfo(locale).intl;
        speechSynthesis.speak(u);
      }
    }
    last.current = now;
  }, [data, t, locale]);
  return (
    <div className="display">
      <div className="row between" style={{ alignItems: "baseline" }}>
        <h1 style={{ fontSize: 44, margin: 0 }}>{data?.name}</h1>
        <span className="row" style={{ opacity: 0.75, fontSize: 22 }}>
          <QrCode size={26} /> {t("display.scan")}
        </span>
      </div>
      <h2 style={{ fontSize: 30, opacity: 0.75, marginTop: 36 }}>{t("display.nowCalling")}</h2>
      <div className="row" style={{ gap: 28, alignItems: "stretch" }} data-testid="now-calling">
        {data?.nowCalling.length ? (
          data.nowCalling.map((n) => (
            <Stub key={n.number} stock={stockOf(n.number)} tear={74} className="issued">
              <div className="calling" style={{ color: "#1a1814" }}>{n.number}</div>
              <div style={{ fontSize: 26, fontWeight: 700, marginTop: 30 }}>{n.tables.length ? t("common.table", { label: n.tables.join(" + ") }) : " "}</div>
            </Stub>
          ))
        ) : (
          <div style={{ fontSize: 48, opacity: 0.5 }}>—</div>
        )}
      </div>
      <div className="row" style={{ gap: 20, marginTop: 56, alignItems: "stretch" }}>
        {data?.categories.map((c) => (
          <div key={c.code} style={{ background: "#211e18", border: "1px solid #36322a", borderRadius: 14, padding: "20px 28px", minWidth: 230 }}>
            <div className="row" style={{ fontSize: 22, opacity: 0.85 }}>
              <span className="serial" style={{ background: `var(--stock-${stockOf(c.prefix).toLowerCase()}, var(--stock-x))`, color: "#1a1814", borderRadius: 6, padding: "2px 9px", fontSize: 26 }}>{c.prefix}</span>
              {classLabel(c.label)} · {t("common.pax", { min: c.min, max: c.max })}
            </div>
            <div className="serial" style={{ fontSize: 64, marginTop: 10 }}>{c.waiting}</div>
            <div style={{ fontSize: 22, opacity: 0.85 }}>
              {t("display.waitingWord")} · <Mins v={c.estimateMinutes} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
