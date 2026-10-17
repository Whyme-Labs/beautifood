import { useMemo, useState } from "react";
import type { Menu, MenuItem } from "../shared/types";
import { ALLERGENS, ALLERGEN_LABELS } from "../shared/allergens";
import { Allergens, Dietary, Money } from "./components";

/** Menu with category tabs and an allergen filter ("hide dishes containing…"). */
export function MenuList({ menu, currency, onPick, action = "Add" }: { menu: Menu; currency: string; onPick?: (item: MenuItem) => void; action?: string }) {
  const [avoid, setAvoid] = useState<string[]>([]);
  const [cat, setCat] = useState<string>("all");
  const [showStory, setShowStory] = useState<string | null>(null);
  const items = useMemo(() => menu.items.filter((i) => (cat === "all" || i.categoryId === cat) && !avoid.some((a) => i.allergens.includes(a))), [menu, cat, avoid]);
  return (
    <div className="col">
      <div className="row" role="tablist">
        <button className={`btn small ${cat === "all" ? "primary" : ""}`} onClick={() => setCat("all")}>
          All
        </button>
        {menu.categories.map((c) => (
          <button key={c.id} className={`btn small ${cat === c.id ? "primary" : ""}`} onClick={() => setCat(c.id)}>
            {c.name}
          </button>
        ))}
      </div>
      <details>
        <summary className="muted">Allergies? Hide dishes containing… {avoid.length ? `(${avoid.length})` : ""}</summary>
        <div className="row" style={{ marginTop: 8 }}>
          {ALLERGENS.map((a) => (
            <label key={a} className="inline">
              <input type="checkbox" checked={avoid.includes(a)} onChange={(e) => setAvoid(e.target.checked ? [...avoid, a] : avoid.filter((x) => x !== a))} />
              {ALLERGEN_LABELS[a].split(" (")[0]}
            </label>
          ))}
        </div>
      </details>
      <div className="list" data-testid="menu-list">
        {items.map((i) => (
          <div key={i.id} className="dish" data-testid="dish">
            <div className="meta">
              <div className="row" style={{ gap: 6 }}>
                <b>{i.name}</b>
                {i.isSignature && <span className="badge brand">★ signature</span>}
                {i.soldOut && <span className="badge bad">sold out</span>}
              </div>
              {i.description && <div className="muted" style={{ fontSize: 13 }}>{i.description}</div>}
              <Dietary list={i.dietary} spice={i.spiceLevel} />
              <Allergens list={i.allergens} />
              {i.story && (
                <button className="btn ghost small" style={{ paddingLeft: 0 }} onClick={() => setShowStory(showStory === i.id ? null : i.id)}>
                  {showStory === i.id ? "Hide story" : "The story"}
                </button>
              )}
              {showStory === i.id && <p style={{ fontSize: 13, fontStyle: "italic" }}>{i.story}</p>}
            </div>
            <div className="col" style={{ alignItems: "flex-end", gap: 6 }}>
              <span className="price">
                <Money v={i.price} c={currency} />
              </span>
              {onPick && (
                <button className="btn small primary" disabled={i.soldOut} onClick={() => onPick(i)} aria-label={`${action} ${i.name}`}>
                  {action}
                </button>
              )}
            </div>
          </div>
        ))}
        {!items.length && <div className="muted">No dishes match.</div>}
      </div>
      <p className="muted" style={{ fontSize: 12 }}>Allergen information is provided by the restaurant. If you have a severe allergy, please confirm with our staff.</p>
    </div>
  );
}
