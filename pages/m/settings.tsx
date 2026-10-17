// Branch settings: queue size classes, seating strategy, QR mode, rates, modules, bookings; loyalty program.
import { useEffect, useState } from "react";
import { api } from "../../src/ui/api";
import { useStaff } from "../../src/ui/staff";
import { useAction } from "../../src/ui/components";
import type { BranchConfig } from "../../src/shared/types";

const STRATEGIES: Record<string, string> = {
  smart: "Smart — balances wait time, seat fit, merges/splits and upcoming bookings, with a fairness cap",
  best_fit: "Best fit — fewest empty seats first",
  category_fifo: "First come, first served within each party size",
  fifo: "Strict first come, first served",
};

export default function Settings() {
  const s = useStaff();
  const { run, pending } = useAction();
  const [c, setC] = useState<BranchConfig | null>(null);
  const [newBranch, setNewBranch] = useState("");
  useEffect(() => setC(s.branch?.config ?? null), [s.branch]);
  if (!c) return null;
  const set = (p: Partial<BranchConfig>) => setC({ ...c, ...p });
  const save = () =>
    run(async () => {
      await api(`/api/m/branches/${s.branchId}/settings`, {
        method: "PATCH",
        body: { categories: c.categories, strategy: c.strategy, maxSkips: c.maxSkips, qrMode: c.qrMode, staticQrSelfSeat: c.staticQrSelfSeat, serviceChargePct: c.serviceChargePct, taxPct: c.taxPct, taxInclusive: c.taxInclusive, cashRounding: c.cashRounding, maxWaiting: c.maxWaiting, holdCalledMinutes: c.holdCalledMinutes, autoCloseOnPay: c.autoCloseOnPay, preorderFire: c.preorderFire, booking: c.booking, modules: c.modules },
      });
      await api("/api/m/tenant", { method: "PATCH", body: { onboarding: { queueReviewed: true } } });
      await s.reload();
    }, "Settings saved");
  return (
    <div className="col" style={{ maxWidth: 900 }}>
      <h1>Settings · {s.branch?.name}</h1>
      <section className="card col">
        <h2>Queue size classes</h2>
        <p className="muted">Each class gets its own ticket prefix and line (e.g. A012 for 1–2 people).</p>
        {c.categories.map((cat, i) => (
          <div key={i} className="row">
            <input value={cat.label} onChange={(e) => set({ categories: c.categories.map((x, n) => (n === i ? { ...x, label: e.target.value } : x)) })} style={{ width: 120 }} aria-label="Label" />
            <input value={cat.code} onChange={(e) => set({ categories: c.categories.map((x, n) => (n === i ? { ...x, code: e.target.value } : x)) })} style={{ width: 60 }} aria-label="Code" />
            <span className="muted">prefix</span>
            <input value={cat.prefix} onChange={(e) => set({ categories: c.categories.map((x, n) => (n === i ? { ...x, prefix: e.target.value } : x)) })} style={{ width: 50 }} aria-label="Prefix" />
            <span className="muted">from</span>
            <input type="number" value={cat.min} onChange={(e) => set({ categories: c.categories.map((x, n) => (n === i ? { ...x, min: Number(e.target.value) } : x)) })} style={{ width: 64 }} aria-label="Min" />
            <span className="muted">to</span>
            <input type="number" value={cat.max} onChange={(e) => set({ categories: c.categories.map((x, n) => (n === i ? { ...x, max: Number(e.target.value) } : x)) })} style={{ width: 64 }} aria-label="Max" />
            <button className="btn small ghost" onClick={() => set({ categories: c.categories.filter((_, n) => n !== i) })} aria-label="Remove class">
              ✕
            </button>
          </div>
        ))}
        <button className="btn small" onClick={() => set({ categories: [...c.categories, { code: "X", label: "New", prefix: "E", min: 31, max: 40 }] })}>
          + Class
        </button>
      </section>
      <section className="card col">
        <h2>Seating</h2>
        {Object.entries(STRATEGIES).map(([k, v]) => (
          <label key={k} className="inline">
            <input type="radio" name="strategy" checked={c.strategy === k} onChange={() => set({ strategy: k as BranchConfig["strategy"] })} /> {v}
          </label>
        ))}
        <div className="row">
          <label>
            Max times a party can be skipped
            <input type="number" min={0} value={c.maxSkips} onChange={(e) => set({ maxSkips: Number(e.target.value) })} />
          </label>
          <label>
            Hold a called table (min)
            <input type="number" min={1} value={c.holdCalledMinutes} onChange={(e) => set({ holdCalledMinutes: Number(e.target.value) })} />
          </label>
          <label>
            Max waiting parties
            <input type="number" min={1} value={c.maxWaiting} onChange={(e) => set({ maxWaiting: Number(e.target.value) })} />
          </label>
        </div>
      </section>
      <section className="card col">
        <h2>Table QR ordering</h2>
        <label className="inline">
          <input type="radio" checked={c.qrMode === "both"} onChange={() => set({ qrMode: "both" })} /> Both: printed QR joins a seated table; host can also show a per-table code
        </label>
        <label className="inline">
          <input type="radio" checked={c.qrMode === "static"} onChange={() => set({ qrMode: "static" })} /> Static printed QR only
        </label>
        <label className="inline">
          <input type="radio" checked={c.qrMode === "dynamic"} onChange={() => set({ qrMode: "dynamic" })} /> Dynamic only (code issued per seating, expires when the table closes)
        </label>
        <label className="inline">
          <input type="checkbox" checked={c.staticQrSelfSeat} onChange={(e) => set({ staticQrSelfSeat: e.target.checked })} /> Let walk-ins seat themselves by scanning a free table
        </label>
        <label className="inline">
          Preorders go to the kitchen
          <select value={c.preorderFire} onChange={(e) => set({ preorderFire: e.target.value as BranchConfig["preorderFire"] })} style={{ width: "auto" }}>
            <option value="on_seat">when the party is seated</option>
            <option value="on_call">when their number is called</option>
          </select>
        </label>
      </section>
      <section className="card col">
        <h2>Bill</h2>
        <div className="row">
          <label>
            Service charge %
            <input type="number" step="0.5" value={c.serviceChargePct} onChange={(e) => set({ serviceChargePct: Number(e.target.value) })} />
          </label>
          <label>
            Tax %
            <input type="number" step="0.5" value={c.taxPct} onChange={(e) => set({ taxPct: Number(e.target.value) })} />
          </label>
          <label>
            Cash rounding (cents)
            <input type="number" value={c.cashRounding} onChange={(e) => set({ cashRounding: Number(e.target.value) })} />
          </label>
        </div>
        <label className="inline">
          <input type="checkbox" checked={c.taxInclusive} onChange={(e) => set({ taxInclusive: e.target.checked })} /> Menu prices include tax
        </label>
        <label className="inline">
          <input type="checkbox" checked={c.autoCloseOnPay} onChange={(e) => set({ autoCloseOnPay: e.target.checked })} /> Free the table automatically when the bill is paid
        </label>
      </section>
      <section className="card col">
        <h2>Modules</h2>
        <div className="grid tight">
          {Object.entries(c.modules).map(([k, v]) => (
            <label key={k} className="inline">
              <input type="checkbox" checked={v} onChange={(e) => set({ modules: { ...c.modules, [k]: e.target.checked } })} /> {k.replace(/([A-Z])/g, " $1").toLowerCase()}
            </label>
          ))}
        </div>
        <div className="row">
          <label>
            Bookings open
            <input type="number" min={0} max={23} value={c.booking.openHour} onChange={(e) => set({ booking: { ...c.booking, openHour: Number(e.target.value) } })} />
          </label>
          <label>
            close
            <input type="number" min={1} max={24} value={c.booking.closeHour} onChange={(e) => set({ booking: { ...c.booking, closeHour: Number(e.target.value) } })} />
          </label>
          <label>
            Slot (min)
            <input type="number" value={c.booking.slotMinutes} onChange={(e) => set({ booking: { ...c.booking, slotMinutes: Number(e.target.value) } })} />
          </label>
          <label>
            Booking length (min)
            <input type="number" value={c.booking.durationMinutes} onChange={(e) => set({ booking: { ...c.booking, durationMinutes: Number(e.target.value) } })} />
          </label>
        </div>
      </section>
      <div className="row">
        <button className="btn primary big" onClick={save} disabled={pending}>
          Save settings
        </button>
      </div>
      {s.can("branch.manage") && (
        <section className="card row">
          <input value={newBranch} onChange={(e) => setNewBranch(e.target.value)} placeholder="New branch name" style={{ maxWidth: 260 }} aria-label="New branch name" />
          <button className="btn" disabled={!newBranch} onClick={() => run(async () => (await api("/api/m/branches", { body: { name: newBranch } }), setNewBranch(""), await s.reload()), "Branch added")}>
            Add branch
          </button>
        </section>
      )}
    </div>
  );
}
