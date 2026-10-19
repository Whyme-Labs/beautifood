// The storefront renderer: a design (theme, hero, ordered sections) filled with what's live. Used
// by the public page (/at/<slug>) and by the editor's preview, so what the owner sees is what goes out.
import type React from "react";
import { ArrowRight, CalendarDays, MapPin, Phone, Ticket, UtensilsCrossed } from "lucide-react";
import { usePoll } from "./hooks";
import { api } from "./api";
import { LangSwitch, Money, Logo } from "./components";
import { useI18n } from "../i18n/react";
import { localizeItem } from "../shared/menuI18n";
import { clockLabel, scheduleName } from "../shared/schedule";
import { FONTS, say, type SectionType, type Storefront } from "../shared/storefront";
import type { MessageKey } from "../i18n/core";
import type { MenuItem } from "../shared/types";

export interface StorefrontPayload {
  restaurant: { name: string; slug: string; cuisine: string; description: string; story: string; translations: Record<string, { story?: string; description?: string }> };
  branches: { id: string; ref: string; name: string; address: string; phone: string; modules: { bookings: boolean; queue: boolean; takeaway: boolean }; hours: { open: number; close: number } | null }[];
  currency: string;
  menuLanguage: string;
  menu: { now?: { menus: { id: string; name: string; until: string | null }[]; deals: { id: string; name: string; until: string | null }[] }; menus?: { id: string; name: string; translations?: Record<string, { name?: string }> }[]; rules?: { id: string; name: string; translations?: Record<string, { name?: string }> }[]; signatures: MenuItem[]; deals: MenuItem[] };
}

interface Status {
  categories: { code: string; waiting: number; estimateMinutes: number; min: number; max: number }[];
  tables: { total: number; free: number };
}

const RADIUS = { sharp: "4px", soft: "14px", round: "26px" } as const;

export function themeStyle(d: Storefront): React.CSSProperties {
  const f = FONTS[d.theme.font];
  return {
    ["--sf-bg" as string]: d.theme.bg,
    ["--sf-surface" as string]: d.theme.surface,
    ["--sf-ink" as string]: d.theme.ink,
    ["--sf-accent" as string]: d.theme.accent,
    ["--sf-accent-ink" as string]: d.theme.accentInk,
    ["--sf-radius" as string]: RADIUS[d.theme.radius],
    ["--sf-heading" as string]: f.heading,
    ["--sf-body" as string]: f.body,
    ["--sf-heading-weight" as string]: String(f.headingWeight),
    ["--sf-heading-case" as string]: f.headingCase ?? "none",
  };
}

