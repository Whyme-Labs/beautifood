import { useMemo, useState } from "react";
import { ChevronDown, Plus, ShieldAlert, Star } from "lucide-react";
import type { Menu, MenuItem } from "../shared/types";
import { clockLabel, scheduleName, weekdayNames } from "../shared/schedule";
import { ALLERGENS } from "../shared/allergens";
import { localizeCategory, localizeItem } from "../shared/menuI18n";
import { guestFacts } from "../shared/customFields";
import { useI18n } from "../i18n/react";
import { Allergens, Dietary, Money } from "./components";

/** Menu with category chips and an allergen filter ("hide dishes containing…"), in the guest's language. */
export function MenuList({ menu, currency, onPick, action }: { menu: Menu; currency: string; onPick?: (item: MenuItem) => void; action?: string }) {
  const { t, locale } = useI18n();
  const lang = menu.language ?? "en";
  const [avoid, setAvoid] = useState<string[]>([]);
  const [cat, setCat] = useState<string>("all");
  const [showStory, setShowStory] = useState<string | null>(null);
  // what is served now first; later menus' dishes after, greyed, with when they are on
  const items = useMemo(
    () => menu.items.filter((i) => (cat === "all" || i.categoryId === cat) && !avoid.some((a) => i.allergens.includes(a))).sort((a, b) => Number(a.servedNow === false) - Number(b.servedNow === false)),
    [menu, cat, avoid],
  );
  const named = (id: string, fallback: string) => {
    const x = [...(menu.menus ?? []), ...(menu.rules ?? [])].find((m) => m.id === id);
    return x ? scheduleName(x, locale) : fallback;
  };
  const when = (n: NonNullable<MenuItem["nextServed"]>) => {
    const time = clockLabel(n.time, locale);
    const name = named(n.menuId, n.menu);
    return n.today ? t("menu.servedFrom", { menu: name, time }) : t("menu.servedFromDay", { menu: name, day: weekdayNames(locale)[n.weekday], time });
  };
  const now = menu.now;
  return (
    <div className="col">
      {now && (now.menus.length > 0 || now.deals.length > 0) && (menu.menus?.length || now.deals.length) ? (
        <div className="menu-now" data-testid="menu-now">
          {now.menus.length > 0 && (
            <span className="menu-now-item">
              <b>{t("menu.nowServing")}</b> {now.menus.map((m) => named(m.id, m.name)).join(" · ")}
              {now.menus.length === 1 && now.menus[0].until && <span className="muted"> {t("menu.until", { time: clockLabel(now.menus[0].until, locale) })}</span>}
            </span>
          )}
          {now.deals.map((d) => (
            <span key={d.id} className="menu-now-item deal" data-testid="menu-deal">
              <b>{named(d.id, d.name)}</b>
              {d.until && <span> {t("menu.until", { time: clockLabel(d.until, locale) })}</span>}
            </span>
          ))}
        </div>
      ) : null}
      <div className="chips" role="toolbar" aria-label={t("menu.title")}>
        <button className="chip" aria-pressed={cat === "all"} onClick={() => setCat("all")}>
          {t("menu.all")}
        </button>
        {menu.categories.map((c) => (
          <button key={c.id} className="chip" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
            {localizeCategory(c, locale, lang)}
          </button>
        ))}
      </div>
      <details className="card sunk tight">
        <summary className="row" style={{ cursor: "pointer", fontWeight: 650, listStyle: "none" }}>
          <ShieldAlert size={16} /> {t("menu.avoid")}
          {avoid.length ? <span className="badge brand">{t("menu.avoiding", { count: avoid.length })}</span> : null}
          <ChevronDown size={16} style={{ marginLeft: "auto" }} />
        </summary>
        <div className="row" style={{ marginTop: 10, gap: 6 }}>
          {ALLERGENS.map((a) => (
            <button key={a} type="button" className="chip" aria-pressed={avoid.includes(a)} onClick={() => setAvoid(avoid.includes(a) ? avoid.filter((x) => x !== a) : [...avoid, a])}>
              {t(`allergens.${a}`)}
            </button>
          ))}
        </div>
      </details>
      <div className="list" data-testid="menu-list">
        {items.map((i) => {
          const l = localizeItem(i, locale, lang);
          return (
            <div key={i.id} className={`dish ${i.soldOut || i.servedNow === false ? "sold" : ""}`} data-testid="dish">
              <div className="meta">
                <div className="row" style={{ gap: 6 }}>
                  <span className="name">{l.name}</span>
                  {i.isSignature && (
                    <span className="sig">
                      <Star size={11} fill="currentColor" /> {t("menu.signature")}
                    </span>
                  )}
                  {i.soldOut && <span className="badge bad">{t("menu.soldOut")}</span>}
                  {!i.soldOut && i.servedNow === false && <span className="badge" data-testid="dish-later">{i.nextServed ? when(i.nextServed) : t("menu.notNow")}</span>}
                  {i.deal && <span className="badge deal">{named(i.deal.id, i.deal.name)}</span>}
                </div>
                {l.original && <div className="alt">{l.original}</div>}
                {l.description && <div className="muted" style={{ fontSize: 13.5, marginTop: 2 }}>{l.description}</div>}
                <Dietary list={i.dietary} spice={i.spiceLevel} />
                <Allergens list={i.allergens} />
                {menu.fields && i.custom && (
                  <div className="muted dish-facts" data-testid="dish-facts">
                    {guestFacts(menu.fields, i.custom, locale).join(" · ")}
                  </div>
                )}
                {l.story && (
                  <button className="btn ghost small" style={{ paddingLeft: 0, marginTop: 2 }} onClick={() => setShowStory(showStory === i.id ? null : i.id)} aria-expanded={showStory === i.id}>
                    {showStory === i.id ? t("menu.hideStory") : t("menu.story")}
                  </button>
                )}
                {showStory === i.id && <p style={{ fontSize: 14, margin: "4px 0 0" }}>{l.story}</p>}
              </div>
              <div className="col tight" style={{ alignItems: "flex-end" }}>
                <span className="price">
                  <Money v={i.price} c={currency} />
                </span>
                {i.listPrice != null && (
                  <s className="muted list-price">
                    <span className="sr-only">{t("menu.usually", { price: "" })}</span>
                    <Money v={i.listPrice} c={currency} />
                  </s>
                )}
                {onPick && (
                  <button className="btn small primary" disabled={i.soldOut || i.servedNow === false} onClick={() => onPick(i)} aria-label={`${action ?? t("menu.add")} ${l.name}`}>
                    <Plus size={15} /> {action ?? t("menu.add")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!items.length && <div className="muted">{t("menu.noMatch")}</div>}
      </div>
      <p className="muted" style={{ fontSize: 12.5 }}>
        {t("menu.allergenNote")}
      </p>
    </div>
  );
}
