// Menu editor: categories, dishes (price, allergens, dietary, spice, story, signature, station, modifiers) and per-branch sold-out.
import { useEffect, useState } from "react";
import { api } from "../../src/ui/api";
import { usePoll } from "../../src/ui/hooks";
import { useStaff } from "../../src/ui/staff";
import { Allergens, Dietary, Modal, Money, useAction } from "../../src/ui/components";
import { ALLERGENS, ALLERGEN_LABELS } from "../../src/shared/allergens";
import type { Menu, MenuItem } from "../../src/shared/types";

export default function MenuEditor() {
  const s = useStaff();
  const cur = s.tenant?.currency ?? "MYR";
  const { run } = useAction();
  const { data: menu, refresh } = usePoll(() => api<Menu>(`/api/m/menu?branch=${s.branchId ?? ""}`), { interval: 0, deps: [s.branchId] });
  const [edit, setEdit] = useState<Partial<MenuItem> | null>(null);
  const [newCat, setNewCat] = useState("");
  const canEdit = s.can("menu.manage");
  return (
    <div className="col">
      <div className="row between">
        <h1 style={{ margin: 0 }}>Menu</h1>
        {canEdit && (
          <div className="row">
            <form className="row" onSubmit={(e) => (e.preventDefault(), run(async () => (await api("/api/m/menu/categories", { body: { name: newCat } }), setNewCat(""), await refresh()), "Category added"))}>
              <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category" style={{ width: 160 }} aria-label="New category" />
              <button className="btn small" disabled={!newCat}>
                Add
              </button>
            </form>
            <button className="btn primary" disabled={!menu?.categories.length} onClick={() => setEdit({ categoryId: menu!.categories[0].id, name: "", price: 0, allergens: [], dietary: [], modifiers: [], spiceLevel: 0, station: "kitchen" })}>
              + Dish
            </button>
          </div>
        )}
      </div>
      {menu?.categories.map((c) => (
        <section key={c.id} className="card">
          <h2>{c.name}</h2>
          <div className="list">
            {menu.items
              .filter((i) => i.categoryId === c.id)
              .map((i) => (
                <div key={i.id} className="dish" data-testid="menu-item">
                  <div className="meta">
                    <b>{i.name}</b> {i.isSignature && <span className="badge brand">★</span>} {!i.active && <span className="badge">hidden</span>}
                    <div className="muted" style={{ fontSize: 13 }}>{i.description}</div>
                    <Dietary list={i.dietary} spice={i.spiceLevel} />
                    <Allergens list={i.allergens} />
                  </div>
                  <div className="col" style={{ alignItems: "flex-end" }}>
                    <Money v={i.price} c={cur} />
                    <div className="row" style={{ gap: 6 }}>
                      {s.can("menu.availability") && (
                        <button className={`btn small ${i.soldOut ? "danger" : ""}`} onClick={() => run(async () => (await api(`/api/m/branches/${s.branchId}/availability`, { body: { itemId: i.id, soldOut: !i.soldOut } }), await refresh()), i.soldOut ? "Back in stock" : `${i.name} sold out at ${s.branch?.name}`)}>
                          {i.soldOut ? "Sold out" : "In stock"}
                        </button>
                      )}
                      {canEdit && (
                        <button className="btn small" onClick={() => setEdit(i)}>
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </section>
      ))}
      <ItemModal item={edit} categories={menu?.categories ?? []} onClose={() => setEdit(null)} onSave={(it) => run(async () => {
        const { id, soldOut: _s, sort: _o, ...body } = it as MenuItem;
        await api(id ? `/api/m/menu/items/${id}` : "/api/m/menu/items", { method: id ? "PUT" : "POST", body });
        setEdit(null);
        await refresh();
      }, "Saved")} onDelete={(id) => run(async () => (await api(`/api/m/menu/items/${id}`, { method: "DELETE" }), setEdit(null), await refresh()), "Removed")} />
    </div>
  );
}

function ItemModal({ item, categories, onClose, onSave, onDelete }: { item: Partial<MenuItem> | null; categories: { id: string; name: string }[]; onClose: () => void; onSave: (i: Partial<MenuItem>) => void; onDelete: (id: string) => void }) {
  const [f, setF] = useState<Partial<MenuItem>>({});
  const [mods, setMods] = useState("");
  useEffect(() => {
    if (!item) return;
    setF(item);
    setMods(JSON.stringify(item.modifiers ?? [], null, 1));
  }, [item]);
  if (!item) return null;
  const set = (p: Partial<MenuItem>) => setF({ ...f, ...p });
  return (
    <Modal open onClose={onClose} title={item.id ? `Edit ${item.name}` : "New dish"}>
      <form
        className="col"
        onSubmit={(e) => {
          e.preventDefault();
          let modifiers = [];
          try {
            modifiers = JSON.parse(mods || "[]");
          } catch {
            alert("Modifiers must be valid JSON");
            return;
          }
          onSave({ ...f, modifiers, price: Math.round(Number(f.price)) });
        }}
      >
        <label>
          Name
          <input value={f.name ?? ""} onChange={(e) => set({ name: e.target.value })} required />
        </label>
        <div className="row">
          <label style={{ flex: 1 }}>
            Category
            <select value={f.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ flex: 1 }}>
            Price (cents)
            <input type="number" min={0} value={f.price ?? 0} onChange={(e) => set({ price: Number(e.target.value) })} />
          </label>
          <label style={{ flex: 1 }}>
            Station
            <select value={f.station ?? "kitchen"} onChange={(e) => set({ station: e.target.value })}>
              <option>kitchen</option>
              <option>bar</option>
              <option>dessert</option>
            </select>
          </label>
        </div>
        <label>
          Description
          <input value={f.description ?? ""} onChange={(e) => set({ description: e.target.value })} />
        </label>
        <label>
          Story (shown to guests and used by the AI assistant)
          <textarea value={f.story ?? ""} onChange={(e) => set({ story: e.target.value })} />
        </label>
        <fieldset style={{ border: "none", padding: 0 }}>
          <legend className="muted">Allergens</legend>
          <div className="row">
            {ALLERGENS.map((a) => (
              <label key={a} className="inline" style={{ fontSize: 12 }}>
                <input type="checkbox" checked={f.allergens?.includes(a) ?? false} onChange={(e) => set({ allergens: e.target.checked ? [...(f.allergens ?? []), a] : (f.allergens ?? []).filter((x) => x !== a) })} />
                {ALLERGEN_LABELS[a].split(" (")[0]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="row">
          {["vegetarian", "vegan", "halal_friendly"].map((d) => (
            <label key={d} className="inline">
              <input type="checkbox" checked={f.dietary?.includes(d) ?? false} onChange={(e) => set({ dietary: e.target.checked ? [...(f.dietary ?? []), d] : (f.dietary ?? []).filter((x) => x !== d) })} />
              {d.replace("_", " ")}
            </label>
          ))}
          <label className="inline">
            Spice
            <select value={f.spiceLevel ?? 0} onChange={(e) => set({ spiceLevel: Number(e.target.value) })} style={{ width: 70 }}>
              {[0, 1, 2, 3].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="inline">
            <input type="checkbox" checked={!!f.isSignature} onChange={(e) => set({ isSignature: e.target.checked })} /> Signature
          </label>
          <label className="inline">
            <input type="checkbox" checked={f.active !== false} onChange={(e) => set({ active: e.target.checked })} /> On menu
          </label>
        </div>
        <label>
          Modifiers (JSON: [{"{"}"name":"Size","min":1,"max":1,"options":[{"{"}"name":"Large","price":200{"}"}]{"}"}])
          <textarea value={mods} onChange={(e) => setMods(e.target.value)} style={{ fontFamily: "monospace", fontSize: 12 }} />
        </label>
        <div className="row between">
          <button className="btn primary">Save</button>
          {item.id && (
            <button type="button" className="btn danger" onClick={() => onDelete(item.id!)}>
              Remove from menu
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