export function StorefrontView({ design, data, preview }: { design: Storefront; data: StorefrontPayload; preview?: boolean }) {
  const { t, locale } = useI18n();
  const r = data.restaurant;
  const story = (locale !== data.menuLanguage && r.translations?.[locale]?.story) || r.story;
  const first = data.branches[0];
  const title = (type: SectionType) => say(design.sections.find((s) => s.type === type)?.title, locale) || t(`storefront.sections.${type}` as MessageKey);
  const visible = design.sections.filter((s) => s.visible && (s.type !== "gallery" || design.gallery.length));
  const one = data.branches.length === 1 ? first : null;
  const sections: Record<SectionType, () => React.ReactNode> = {
    queue: () => <QueueSection data={data} title={title("queue")} preview={preview} />,
    menu: () => <MenuSection data={data} title={title("menu")} />,
    story: () =>
      story ? (
        <section className="sf-section sf-story" id="story" key="story">
          <h2>{title("story")}</h2>
          {story.split(/\n{2,}/).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>
      ) : null,
    branches: () => (
      <section className="sf-section" id="branches" key="branches">
        <h2>{title("branches")}</h2>
        <div className="sf-grid">
          {data.branches.map((b) => (
            <div key={b.id} className="sf-card col tight">
              <h3>{b.name}</h3>
              {b.address && (
                <a className="sf-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.name} ${b.address}`)}`} target="_blank" rel="noreferrer">
                  <MapPin size={16} aria-hidden="true" /> {b.address}
                </a>
              )}
              {b.phone && (
                <a className="sf-link" href={`tel:${b.phone.replace(/[^\d+]/g, "")}`}>
                  <Phone size={16} aria-hidden="true" /> {b.phone}
                </a>
              )}
              {b.hours && b.modules.bookings && <span className="sf-muted">{t("storefront.bookingHours", { from: clockLabel(`${String(b.hours.open).padStart(2, "0")}:00`, locale), to: clockLabel(`${String(b.hours.close % 24).padStart(2, "0")}:00`, locale) })}</span>}
            </div>
          ))}
        </div>
      </section>
    ),
    booking: () =>
      data.branches.some((b) => b.modules.bookings) ? (
        <section className="sf-section sf-booking" id="booking" key="booking">
          <h2>{title("booking")}</h2>
          <p className="sf-muted">{t("storefront.bookingLead")}</p>
          <div className="row">
            {data.branches
              .filter((b) => b.modules.bookings)
              .map((b) => (
                <a key={b.id} className="sf-btn" href={`/r/${b.ref}/book`}>
                  <CalendarDays size={18} aria-hidden="true" /> {data.branches.length > 1 ? t("storefront.bookAt", { branch: b.name }) : t("storefront.book")}
                </a>
              ))}
          </div>
        </section>
      ) : null,
    gallery: () => (
      <section className="sf-section" id="gallery" key="gallery">
        <h2>{title("gallery")}</h2>
        <div className="sf-gallery">
          {design.gallery.map((g, i) => (
            <img key={i} src={g.url} alt={say(g.alt, locale)} loading="lazy" />
          ))}
        </div>
      </section>
    ),
  };
  const tagline = say(design.hero.tagline, locale) || (locale !== data.menuLanguage && r.translations?.[locale]?.description) || r.description;
  const intro = say(design.hero.intro, locale);
  return (
    <div className={`sf sf-${design.hero.layout}`} style={themeStyle(design)} data-testid="storefront">
      <header className="sf-top">
        <a className="sf-name" href={preview ? undefined : `/at/${r.slug}`}>
          {r.name}
        </a>
        <LangSwitch />
      </header>
      <section className="sf-hero">
        <div className="sf-hero-text">
          {r.cuisine && <span className="sf-kicker">{r.cuisine}</span>}
          <h1>{r.name}</h1>
          {tagline && <p className="sf-tagline">{tagline}</p>}
          {intro && <p className="sf-intro">{intro}</p>}
          <div className="sf-ctas">
            <a className="sf-btn" href={one ? `/r/${one.ref}` : "#queue"} data-testid="sf-join">
              <Ticket size={18} aria-hidden="true" /> {t("storefront.join")}
            </a>
            {first && (
              <a className="sf-btn ghost" href={`/r/${first.ref}/menu`}>
                <UtensilsCrossed size={18} aria-hidden="true" /> {t("storefront.menu")}
              </a>
            )}
          </div>
        </div>
        {design.hero.layout === "split" && (
          <div className="sf-hero-art" aria-hidden="true">
            {design.hero.image ? <img src={design.hero.image} alt="" /> : <span>{r.name.slice(0, 1)}</span>}
          </div>
        )}
      </section>
      <main className="sf-main">{visible.map((s) => <div key={s.type}>{sections[s.type]()}</div>)}</main>
      <footer className="sf-foot">
        <span>{t("storefront.poweredBy")}</span>
        <Logo href="/" />
      </footer>
    </div>
  );
}

function QueueSection({ data, title, preview }: { data: StorefrontPayload; title: string; preview?: boolean }) {
  const { t } = useI18n();
  return (
    <section className="sf-section" id="queue">
      <h2>{title}</h2>
      <div className="sf-grid">
        {data.branches.map((b) => (
          <BranchQueue key={b.id} ref_={b.ref} name={b.name} preview={preview} label={t("storefront.joinAt", { branch: b.name })} />
        ))}
      </div>
    </section>
  );
}

function BranchQueue({ ref_, name, label, preview }: { ref_: string; name: string; label: string; preview?: boolean }) {
  const { t, mins } = useI18n();
  const { data: st } = usePoll(() => api<Status>(`/api/public/branches/${ref_}/status`), { interval: preview ? 30_000 : 8000 });
  const waiting = st?.categories.reduce((a, c) => a + c.waiting, 0) ?? null;
  const pair = st?.categories.find((c) => 2 >= c.min && 2 <= c.max);
  return (
    <div className="sf-card col tight" data-testid="sf-branch-queue">
      <h3>{name}</h3>
      <div className="sf-big">{waiting ?? "–"}</div>
      <span className="sf-muted">{waiting === null ? t("common.loading") : waiting ? t("storefront.waiting", { count: waiting }) : t("storefront.noWait")}</span>
      {pair && pair.estimateMinutes > 0 && <span className="sf-muted">{t("storefront.waitForTwo", { mins: mins(pair.estimateMinutes) })}</span>}
      <a className="sf-btn" href={`/r/${ref_}`} aria-label={label}>
        {t("storefront.join")} <ArrowRight size={16} aria-hidden="true" />
      </a>
    </div>
  );
}

function MenuSection({ data, title }: { data: StorefrontPayload; title: string }) {
  const { t, locale } = useI18n();
  const named = (id: string, fallback: string) => {
    const x = [...(data.menu.menus ?? []), ...(data.menu.rules ?? [])].find((m) => m.id === id);
    return x ? scheduleName(x, locale) : fallback;
  };
  const now = data.menu.now;
  const dish = (i: MenuItem) => {
    const l = localizeItem(i, locale, data.menuLanguage);
    return (
      <div key={i.id} className="sf-dish">
        <div className="col tight" style={{ minWidth: 0 }}>
          <b>{l.name}</b>
          {l.original && <span className="sf-muted">{l.original}</span>}
          {l.description && <span className="sf-muted sf-desc">{l.description}</span>}
        </div>
        <span className="sf-price">
          <Money v={i.price} c={data.currency} />
          {i.listPrice != null && (
            <s>
              <Money v={i.listPrice} c={data.currency} />
            </s>
          )}
        </span>
      </div>
    );
  };
  return (
    <section className="sf-section" id="menu">
      <h2>{title}</h2>
      {now && (now.menus.length > 0 || now.deals.length > 0) && (
        <div className="sf-now">
          {now.menus.map((m) => (
            <span key={m.id} className="sf-chip">
              {t("menu.nowServing")} {named(m.id, m.name)}
              {m.until ? ` · ${t("menu.until", { time: clockLabel(m.until, locale) })}` : ""}
            </span>
          ))}
          {now.deals.map((d) => (
            <span key={d.id} className="sf-chip deal">
              {named(d.id, d.name)}
              {d.until ? ` · ${t("menu.until", { time: clockLabel(d.until, locale) })}` : ""}
            </span>
          ))}
        </div>
      )}
      {data.menu.deals.length > 0 && <div className="sf-dishes">{data.menu.deals.map(dish)}</div>}
      <div className="sf-dishes">{data.menu.signatures.filter((s) => !data.menu.deals.some((d) => d.id === s.id)).map(dish)}</div>
      {data.branches[0] && (
        <a className="sf-link" href={`/r/${data.branches[0].ref}/menu`}>
          {t("storefront.fullMenu")} <ArrowRight size={16} aria-hidden="true" />
        </a>
      )}
    </section>
  );
}
