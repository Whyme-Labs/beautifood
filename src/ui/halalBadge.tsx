// What the branch declares about halal, as a guest sees it: certified (by whom, until when),
// Muslim-friendly, or pork & lard free. An expired certificate or nothing declared shows nothing.
import { BadgeCheck } from "lucide-react";
import type { HalalInfo, HalalStatus } from "../shared/types";
import { useI18n } from "../i18n/react";

export function HalalBadge({
  halal,
}: {
  halal: HalalInfo & { standing: HalalStatus | "expired" };
}) {
  const { t, f } = useI18n();
  const s = halal.standing;
  if (s === "none" || s === "expired") return null;
  const until =
    s === "certified" && halal.validUntil
      ? f.date(Date.parse(`${halal.validUntil}T00:00:00Z`), "UTC")
      : "";
  const detail = [
    halal.certNo ? t("menu.halalCertNo", { no: halal.certNo }) : "",
    until ? t("menu.halalUntil", { date: until }) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div
      className="row"
      style={{ gap: 8, flexWrap: "wrap", marginBottom: 10 }}
      data-testid="halal-badge"
    >
      <span className={`badge ${s === "certified" ? "ok" : "info"}`}>
        <BadgeCheck size={12} />
        {s === "certified"
          ? t("menu.halalCertified", { certifier: halal.certifier })
          : s === "muslim_friendly"
            ? t("menu.halalMuslimFriendly")
            : t("menu.halalPorkFree")}
      </span>
      {s === "certified" && detail ? (
        <span className="muted" style={{ fontSize: 12 }}>
          {detail}
        </span>
      ) : null}
      {s === "muslim_friendly" ? (
        <span className="muted" style={{ fontSize: 12 }}>
          {t("menu.halalNotCertified")}
        </span>
      ) : null}
      {s === "pork_free" ? (
        <span className="muted" style={{ fontSize: 12 }}>
          {t("menu.halalPorkFreeNote")}
        </span>
      ) : null}
    </div>
  );
}
