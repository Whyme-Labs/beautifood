// Inventory pieces shared by the Inventory page and the dish editor: quantities in the
// ingredient's unit, and the Recipe section (what one serving of a dish uses).
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "./api";
import { useAction } from "./components";
import { useI18n } from "../i18n/react";
import type { MessageKey } from "../i18n/core";
import type { Ingredient, Unit } from "../shared/inventory";

export type { Ingredient };

/** "1.5 kg", "12 个": a decimal quantity in its unit, in the UI language. */
export function useQty() {
  const { t, locale } = useI18n();
  const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 });
  return {
    unit: (u: Unit | string) => t(`staff.inventory.units.${u}` as MessageKey),
    qty: (n: number, u: Unit | string) => `${num.format(n)} ${t(`staff.inventory.units.${u}` as MessageKey)}`,
  };
}

export const ingredientName = (i: Pick<Ingredient, "name" | "nameZh">, locale: string) => (locale.startsWith("zh") && i.nameZh) || i.name;

/** The dish editor's Recipe section: pick ingredients and how much one serving uses, then save. */
export function RecipeSection({ itemId }: { itemId: string }) {
  const { t, locale } = useI18n();
  const q = useQty();
  const { run, pending } = useAction();
  const [ingredients, setIngredients] = useState<Ingredient[] | null>(null);
  const [lines, setLines] = useState<{ ingredientId: string; qty: string }[]>([]);
  const [saved, setSaved] = useState("[]");
  useEffect(() => {
    let off = false;
    Promise.all([api<Ingredient[]>("/api/m/inventory/ingredients"), api<{ lines: { ingredientId: string; qty: number }[] }>(`/api/m/inventory/recipes/${itemId}`)]).then(
      ([ing, r]) => {
        if (off) return;
        const ls = r.lines.map((l) => ({ ingredientId: l.ingredientId, qty: String(l.qty) }));
        setIngredients(ing);
        setLines(ls);
        setSaved(JSON.stringify(ls));
      },
      () => !off && setIngredients([]),
    );
    return () => void (off = true);
  }, [itemId]);
  if (!ingredients) return null;
  const k = (key: string) => `staff.inventory.recipe.${key}` as MessageKey;
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const unused = ingredients.filter((i) => !lines.some((l) => l.ingredientId === i.id));
  const set = (n: number, p: Partial<(typeof lines)[number]>) => setLines(lines.map((l, i) => (i === n ? { ...l, ...p } : l)));
  const valid = lines.every((l) => byId.has(l.ingredientId) && Number(l.qty) > 0);
  const save = () =>
    run(async () => {
      const r = await api<{ lines: { ingredientId: string; qty: number }[] }>(`/api/m/inventory/recipes/${itemId}`, { method: "PUT", body: { lines: lines.map((l) => ({ ingredientId: l.ingredientId, qty: Number(l.qty) })) } });
      const ls = r.lines.map((l) => ({ ingredientId: l.ingredientId, qty: String(l.qty) }));
      setLines(ls);
      setSaved(JSON.stringify(ls));
    }, t(k("saved")));
  return (
    <section className="col" data-testid="recipe">
      <div>
        <h3 style={{ marginBottom: 2 }}>{t(k("title"))}</h3>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          {t(k("lead"))}
        </p>
      </div>
      {!ingredients.length ? (
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          {t(k("noIngredients"))} <a href="/m/inventory">{t(k("manage"))}</a>
        </p>
      ) : (
        <>
          {!lines.length && <p className="muted" style={{ margin: 0, fontSize: 13 }}>{t(k("none"))}</p>}
          {lines.map((l, n) => {
            const ing = byId.get(l.ingredientId);
            return (
              <div key={n} className="recipe-line" data-testid="recipe-line">
                <select value={l.ingredientId} onChange={(e) => set(n, { ingredientId: e.target.value })} aria-label={t(k("ingredient"))} data-testid="recipe-ingredient">
                  {[...(ing ? [ing] : []), ...unused].map((i) => (
                    <option key={i.id} value={i.id}>
                      {ingredientName(i, locale)}
                    </option>
                  ))}
                </select>
                <span className="recipe-qty">
                  <input type="number" inputMode="decimal" min={0} step="any" value={l.qty} onChange={(e) => set(n, { qty: e.target.value })} aria-label={t(k("qty"), { unit: ing ? q.unit(ing.unit) : "" })} data-testid="recipe-qty" />
                  <span className="muted">{ing ? q.unit(ing.unit) : ""}</span>
                </span>
                <button type="button" className="btn small ghost icon danger" onClick={() => setLines(lines.filter((_, i) => i !== n))} aria-label={`${t(k("remove"))}: ${ing ? ingredientName(ing, locale) : ""}`}>
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
          <div className="row between">
            <button type="button" className="btn small" disabled={!unused.length} onClick={() => setLines([...lines, { ingredientId: unused[0].id, qty: "" }])} data-testid="recipe-add">
              <Plus size={15} /> {t(k("add"))}
            </button>
            <button type="button" className="btn small primary" disabled={pending || !valid || JSON.stringify(lines) === saved} onClick={save} data-testid="recipe-save">
              {t(k("save"))}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
