// AI onboarding copilot: create the restaurant, then paste "about us + menu + floor"
// and review a generated menu (allergens, stories, signatures) and floor plan.
import { useState } from "react";
import { api } from "../../src/ui/api";
import { useStaff } from "../../src/ui/staff";
import { Allergens, Money, useAction } from "../../src/ui/components";
import { ALLERGENS, ALLERGEN_LABELS } from "../../src/shared/allergens";

interface Draft {
  engine: string;
  cuisine: string;
  story: string;
  items: { category: string; name: string; price: number; description?: string; story?: string; allergens?: string[]; dietary?: string[]; spiceLevel?: number; isSignature?: boolean; station?: string }[];
  tables: { label: string; zone?: string; seatsMin: number; seatsMax: number; mergeGroup?: string | null; splitConfig?: { suffix: string; seats: number }[] | null }[];
  warnings: string[];
  suggestions: string[];
}

const EXAMPLE = {
  about: "We're a family-run Penang hawker café (since 1998). Charcoal-fired wok-hei, coconut milk squeezed fresh every morning.",
  menu: "NOODLES\n★ Char Kway Teow - RM16.90 - wok-fried flat rice noodles with prawns, egg, soy sauce\nAssam Laksa - RM15.50 - tamarind fish broth, chilli, mint\n\nRICE\nNasi Lemak - RM14.90 - coconut rice, sambal, peanuts, anchovies, egg\n\nDRINKS\nTeh Tarik - RM5.50\nLime Juice - RM6.00",
  floor: "8 two-seaters, 4 tables of 4 in the patio that can be pushed together, 1 round table of 10 that can split into 6 and 4",
};

