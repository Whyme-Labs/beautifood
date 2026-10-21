// Taste: what the people around this branch love (Qloo's taste graph, through the taste service),
// set against the menu and best sellers, with things to try and where each one came from.
import { useEffect, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { api, ApiError } from "../../src/ui/api";
import { useBranchApi, useStaff } from "../../src/ui/staff";
import { Empty, ErrorBox } from "../../src/ui/components";
import { useI18n } from "../../src/i18n/react";
import type { MessageKey } from "../../src/i18n/core";
import type { TasteBrief } from "../../src/server/taste/brief";

const k = (key: string) => `staff.taste.${key}` as MessageKey;

export default function TastePage() {
  const s = useStaff();
  const b = useBranchApi();
  const { t } = useI18n();
  const [area, setArea] = useState("");
  const [asked, setAsked] = useState("");
  const [brief, setBrief] = useState<TasteBrief | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [off, setOff] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async (refresh = false) => {
    if (!s.branchId) return;
    setBusy(true);
    setError(null);
    try {
      const q = new URLSearchParams({ ...(asked ? { location: asked } : {}), ...(refresh ? { refresh: "1" } : {}) });
      const r = await api<TasteBrief>(`${b("taste")}${q.size ? `?${q}` : ""}`);
      setBrief(r);
      if (!area) setArea(r.location);
    } catch (e) {
      if (e instanceof ApiError && e.code === "taste_off") setOff(true);
      else setError(e as Error);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.branchId, asked]);

  const location = brief?.location ?? (area || s.branch?.name || "");
  return (
    <div className="col">
      <div className="page-head">
        <div>
          <h1>{t(k("title"))}</h1>
          <div className="muted">{t(k("lead"), { location })}</div>
        </div>
        {!off && (
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              setAsked(area.trim());
            }}
          >
            <input value={area} onChange={(e) => setArea(e.target.value)} aria-label={t(k("area"))} placeholder={t(k("area"))} style={{ width: "auto", minWidth: 260 }} maxLength={120} />
            <button className="btn" type="button" onClick={() => load(true)} disabled={busy}>
              <RefreshCw size={16} strokeWidth={1.75} /> {t(k("refresh"))}
            </button>
          </form>
        )}
      </div>
      <ErrorBox error={error} />
      {off && <Empty>{t(k("off"))}</Empty>}
      {!off && busy && !brief && <Empty>{t(k("loading"), { location })}</Empty>}
      {brief && !brief.findings.length && !busy && <Empty>{t(k("empty"), { location: brief.location })}</Empty>}
      {brief && brief.actions.length > 0 && (
        <section className="card" data-testid="taste-actions">
          <h2>
            <Sparkles size={18} strokeWidth={1.75} /> {t(k("try"))}
          </h2>
          <ul className="col" style={{ gap: 10, paddingLeft: 18 }}>
            {brief.actions.map((a, i) => (
              <li key={i}>
                <b>{t(k(`actions.${a.kind}`), a.vars)}</b>
                <div className="hint">
                  {t(k("why"))}: {a.why}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {brief && (
        <div className="grid wide">
          {brief.findings.map((f) => (
            <section className="card" key={f.key} data-testid={`taste-${f.key}`}>
              <h3>{t(k(`findings.${f.key}`), { cuisine: s.tenant?.cuisine || "" })}</h3>
              <ol style={{ paddingLeft: 18 }}>
                {f.items.map((it) => (
                  <li key={it.id}>
                    {it.name}
                    {it.tags.length > 0 && <span className="hint"> · {it.tags.slice(0, 3).join(", ")}</span>}
                  </li>
                ))}
              </ol>
              <div className="hint">
                {t(k("source"), { asked: f.source.asked })}
                {f.source.cached ? ` · ${t(k("cached"))}` : ""}
              </div>
            </section>
          ))}
        </div>
      )}
      {brief && (
        <section className="card hint">
          <b>{t(k("limits"))}</b>
          <ul style={{ paddingLeft: 18 }}>
            {brief.limits.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <p>{t(k("agent"))}</p>
        </section>
      )}
    </div>
  );
}
