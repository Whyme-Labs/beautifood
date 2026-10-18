// Restaurant directory (/eat): every branch's queue at a glance (customers can compare branches).
import { useState } from "react";
import { Bot, Gift, Search, Store } from "lucide-react";
import { api } from "../src/ui/api";
import { usePoll } from "../src/ui/hooks";
import { Empty, ErrorBox, Mins, stockOf, useClassLabel } from "../src/ui/components";
import { GuestBar } from "../src/ui/guest";
import { useI18n } from "../src/i18n/react";

interface Dir {
  branches: { branchId: string; ref: string; restaurant: string; cuisine: string; branch: string; address: string; waiting: number; freeTables: number; nowCalling: string[]; categories: { code: string; prefix?: string; label: string; waiting: number; estimateMinutes: number }[] }[];
}

export default function Directory() {
  const { t } = useI18n();
  const classLabel = useClassLabel();
  const [q, setQ] = useState("");
  const { data, error, loading } = usePoll(() => api<Dir>(`/api/public/directory${q ? `?q=${encodeURIComponent(q)}` : ""}`), { interval: 8000, deps: [q] });
  return (
    <>
      <GuestBar
        right={
          <>
            <a className="btn ghost small" href="/me">
              <Gift size={16} /> <span className="hide-sm">{t("home.myRewards")}</span>
            </a>
            <a className="btn small" href="/m">
              <Store size={16} /> <span className="hide-sm">{t("home.forRestaurants")}</span>
            </a>
          </>
        }
      />
      <main className="wrap" style={{ maxWidth: 760 }}>
        <section style={{ margin: "18px 0 22px" }}>
          <h1 style={{ fontSize: "clamp(2rem, 7vw, 3rem)", lineHeight: 1.05, marginBottom: 10 }}>{t("home.title")}</h1>
          <p className="muted" style={{ fontSize: 16, maxWidth: 560 }}>
            {t("home.lead")}
          </p>
          <div className="row nowrap" style={{ position: "relative", maxWidth: 520 }}>
            <Search size={18} style={{ position: "absolute", left: 12, color: "var(--ink-3)" }} />
            <input placeholder={t("home.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("home.searchLabel")} style={{ paddingLeft: 38 }} />
          </div>
        </section>
        <ErrorBox error={error} />
        {loading && !data ? <Empty>{t("home.loading")}</Empty> : null}
        {data && !data.branches.length ? <Empty>{t("home.none")}</Empty> : null}
        <div className="list gap">
          {data?.branches.map((b) => (
            <a key={b.branchId} href={`/r/${b.ref}`} className="card" style={{ color: "inherit", textDecoration: "none", display: "block" }} data-testid="branch-card">
              <div className="row between nowrap">
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: 0 }}>{b.restaurant}</h3>
                  <div className="muted" style={{ fontSize: 14 }}>
                    {b.branch}
                    {b.cuisine ? ` · ${b.cuisine}` : ""}
                  </div>
                </div>
                <span className={`badge ${b.waiting ? "warn" : b.freeTables ? "ok" : "bad"}`}>{b.waiting ? t("common.waiting", { count: b.waiting }) : b.freeTables ? t("home.walkIn") : t("home.full")}</span>
              </div>
              <div className="row" style={{ marginTop: 12, gap: 6 }}>
                {b.categories.map((c) => (
                  <span key={c.code} className="rowstub" data-stock={stockOf(c.prefix ?? c.code)} style={{ gridTemplateColumns: "34px auto", fontSize: 13 }} title={classLabel(c.label)}>
                    <span className="rs-num" style={{ padding: "4px 0" }}>
                      <b className="serial sm" style={{ fontSize: 17 }}>{c.prefix ?? c.code}</b>
                    </span>
                    <span style={{ padding: "4px 10px" }}>
                      {c.waiting} · <Mins v={c.estimateMinutes} />
                    </span>
                  </span>
                ))}
              </div>
              {b.nowCalling.length ? <div style={{ marginTop: 10, fontSize: 14 }} className="muted">{t("home.nowCalling", { numbers: b.nowCalling.join(", ") })}</div> : null}
            </a>
          ))}
        </div>
        <p className="muted row" style={{ marginTop: 36, fontSize: 13 }}>
          <Bot size={16} />
          <span>
            {t("common.forAgents", { mcp: "/mcp", llms: "/llms.txt" })} <a href="/llms.txt">llms.txt</a>
          </span>
        </p>
      </main>
    </>
  );
}
