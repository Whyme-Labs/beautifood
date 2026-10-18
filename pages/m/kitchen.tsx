// Kitchen display: tickets per round, oldest first, per station; bump items through preparing → ready → served.
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, ChefHat, Clock, ConciergeBell } from "lucide-react";
import { api } from "../../src/ui/api";
import { usePoll } from "../../src/ui/hooks";
import { useBranchApi, useBranchChanges, useStaff } from "../../src/ui/staff";
import { Empty, ErrorBox, Status, useAction } from "../../src/ui/components";
import { useI18n } from "../../src/i18n/react";
import type { MessageKey } from "../../src/i18n/core";
import { localizeItem } from "../../src/shared/menuI18n";
import type { Menu } from "../../src/shared/types";

interface KTicket {
  orderId: string;
  number: string;
  type: string;
  tables: string[];
  round: number;
  firedAt: number | null;
  items: { id: string; name: string; qty: number; status: string; station: string; notes: string; modifiers: { option: string }[]; createdAt: number }[];
}

const STATIONS = ["", "kitchen", "bar", "dessert"] as const;
const LATE = 15;

export default function Kitchen() {
  const { t, locale } = useI18n();
  const s = useStaff();
  // order lines carry the original dish name; show the cook's language with the original underneath
  const [menu, setMenu] = useState<Menu | null>(null);
  useEffect(() => void api<Menu>("/api/m/menu").then(setMenu, () => {}), [s.tenant?.id]);
  const dish = useMemo(() => {
    const byName = new Map((menu?.items ?? []).map((i) => [i.name, i]));
    return (name: string) => {
      const it = byName.get(name);
      return it ? localizeItem(it, locale, menu?.language ?? "en") : { name, original: null };
    };
  }, [menu, locale]);
  const b = useBranchApi();
  const [station, setStation] = useState("");
  const { run, pending } = useAction();
  const { data, error, refresh } = usePoll(() => (s.branchId ? api<KTicket[]>(b(`kitchen${station ? `?station=${station}` : ""}`)) : Promise.resolve(null)), { interval: 15_000, deps: [s.branchId, station] });
  useBranchChanges(useCallback(() => void refresh(), [refresh]), ["order", "kitchen", "cart", "queue"]);
  const bump = (ids: string[], status: string) => run(async () => (await api(b("kitchen/status"), { body: { itemIds: ids, status } }), await refresh()));
  const next = (st: string) => (st === "pending" ? "fired" : st === "fired" ? "preparing" : st === "preparing" ? "ready" : "served");
  const statusName = (st: string) => t(`status.${st}` as MessageKey);
  return (
    <div className="col kitchen-page">
      <div className="page-head">
        <h1>{t("staff.kitchen.title")}</h1>
        <div className="segmented" role="group" aria-label={t("staff.kitchen.stationsLabel")}>
          {STATIONS.map((x) => (
            <button key={x} className={station === x ? "active" : ""} aria-pressed={station === x} onClick={() => setStation(x)}>
              {t(`staff.kitchen.stations.${x || "all"}`)}
            </button>
          ))}
        </div>
      </div>
      <ErrorBox error={error} />
      {data && !data.length && <Empty icon={<ChefHat size={32} strokeWidth={1.5} />}>{t("staff.kitchen.empty")}</Empty>}
      <div className="kds" data-testid="kds">
        {data?.map((tk) => {
          const age = Math.max(0, Math.round((Date.now() - (tk.firedAt ?? tk.items[0].createdAt)) / 60_000));
          const late = age >= LATE;
          const open = tk.items.filter((i) => i.status !== "ready" && i.status !== "served");
          const where = tk.tables.length ? t("staff.kitchen.table", { tables: tk.tables.join("+") }) : tk.type === "takeaway" ? t("staff.kitchen.takeaway", { number: tk.number }) : t("staff.kitchen.order", { number: tk.number });
          return (
            <article key={`${tk.orderId}:${tk.round}`} className={`card ticket ${late ? "late" : ""}`} data-testid="kds-ticket">
              <header>
                <span className="serial kds-where">{where}</span>
                <span className="kds-age" title={t("staff.kitchen.ageLabel", { count: age })}>
                  <Clock size={16} aria-hidden />
                  <span className="serial">{t("staff.kitchen.age", { count: age })}</span>
                  {late && <span className="kds-late">{t("staff.kitchen.late")}</span>}
                </span>
              </header>
              <div className="body">
                <div className="muted kds-meta">
                  {t("staff.kitchen.meta", { number: tk.number, round: tk.round })}
                  {open.length > 0 && open.length < tk.items.length && <> · {t("staff.kitchen.left", { count: open.length })}</>}
                </div>
                <ul className="kds-items">
                  {tk.items.map((i) => {
                    const done = i.status === "ready" || i.status === "served";
                    return (
                      <li key={i.id} className={done ? "done" : ""}>
                        <span className="serial kds-qty">{i.qty}×</span>
                        <div className="kds-item">
                          <div className="kds-name">{dish(i.name).name}</div>
                          {dish(i.name).original && <div className="kds-mods">{dish(i.name).original}</div>}
                          {i.modifiers.length > 0 && <div className="kds-mods">{i.modifiers.map((m) => m.option).join(" · ")}</div>}
                          {i.notes && <div className="kds-note">“{i.notes}”</div>}
                        </div>
                        <button className="btn kds-bump" disabled={pending} onClick={() => bump([i.id], next(i.status))} aria-label={t("staff.kitchen.bump", { name: i.name, status: statusName(next(i.status)) })}>
                          <Status s={i.status} />
                          <ArrowRight size={16} aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {open.length > 0 ? (
                  <button className="btn primary big block" disabled={pending} onClick={() => bump(open.map((i) => i.id), "ready")}>
                    <Check size={20} aria-hidden />
                    {t("staff.kitchen.allReady")}
                  </button>
                ) : (
                  <button className="btn sun big block" disabled={pending} onClick={() => bump(tk.items.map((i) => i.id), "served")}>
                    <ConciergeBell size={20} aria-hidden />
                    {t("staff.kitchen.served")}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
