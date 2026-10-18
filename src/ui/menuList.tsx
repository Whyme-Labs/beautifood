import { useMemo, useState } from "react";
import { ChevronDown, Plus, ShieldAlert, Star } from "lucide-react";
import type { Menu, MenuItem } from "../shared/types";
import { ALLERGENS } from "../shared/allergens";
import { localizeCategory, localizeItem } from "../shared/menuI18n";
import { useI18n } from "../i18n/react";
import { Allergens, Dietary, Money } from "./components";

/** Menu with category chips and an allergen filter ("hide dishes containing…"), in the guest's language. */
export function MenuList({ menu, currency, onPick, action }: { menu: Menu; currency: string; onPick?: (item: MenuItem) => void; action?: string }) {
  const { t, locale } = useI18n();
  const lang = menu.language ?? "en";
  const [avoid, setAvoid] = useState<string[]>([]);
  const [cat, setCat] = useState<string>("all");
  const [showStory, setShowStory] = useState<string | null>(null);
  const items = useMemo(() => menu.items.filter((i) => (cat === "all" || i.categoryId === cat) && !avoid.some((a) => i.allergens.includes(a))), [menu, cat, avoid]);
  return (
    <div className="col">
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
            <div key={i.id} className={`dish ${i.soldOut ? "sold" : ""}`} data-testid="dish">
              <div className="meta">
                <div className="row" style={{ gap: 6 }}>
                  <span className="name">{l.name}</span>
                  {i.isSignature && (
                    <span className="sig">
                      <Star size={11} fill="currentColor" /> {t("menu.signature")}
                    </span>
                  )}
                  {i.soldOut && <span className="badge bad">{t("menu.soldOut")}</span>}
                </div>
                {l.original && <div className="alt">{l.original}</div>}
                {l.description && <div className="muted" style={{ fontSize: 13.5, marginTop: 2 }}>{l.description}</div>}
                <Dietary list={i.dietary} spice={i.spiceLevel} />
                <Allergens list={i.allergens} />
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
                {onPick && (
                  <button className="btn small primary" disabled={i.soldOut} onClick={() => onPick(i)} aria-label={`${action ?? t("menu.add")} ${l.name}`}>
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