export default function Setup() {
  const s = useStaff();
  const { run, pending } = useAction();
  const [create, setCreate] = useState({ name: "", cuisine: "", branchName: "Main", address: "", currency: "MYR", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kuala_Lumpur" });
  const [about, setAbout] = useState("");
  const [menu, setMenu] = useState("");
  const [floor, setFloor] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (!s.tenant)
    return (
      <form
        className="card col"
        style={{ maxWidth: 560 }}
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await api("/api/m/tenants", { body: create });
            location.reload();
          });
        }}
      >
        <h1>Set up your restaurant</h1>
        <p className="muted">Two minutes. Then paste your menu and our AI builds the rest.</p>
        <label>
          Restaurant name
          <input value={create.name} onChange={(e) => setCreate({ ...create, name: e.target.value })} required />
        </label>
        <label>
          Cuisine
          <input value={create.cuisine} onChange={(e) => setCreate({ ...create, cuisine: e.target.value })} placeholder="Malaysian, Japanese, café…" />
        </label>
        <div className="row">
          <label style={{ flex: 1 }}>
            First branch
            <input value={create.branchName} onChange={(e) => setCreate({ ...create, branchName: e.target.value })} required />
          </label>
          <label style={{ flex: 1 }}>
            Currency
            <select value={create.currency} onChange={(e) => setCreate({ ...create, currency: e.target.value })}>
              {["MYR", "SGD", "USD", "EUR", "GBP", "AUD", "IDR", "THB"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Address
          <input value={create.address} onChange={(e) => setCreate({ ...create, address: e.target.value })} />
        </label>
        <label>
          Timezone
          <input value={create.timezone} onChange={(e) => setCreate({ ...create, timezone: e.target.value })} />
        </label>
        <button className="btn primary" disabled={pending}>
          Create restaurant
        </button>
      </form>
    );

  const generate = () => run(async () => setDraft(await api<Draft>("/api/m/ai/onboarding", { body: { about, menuText: menu, floorText: floor } })));
  const apply = () =>
    run(async () => {
      const r = await api<{ applied: { menu?: { items: number }; tables?: number }; status: { progress: number } }>("/api/m/ai/onboarding", {
        method: "PUT",
        body: { branchId: s.branchId, cuisine: draft!.cuisine || undefined, story: draft!.story || undefined, items: draft!.items, tables: draft!.tables, replaceMenu: true, replaceTables: true },
      });
      setDone(`Applied ${r.applied.menu?.items ?? 0} dishes and ${r.applied.tables ?? 0} tables. Setup is ${r.status.progress}% done.`);
      setDraft(null);
    }, "Saved!");
  const patchItem = (i: number, p: Partial<Draft["items"][number]>) => setDraft({ ...draft!, items: draft!.items.map((x, n) => (n === i ? { ...x, ...p } : x)) });

  return (
    <div className="col">
      <h1>✨ AI setup</h1>
      <p className="muted">Paste whatever you have — a menu from your website, a WhatsApp message, a description of your floor. We'll turn it into a menu with allergens, dish stories and signatures, plus a floor plan. You review everything before it goes live.</p>
      {done && (
        <div className="card" style={{ borderColor: "var(--ok)" }} data-testid="setup-done">
          ✅ {done} <a href="/m">Back to dashboard</a>
        </div>
      )}
      {!draft && (
        <section className="card col">
          <div className="row between">
            <h2 style={{ margin: 0 }}>Tell us about {s.tenant.name}</h2>
            <button className="btn small" onClick={() => (setAbout(EXAMPLE.about), setMenu(EXAMPLE.menu), setFloor(EXAMPLE.floor))}>
              Use an example
            </button>
          </div>
          <label>
            About your restaurant (story, specialities)
            <textarea value={about} onChange={(e) => setAbout(e.target.value)} />
          </label>
          <label>
            Your menu (any format — one dish per line with a price works best)
            <textarea value={menu} onChange={(e) => setMenu(e.target.value)} style={{ minHeight: 180 }} data-testid="menu-text" />
          </label>
          <label>
            Your tables (e.g. "10 two-seaters, 6 tables of 4 that can be pushed together")
            <textarea value={floor} onChange={(e) => setFloor(e.target.value)} data-testid="floor-text" />
          </label>
          <button className="btn primary big" onClick={generate} disabled={pending || (!menu && !floor && !about)}>
            {pending ? "Working…" : "Generate my setup"}
          </button>
        </section>
      )}
      {draft && (
        <>
          <section className="card" data-testid="draft">
            <div className="row between">
              <h2 style={{ margin: 0 }}>Review your draft</h2>
              <span className="badge">{draft.engine === "claude" ? "Generated by Claude" : "Generated by the built-in parser"}</span>
            </div>
            <ul>
              {draft.suggestions.map((x) => (
                <li key={x}>{x}</li>
              ))}
              {draft.warnings.map((x) => (
                <li key={x} className="muted">
                  {x}
                </li>
              ))}
            </ul>
            {draft.cuisine && <p>Cuisine: <b>{draft.cuisine}</b></p>}
          </section>
          <section className="card">
            <h2>Menu ({draft.items.length})</h2>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Dish</th>
                    <th>Category</th>
                    <th className="num">Price</th>
                    <th>Allergens (tap to toggle)</th>
                    <th>★</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.items.map((it, i) => (
                    <tr key={i} data-testid="draft-item">
                      <td>
                        <input value={it.name} onChange={(e) => patchItem(i, { name: e.target.value })} />
                        {it.story && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{it.story}</div>}
                      </td>
                      <td>{it.category}</td>
                      <td className="num">
                        <Money v={it.price} c={s.tenant!.currency} />
                      </td>
                      <td>
                        <details>
                          <summary>
                            <Allergens list={it.allergens ?? []} />
                            {!it.allergens?.length && <span className="muted">none</span>}
                          </summary>
                          <div className="row" style={{ marginTop: 6 }}>
                            {ALLERGENS.map((a) => (
                              <label key={a} className="inline" style={{ fontSize: 12 }}>
                                <input type="checkbox" checked={it.allergens?.includes(a) ?? false} onChange={(e) => patchItem(i, { allergens: e.target.checked ? [...(it.allergens ?? []), a] : (it.allergens ?? []).filter((x) => x !== a) })} />
                                {ALLERGEN_LABELS[a].split(" (")[0]}
                              </label>
                            ))}
                          </div>
                        </details>
                      </td>
                      <td>
                        <input type="checkbox" checked={!!it.isSignature} onChange={(e) => patchItem(i, { isSignature: e.target.checked })} aria-label={`${it.name} is a signature`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="card">
            <h2>Tables ({draft.tables.length})</h2>
            <div className="row">
              {draft.tables.map((t) => (
                <span key={t.label} className="badge" data-testid="draft-table">
                  {t.label} · {t.seatsMax} seats{t.zone && t.zone !== "Main" ? ` · ${t.zone}` : ""}
                  {t.mergeGroup ? " · joinable" : ""}
                  {t.splitConfig ? ` · splits ${t.splitConfig.map((p) => p.seats).join("+")}` : ""}
                </span>
              ))}
            </div>
          </section>
          <div className="row">
            <button className="btn primary big" onClick={apply} disabled={pending} data-testid="apply-draft">
              Looks good — apply to {s.branch?.name}
            </button>
            <button className="btn" onClick={() => setDraft(null)}>
              Back
            </button>
          </div>
        </>
      )}
    </div>
  );
}
