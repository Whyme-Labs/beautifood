// Storefront editor: describe the look and the AI designs it; refine by asking again, or adjust the
// colours, fonts, layout, sections and words by hand. The preview is the real page with live data.
// Edits save to a draft; Publish puts it live at /at/<slug>.
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Eye, EyeOff, Monitor, Rocket, Smartphone, Sparkles } from "lucide-react";
import { api } from "../../src/ui/api";
import { useStaff } from "../../src/ui/staff";
import { ErrorBox, useAction } from "../../src/ui/components";
import { useI18n } from "../../src/i18n/react";
import type { MessageKey } from "../../src/i18n/core";
import { FONT_IDS, PRESETS, readable, contrast, type Storefront } from "../../src/shared/storefront";
import { StorefrontView, type StorefrontPayload } from "../../src/ui/storefront";

interface State {
  draft: Storefront;
  published: Storefront | null;
  updatedAt: number | null;
  publishedAt: number | null;
  data: StorefrontPayload & { restaurant: { slug: string } };
}

const COLOR_KEYS = ["bg", "surface", "ink", "accent", "accentInk"] as const;
const IDEAS = ["ideaKopitiam", "ideaModern", "ideaNight", "ideaStory"] as const;

export default function StorefrontEditor() {
  const s = useStaff();
  const { t, f, locale } = useI18n();
  const { run, pending } = useAction();
  const [st, setSt] = useState<State | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [d, setD] = useState<Storefront | null>(null);
  const [prompt, setPrompt] = useState("");
  const [notes, setNotes] = useState<string | null>(null);
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const [lang, setLang] = useState<"en" | "zh">(locale === "zh" ? "zh" : "en");
  const first = useRef(true);

  useEffect(() => {
    api<State>("/api/m/storefront").then((r) => (setSt(r), setD(r.draft)), setError);
  }, [s.tenant?.id]);

  // save the draft a moment after each change
  useEffect(() => {
    if (!d) return;
    if (first.current) return void (first.current = false);
    setSaved("saving");
    const h = setTimeout(() => api<{ draft: Storefront }>("/api/m/storefront", { method: "PUT", body: { design: d } }).then(() => setSaved("saved"), (e) => (setSaved("idle"), setError(e))), 700);
    return () => clearTimeout(h);
  }, [d]);

  if (!st || !d) return <ErrorBox error={error} />;
  const set = (p: Partial<Storefront>) => setD({ ...d, ...p });
  const theme = (p: Partial<Storefront["theme"]>) => set({ theme: { ...d.theme, ...p } });
  const words = (k: "tagline" | "intro", v: string) => set({ hero: { ...d.hero, [k]: { ...d.hero[k], [lang]: v } } });
  const move = (i: number, by: number) => {
    const next = [...d.sections];
    const [x] = next.splice(i, 1);
    next.splice(i + by, 0, x);
    set({ sections: next });
  };
  const design = (refine: boolean, text = prompt) =>
    run(async () => {
      const r = await api<{ design: Storefront; notes: string; engine: string }>("/api/m/storefront/design", { body: { prompt: text, refine } });
      setD(r.design);
      setNotes(r.notes || null);
      setPrompt("");
    });
  const publish = () =>
    run(async () => {
      await api("/api/m/storefront", { method: "PUT", body: { design: d } });
      const r = await api<Omit<State, "data">>("/api/m/storefront/publish", { method: "POST" });
      setSt({ ...st, ...r });
    }, t("staff.storefront.published"));
  const live = `/at/${st.data.restaurant.slug}`;
  const changed = JSON.stringify(st.published) !== JSON.stringify(d);
  const weak = contrast(d.theme.ink, d.theme.bg) < 4.5 || contrast(d.theme.accentInk, d.theme.accent) < 4.5;
  return (
    <div className="col">
      <div className="page-head">
        <div>
          <h1>{t("staff.storefront.title")}</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            {t("staff.storefront.lead")} <a href={live} target="_blank" rel="noreferrer">{location.host}{live}</a>
          </p>
        </div>
        <div className="row">
          <span className="muted" aria-live="polite" style={{ fontSize: 13 }}>
            {[saved === "saving" ? t("staff.storefront.saving") : saved === "saved" ? t("staff.storefront.draftSaved") : "", st.publishedAt ? t("staff.storefront.liveSince", { when: f.dateTime(st.publishedAt) }) : t("staff.storefront.notLive")].filter(Boolean).join(" · ")}
          </span>
          <a className="btn" href={live} target="_blank" rel="noreferrer">
            <ExternalLink size={16} /> {t("staff.storefront.view")}
          </a>
          <button className="btn primary" disabled={pending || (!changed && !!st.published)} onClick={publish} data-testid="publish-storefront">
            <Rocket size={16} /> {t("staff.storefront.publish")}
          </button>
        </div>
      </div>
      <ErrorBox error={error} />
      <div className="sf-editor">
        <div className="col">
          <section className="card col" data-testid="sf-designer">
            <h2 className="row nowrap" style={{ margin: 0 }}>
              <Sparkles size={18} strokeWidth={1.75} aria-hidden="true" /> {t("staff.storefront.designer")}
            </h2>
            <form className="col" onSubmit={(e) => (e.preventDefault(), prompt.trim().length >= 3 && design(true))}>
              <textarea value={prompt} maxLength={600} rows={3} placeholder={t("staff.storefront.promptPlaceholder")} onChange={(e) => setPrompt(e.target.value)} aria-label={t("staff.storefront.designer")} data-testid="sf-prompt" />
              <div className="row">
                <button className="btn primary" disabled={pending || prompt.trim().length < 3} data-testid="sf-design">
                  <Sparkles size={16} /> {t("staff.storefront.refine")}
                </button>
                <button type="button" className="btn" disabled={pending || prompt.trim().length < 3} onClick={() => design(false)}>
                  {t("staff.storefront.fresh")}
                </button>
              </div>
            </form>
            <div className="chips" style={{ flexWrap: "wrap" }}>
              {IDEAS.map((k) => (
                <button key={k} type="button" className="chip" disabled={pending} onClick={() => design(true, t(`staff.storefront.${k}` as MessageKey))}>
                  {t(`staff.storefront.${k}` as MessageKey)}
                </button>
              ))}
            </div>
            {notes && <div className="alert sun">{notes}</div>}
          </section>

          <section className="card col">
            <h2 style={{ margin: 0 }}>{t("staff.storefront.look")}</h2>
            <div className="sf-presets">
              {Object.entries(PRESETS).map(([id, p]) => (
                <button key={id} type="button" className="sf-preset" onClick={() => theme(p.theme)} aria-label={p.label[locale === "zh" ? "zh" : "en"]} title={p.label[locale === "zh" ? "zh" : "en"]}>
                  <span style={{ background: p.theme.bg }} />
                  <span style={{ background: p.theme.accent }} />
                  <span style={{ background: p.theme.ink }} />
                  <small>{p.label[locale === "zh" ? "zh" : "en"]}</small>
                </button>
              ))}
            </div>
            <div className="sf-colors">
              {COLOR_KEYS.map((k) => (
                <label key={k} className="sf-color">
                  <input type="color" value={d.theme[k]} onChange={(e) => theme({ [k]: e.target.value })} />
                  <span>{t(`staff.storefront.colors.${k}` as MessageKey)}</span>
                </label>
              ))}
            </div>
            {weak && (
              <div className="alert sun row between">
                <span>{t("staff.storefront.weakContrast")}</span>
                <button type="button" className="btn small" onClick={() => theme(readable(d.theme))}>
                  {t("staff.storefront.fixContrast")}
                </button>
              </div>
            )}
            <div className="row" style={{ alignItems: "flex-start" }}>
              <label className="grow">
                {t("staff.storefront.font")}
                <select value={d.theme.font} onChange={(e) => theme({ font: e.target.value as Storefront["theme"]["font"] })}>
                  {FONT_IDS.map((id) => (
                    <option key={id} value={id}>
                      {t(`staff.storefront.fonts.${id}` as MessageKey)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grow">
                {t("staff.storefront.corners")}
                <select value={d.theme.radius} onChange={(e) => theme({ radius: e.target.value as Storefront["theme"]["radius"] })}>
                  {(["sharp", "soft", "round"] as const).map((r) => (
                    <option key={r} value={r}>
                      {t(`staff.storefront.radius.${r}` as MessageKey)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grow">
                {t("staff.storefront.layout")}
                <select value={d.hero.layout} onChange={(e) => set({ hero: { ...d.hero, layout: e.target.value as Storefront["hero"]["layout"] } })}>
                  {(["centered", "split", "banner"] as const).map((l) => (
                    <option key={l} value={l}>
                      {t(`staff.storefront.layouts.${l}` as MessageKey)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="card col">
            <div className="row between">
              <h2 style={{ margin: 0 }}>{t("staff.storefront.words")}</h2>
              <div className="segmented" role="group" aria-label={t("common.language")}>
                {(["en", "zh"] as const).map((l) => (
                  <button key={l} type="button" aria-pressed={lang === l} className={lang === l ? "active" : ""} onClick={() => setLang(l)}>
                    {l === "en" ? "EN" : "中"}
                  </button>
                ))}
              </div>
            </div>
            <label>
              {t("staff.storefront.tagline")}
              <input value={d.hero.tagline[lang] ?? ""} maxLength={120} onChange={(e) => words("tagline", e.target.value)} placeholder={d.hero.tagline.en} />
            </label>
            <label>
              {t("staff.storefront.intro")}
              <textarea value={d.hero.intro[lang] ?? ""} maxLength={400} rows={3} onChange={(e) => words("intro", e.target.value)} placeholder={d.hero.intro.en} />
            </label>
            <label>
              {t("staff.storefront.image")}
              <input type="url" value={d.hero.image ?? ""} placeholder="https://" onChange={(e) => set({ hero: { ...d.hero, image: e.target.value || null } })} />
              <span className="hint">{t("staff.storefront.imageHint")}</span>
            </label>
          </section>

          <section className="card col">
            <h2 style={{ margin: 0 }}>{t("staff.storefront.sectionsTitle")}</h2>
            <div className="list">
              {d.sections.map((x, i) => (
                <div key={x.type} className="row between nowrap" data-testid="sf-section-row">
                  <span className={x.visible ? "" : "muted"}>{t(`storefront.sections.${x.type}` as MessageKey)}</span>
                  <span className="row nowrap">
                    <button type="button" className="btn small ghost icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t("staff.storefront.up")}>
                      <ArrowUp size={16} />
                    </button>
                    <button type="button" className="btn small ghost icon" disabled={i === d.sections.length - 1} onClick={() => move(i, 1)} aria-label={t("staff.storefront.down")}>
                      <ArrowDown size={16} />
                    </button>
                    <button type="button" className="btn small ghost icon" onClick={() => set({ sections: d.sections.map((y) => (y.type === x.type ? { ...y, visible: !y.visible } : y)) })} aria-label={x.visible ? t("staff.storefront.hide") : t("staff.storefront.show")} aria-pressed={x.visible}>
                      {x.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </span>
                </div>
              ))}
            </div>
            <label>
              {t("staff.storefront.gallery")}
              <textarea rows={3} value={d.gallery.map((g) => g.url).join("\n")} placeholder="https://…" onChange={(e) => set({ gallery: e.target.value.split(/\s+/).filter((u) => /^https?:\/\//.test(u)).slice(0, 12).map((url) => ({ url, alt: d.gallery.find((g) => g.url === url)?.alt ?? {} })) })} />
              <span className="hint">{t("staff.storefront.galleryHint")}</span>
            </label>
          </section>
        </div>

        <div className="sf-preview-col">
          <div className="row between">
            <b>{t("staff.storefront.preview")}</b>
            <div className="segmented" role="group" aria-label={t("staff.storefront.preview")}>
              <button type="button" aria-pressed={device === "phone"} className={device === "phone" ? "active" : ""} onClick={() => setDevice("phone")} aria-label={t("staff.storefront.phone")}>
                <Smartphone size={15} />
              </button>
              <button type="button" aria-pressed={device === "desktop"} className={device === "desktop" ? "active" : ""} onClick={() => setDevice("desktop")} aria-label={t("staff.storefront.desktop")}>
                <Monitor size={15} />
              </button>
            </div>
          </div>
          <div className={`sf-preview ${device}`} data-testid="sf-preview">
            <div className="sf-preview-inner">
              <StorefrontView design={d} data={st.data} preview />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
