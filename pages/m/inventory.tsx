// Inventory: stock at the current branch (on hand, low mark, status, the dishes each ingredient is
// in), deliveries and wastage (kitchen), counts and corrections (managers), what's running low,
// the recent ledger, and the restaurant's ingredients. Recipes are on each dish in Menu.
import { useState } from "react";
import { AlertTriangle, Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { api } from "../../src/ui/api";
import { usePoll } from "../../src/ui/hooks";
import { useStaff } from "../../src/ui/staff";
import { Empty, ErrorBox, Modal, useAction } from "../../src/ui/components";
import { ingredientName, useQty, type Ingredient } from "../../src/ui/inventory";
import { useI18n } from "../../src/i18n/react";
import type { MessageKey } from "../../src/i18n/core";
import { UNITS, type EntryKind, type MovementKind, type StockStatus, type Unit } from "../../src/shared/inventory";

interface StockItem extends Ingredient {
  tracked: boolean;
  onHand: number | null;
  lowAt: number | null;
  status: StockStatus;
  dishes: { id: string; name: string; soldOut: boolean; byInventory: boolean }[];
}
interface Movement {
  id: string;
  ingredientId: string;
  name: string;
  nameZh: string;
  unit: Unit;
  kind: MovementKind;
  delta: number;
  onHand: number;
  reason: string;
  at: number;
}

const TONE: Record<StockStatus, string> = { untracked: "", ok: "ok", low: "warn", out: "bad" };
const k = (key: string) => `staff.inventory.${key}` as MessageKey;

export default function InventoryPage() {
  const s = useStaff();
  const { t, f, locale } = useI18n();
  const q = useQty();
  const manage = s.can("inventory.manage");
  const branch = s.branchId ?? "";
  const { data, error, refresh } = usePoll(
    async () => {
      const [stock, ledger] = await Promise.all([api<{ items: StockItem[]; low: string[] }>(`/api/m/branches/${branch}/inventory`), api<Movement[]>(`/api/m/branches/${branch}/inventory/movements?limit=20`)]);
      return { ...stock, ledger };
    },
    { interval: 15_000, deps: [branch], enabled: !!branch },
  );
  const [entry, setEntry] = useState<{ item: StockItem; kind: EntryKind } | null>(null);
  const low = data?.items.filter((i) => data.low.includes(i.id)) ?? [];
  return (
    <div className="col">
      <div className="page-head">
        <div>
          <h1>{t(k("title"))}</h1>
          {s.branch && <p className="muted" style={{ margin: "4px 0 0" }}>{t(k("lead"), { branch: s.branch.name })}</p>}
        </div>
      </div>
      <ErrorBox error={error} />

      {low.length > 0 && (
        <section className="card col tight" data-testid="inv-low">
          <h2 className="row nowrap" style={{ margin: 0 }}>
            <AlertTriangle size={18} strokeWidth={1.75} aria-hidden="true" /> {t(k("low.title"))}
          </h2>
          <div className="list">
            {low.map((i) => {
              const out = i.dishes.filter((d) => d.soldOut);
              return (
                <div key={i.id} className="row between" data-testid="inv-low-row">
                  <div style={{ minWidth: 0 }}>
                    <b>{ingredientName(i, locale)}</b>{" "}
                    <span className="muted" style={{ fontSize: 13 }}>
                      · {t(k("low.left"), { qty: q.qty(i.onHand ?? 0, i.unit) })} · {t(k("low.at"), { qty: q.qty(i.lowAt ?? 0, i.unit) })}
                    </span>
                    {out.length > 0 && <div className="muted" style={{ fontSize: 13 }}>{t(k("low.soldOut"), { dishes: out.map((d) => d.name).join(", ") })}</div>}
                  </div>
                  <span className="row nowrap">
                    <span className={`badge ${TONE[i.status]}`}>{t(k(`status.${i.status}`))}</span>
                    <button className="btn small" onClick={() => setEntry({ item: i, kind: "received" })}>
                      {t(k("stock.receive"))}
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="card" data-testid="inv-stock">
        <div className="section-title">
          <h2>{t(k("stock.title"))}</h2>
          {s.branch && <span className="muted">{s.branch.name}</span>}
        </div>
        {data && !data.items.length && (
          <Empty>
            {t(k("stock.none"))} {manage && t(k("stock.noneHint"))}
          </Empty>
        )}
        <div className="list">
          {data?.items.map((i) => (
            <div key={i.id} className="inv-row" data-testid="inv-row" data-status={i.status}>
              <div style={{ minWidth: 0 }}>
                <b>{ingredientName(i, locale)}</b>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  {i.dishes.length ? t(k("stock.usedIn"), { dishes: i.dishes.map((d) => d.name).join(", ") }) : t(k("stock.notUsed"))}
                </div>
              </div>
              <div className="inv-qty">
                <b className={i.status === "out" ? "inv-neg" : ""} data-testid="inv-onhand">{i.tracked ? q.qty(i.onHand!, i.unit) : "—"}</b>
                <span className={`badge ${TONE[i.status]}`}>{t(k(`status.${i.status}`))}</span>
                {i.tracked && i.lowAt! > 0 && <span className="muted" style={{ fontSize: 12 }}>{t(k("low.at"), { qty: q.qty(i.lowAt!, i.unit) })}</span>}
              </div>
              <div className="row nowrap inv-actions">
                <button className="btn small" onClick={() => setEntry({ item: i, kind: "received" })}>
                  {t(k("stock.receive"))}
                </button>
                <button className="btn small" disabled={!i.tracked} onClick={() => setEntry({ item: i, kind: "wastage" })}>
                  {t(k("stock.waste"))}
                </button>
                {manage && (
                  <button className="btn small ghost icon" onClick={() => setEntry({ item: i, kind: "counted" })} aria-label={t(k("stock.moreName"), { name: ingredientName(i, locale) })} title={t(k("stock.more"))}>
                    <SlidersHorizontal size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {data && (
        <section className="card">
          <div className="section-title">
            <h2>{t(k("ledger.title"))}</h2>
          </div>
          {!data.ledger.length && <p className="muted" style={{ margin: 0 }}>{t(k("ledger.none"))}</p>}
          <div className="list">
            {data.ledger.map((m) => (
              <div key={m.id} className="row between" data-testid="inv-movement" style={{ fontSize: 14 }}>
                <span style={{ minWidth: 0 }}>
                  <b>{ingredientName(m, locale)}</b> · {t(k(`ledger.kinds.${m.kind}`))}
                  {m.reason && <span className="muted"> · {m.reason}</span>}
                  <div className="muted" style={{ fontSize: 12 }}>{f.dateTime(m.at)}</div>
                </span>
                <span className="num" style={{ textAlign: "right" }}>
                  <b>
                    {m.delta > 0 ? "+" : ""}
                    {q.qty(m.delta, m.unit)}
                  </b>
                  <div className="muted" style={{ fontSize: 12 }}>→ {q.qty(m.onHand, m.unit)}</div>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {manage && data && <IngredientsCard items={data.items} onChange={refresh} />}

      {entry && <EntryModal item={entry.item} kind={entry.kind} manage={manage} onClose={() => setEntry(null)} onDone={async () => (setEntry(null), await refresh())} onLowSaved={refresh} />}
    </div>
  );
}

function EntryModal({ item, kind: initial, manage, onClose, onDone, onLowSaved }: { item: StockItem; kind: EntryKind; manage: boolean; onClose: () => void; onDone: () => Promise<void>; onLowSaved: () => Promise<void> }) {
  const s = useStaff();
  const { t, f, locale } = useI18n();
  const q = useQty();
  const { run, pending } = useAction();
  const [kind, setKind] = useState<EntryKind>(initial);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [cost, setCost] = useState("");
  const [lowAt, setLowAt] = useState(item.lowAt != null ? String(item.lowAt) : "");
  const kinds: EntryKind[] = [...(["received", "wastage"] as const), ...(manage ? (["counted", "adjusted"] as const) : [])].filter((x) => item.tracked || x === "received" || x === "counted");
  const unit = q.unit(item.unit);
  const n = Number(qty);
  const needsReason = kind === "wastage" || kind === "adjusted";
  const ok = qty.trim() !== "" && Number.isFinite(n) && (kind === "adjusted" ? n !== 0 : kind === "counted" ? n >= 0 : n > 0) && (!needsReason || reason.trim().length > 0);
  const label = kind === "counted" ? k("entry.qtyCounted") : kind === "adjusted" ? k("entry.qtyAdjusted") : k("entry.qty");
  const save = () =>
    run(async () => {
      await api(`/api/m/branches/${s.branchId}/inventory`, { body: { ingredientId: item.id, kind, qty: n, ...(needsReason ? { reason } : {}), ...(kind === "received" && cost !== "" ? { cost: Math.round(Number(cost)) } : {}) } });
      await onDone();
    }, t(k("entry.saved")));
  return (
    <Modal open onClose={onClose} title={t(k("entry.title"), { name: ingredientName(item, locale), branch: s.branch?.name ?? "" })}>
      <div className="col" data-testid="inv-entry">
        <p className="muted" style={{ margin: 0 }}>{item.tracked ? t(k("entry.now"), { qty: q.qty(item.onHand!, item.unit) }) : t(k("entry.untracked"))}</p>
        <div className="segmented" role="group" aria-label={t(k("stock.title"))} style={{ alignSelf: "flex-start", flexWrap: "wrap" }}>
          {kinds.map((x) => (
            <button key={x} type="button" aria-pressed={kind === x} className={kind === x ? "active" : ""} onClick={() => setKind(x)}>
              {t(k(`entry.kinds.${x}`))}
            </button>
          ))}
        </div>
        <form className="col" onSubmit={(e) => (e.preventDefault(), ok && save())}>
          <label>
            {t(label, { unit })}
            <input type="number" inputMode="decimal" step="any" min={kind === "adjusted" ? undefined : 0} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus data-testid="inv-qty" />
          </label>
          {needsReason && (
            <label>
              {t(k("entry.reason"))}
              <input value={reason} maxLength={120} placeholder={t(k("entry.reasonHint"))} onChange={(e) => setReason(e.target.value)} data-testid="inv-reason" />
            </label>
          )}
          {kind === "received" && (
            <label>
              {t(k("entry.cost"))}
              <input type="number" inputMode="numeric" min={0} value={cost} onChange={(e) => setCost(e.target.value)} />
              {cost !== "" && <span className="hint">{f.money(Math.round(Number(cost) || 0), s.tenant?.currency ?? "MYR")}</span>}
            </label>
          )}
          <div className="row end">
            <button className="btn primary" disabled={pending || !ok} data-testid="inv-save">
              {t(k("entry.save"))}
            </button>
          </div>
        </form>
        {manage && item.tracked && (
          <form
            className="col tight"
            style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}
            onSubmit={(e) => (e.preventDefault(), run(async () => (await api(`/api/m/branches/${s.branchId}/inventory/stock/${item.id}`, { method: "PATCH", body: { lowAt: Number(lowAt) } }), await onLowSaved()), t(k("entry.lowSaved"))))}
          >
            <label>
              {t(k("entry.lowMark"), { unit })}
              <span className="row nowrap">
                <input type="number" inputMode="decimal" step="any" min={0} value={lowAt} onChange={(e) => setLowAt(e.target.value)} data-testid="inv-low-mark" />
                <button className="btn" disabled={pending || lowAt === "" || Number(lowAt) < 0} data-testid="inv-low-save">
                  {t(k("entry.saveLow"))}
                </button>
              </span>
              <span className="hint">{t(k("entry.lowMarkHint"))}</span>
            </label>
          </form>
        )}
      </div>
    </Modal>
  );
}

const blank = { name: "", nameZh: "", unit: "g" as Unit, cost: "" };

function IngredientsCard({ items, onChange }: { items: StockItem[]; onChange: () => Promise<void> }) {
  const s = useStaff();
  const { t, f, locale } = useI18n();
  const q = useQty();
  const { run, pending } = useAction();
  const [editing, setEditing] = useState<string | null>(null);
  const cur = s.tenant?.currency ?? "MYR";
  const body = (d: typeof blank) => ({ name: d.name, nameZh: d.nameZh, unit: d.unit, cost: d.cost === "" ? null : Math.round(Number(d.cost)) });
  return (
    <section className="card col" data-testid="inv-ingredients">
      <div>
        <h2 style={{ margin: 0 }}>{t(k("ingredients.title"))}</h2>
        <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
          {t(k("ingredients.lead"))}
        </p>
      </div>
      {items.length > 0 && (
        <div className="cf-list">
          {items.map((i) =>
            editing === i.id ? (
              <IngredientForm
                key={i.id}
                initial={{ name: i.name, nameZh: i.nameZh, unit: i.unit, cost: i.cost == null ? "" : String(i.cost) }}
                submit={t(k("ingredients.save"))}
                pending={pending}
                onCancel={() => setEditing(null)}
                onSubmit={(d) => run(async () => (await api(`/api/m/inventory/ingredients/${i.id}`, { method: "PATCH", body: body(d) }), setEditing(null), await onChange(), true), t(k("ingredients.saved")))}
              />
            ) : (
              <div key={i.id} className="cf-row" data-testid="ingredient-row">
                <div style={{ minWidth: 0 }}>
                  <b>{i.name}</b> {i.nameZh && <span className="muted">{i.nameZh}</span>}
                  <div className="muted cf-meta">
                    {q.unit(i.unit)}
                    {i.cost != null && ` · ${t(k("ingredients.perUnit"), { cost: f.money(i.cost, cur), unit: q.unit(i.unit) })}`}
                  </div>
                </div>
                <span className="row nowrap">
                  <button type="button" className="btn small ghost icon" disabled={pending} onClick={() => setEditing(i.id)} aria-label={t(k("ingredients.editName"), { name: ingredientName(i, locale) })}>
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    className="btn small ghost icon danger"
                    disabled={pending}
                    onClick={() => confirm(t(k("ingredients.removeConfirm"), { name: i.name })) && run(async () => (await api(`/api/m/inventory/ingredients/${i.id}`, { method: "DELETE" }), await onChange()), t(k("ingredients.removed")))}
                    aria-label={t(k("ingredients.removeName"), { name: ingredientName(i, locale) })}
                  >
                    <Trash2 size={15} />
                  </button>
                </span>
              </div>
            ),
          )}
        </div>
      )}
      <IngredientForm initial={blank} submit={t(k("ingredients.add"))} pending={pending} onSubmit={(d) => run(async () => (await api("/api/m/inventory/ingredients", { body: body(d) }), await onChange(), true), t(k("ingredients.added")))} />
    </section>
  );
}

/** An ingredient's fields. The add form clears itself once the ingredient is added. */
function IngredientForm({ initial, submit, pending, onSubmit, onCancel }: { initial: typeof blank; submit: string; pending: boolean; onSubmit: (d: typeof blank) => Promise<boolean | undefined>; onCancel?: () => void }) {
  const { t } = useI18n();
  const q = useQty();
  const [d, setD] = useState(initial);
  const set = (p: Partial<typeof blank>) => setD({ ...d, ...p });
  return (
    <form className="col" style={{ padding: "8px 0" }} onSubmit={async (e) => (e.preventDefault(), d.name.trim() && (await onSubmit(d)) && !onCancel && setD(blank))} data-testid="ingredient-form">
      <div className="cf-form two">
        <label>
          {t(k("ingredients.name"))}
          <input value={d.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} data-testid="ingredient-name" />
        </label>
        <label>
          {t(k("ingredients.nameZh"))}
          <input value={d.nameZh} maxLength={60} onChange={(e) => set({ nameZh: e.target.value })} />
        </label>
        <label>
          {t(k("ingredients.unit"))}
          <select value={d.unit} onChange={(e) => set({ unit: e.target.value as Unit })} data-testid="ingredient-unit">
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {q.unit(u)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t(k("ingredients.cost"))}
          <input type="number" inputMode="numeric" min={0} value={d.cost} onChange={(e) => set({ cost: e.target.value })} />
        </label>
      </div>
      <div className="row end">
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            {t(k("ingredients.cancel"))}
          </button>
        )}
        <button className="btn primary" disabled={pending || !d.name.trim()} data-testid="ingredient-submit">
          {!onCancel && <Plus size={16} />} {submit}
        </button>
      </div>
    </form>
  );
}
