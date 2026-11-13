// /hybrid: "Can I eat this?" The guest assistant's menu brain and the hybrid avoid reader side by
// side, all in this browser. A guest's message is read by the rules, and by a model (Gemini Nano on
// this device when Chrome has it, a cloud model through Firebase AI Logic when it doesn't) for what
// they can't eat; the model's reading is only ever added to the rules'. Each answer is shown with and
// without it. Below, the a1 test (bench/avoid/): 400-odd guest messages written blind, scored here.
import { useEffect, useMemo, useState } from "react";
import { Cpu, Cloud, ShieldAlert, Play, Download } from "lucide-react";
import { GuestBar } from "../../src/ui/guest";
import { answerGuest } from "../../src/server/ai/brain";
import { understand } from "../../src/server/ai/brain/understand";
import { contextAt, DEMO_MENUS } from "../../src/server/ai/demoMenus";
import { hintItems, type AvoidHint, type HintSource } from "../../src/shared/brain/avoidHint";
import { mark, tally, type AvoidCase, type AvoidMark } from "../../src/shared/brain/avoidScore";
import { deviceModelStatus, prepareDevice, readAvoid, readerEnabled, type ReaderMode } from "../../src/ui/hybrid";

const rm = (minor: number) => `RM${(minor / 100).toFixed(2)}`;
const LUNCH = { weekday: 3, minutes: 12 * 60 + 30, date: "2026-10-21" };
const EXAMPLES = [
  "doctor says no ocean stuff for me, what's good for lunch?",
  "my wife reacts badly to anything with a shell, what can she have?",
  "saya tak boleh sentuh benda bersusu, apa yang ok?",
  "我老婆碰到带壳的海产就不行，推荐什么？",
  "We're Hindu, no cow please. What do you suggest?",
  "i don't do dairy or eggs, what's good?",
];
const LABEL: Record<string, string> = { "allergen:tree_nuts": "tree nuts", alcohol: "no alcohol" };
const label = (x: string) => LABEL[x] ?? (x.startsWith("meat:") ? `no ${x.slice(5)}` : x.split(":")[1]);

/** What the rules alone read as avoided in `text`, as flat items. */
function rulesRead(items: unknown[], text: string): string[] {
  const u = understand(items as never, text);
  return hintItems({ allergens: u.stated, diets: u.statedDiet, meats: u.noMeat, alcohol: u.noAlcohol });
}

export default function Hybrid() {
  const menu = DEMO_MENUS[0];
  const ctx = useMemo(() => contextAt(menu, LUNCH as never), [menu]);
  const [status, setStatus] = useState("…");
  const [progress, setProgress] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<null | { q: string; rules: ReturnType<typeof answerGuest>; hybrid: ReturnType<typeof answerGuest> | null; read: { hint: AvoidHint; source: HintSource; ms: number } | null }>(null);
  useEffect(() => void deviceModelStatus().then(setStatus), []);
  const enabled = readerEnabled();

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text || busy) return;
    setBusy(true);
    setDraft(text);
    const rules = answerGuest(ctx, [{ role: "user", content: text }]);
    setShown({ q: text, rules, hybrid: null, read: null });
    const read = await readAvoid(text);
    const hybrid = read ? answerGuest(ctx, [{ role: "user", content: text, hint: read.hint }]) : null;
    setShown({ q: text, rules, hybrid, read });
    setBusy(false);
  };

  return (
    <>
      <GuestBar>Can I eat this?</GuestBar>
      <main className="narrow col" style={{ gap: 18 }}>
        <section>
          <h1 style={{ marginBottom: 6 }}>Can I eat this?</h1>
          <p className="muted" style={{ margin: 0 }}>
            Tell a restaurant what you can't eat, in your own words: English, Malay, Manglish or Chinese. Beautifood's menu rules read it, and so does a small AI model, <b>on this device</b> when Chrome has Gemini Nano, or in the cloud when it doesn't, both through Firebase AI Logic. The model can only <b>add</b> to what the rules read, never take anything away, so it can make an answer more careful but never less safe. On a restaurant's own kiosk or host stand, your allergy never leaves the device.
          </p>
        </section>

        <section className="card col" style={{ gap: 8 }} data-testid="hybrid-status">
          <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Cpu size={16} />
            <b>On this device:</b>
            <span data-testid="device-status">{status === "none" ? "no Prompt API in this browser (cloud will answer)" : status === "available" ? "Gemini Nano is ready" : status === "unavailable" ? "Gemini Nano isn't available here (cloud will answer)" : `Gemini Nano is ${status}`}</span>
            {enabled && (status === "downloadable" || status === "downloading") ? (
              <button className="btn" onClick={() => void prepareDevice((p) => setProgress(p)).then(() => deviceModelStatus().then(setStatus))}>
                Get it ready{progress !== null ? ` (${Math.round(progress * 100)}%)` : ""}
              </button>
            ) : null}
          </div>
          {!enabled ? <div className="hint">The AI reader is switched off on this site until App Check is set up; the rules still answer.</div> : null}
          <div className="hint">On-device needs desktop Chrome 139+ with chrome://flags/#prompt-api-for-gemini-nano-multimodal-input enabled. Phones and other browsers use the cloud model.</div>
        </section>

        <section className="col" style={{ gap: 10 }}>
          <h2 style={{ margin: 0 }}>Ask {menu.name}</h2>
          <div className="chips" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {EXAMPLES.map((q) => (
              <button key={q} className="chip" onClick={() => void ask(q)} disabled={busy} data-testid="hybrid-example">
                {q}
              </button>
            ))}
          </div>
          <form className="row" style={{ gap: 8 }} onSubmit={(e) => (e.preventDefault(), void ask(draft))}>
            <input className="grow" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="What can't you eat? Ask in your own words" aria-label="Your message" />
            <button className="btn primary" disabled={busy || !draft.trim()}>Ask</button>
          </form>
          {shown ? <Compare {...shown} busy={busy} items={ctx.items} /> : null}
        </section>

        <A1Test items={ctx.items} enabled={enabled} />
      </main>
    </>
  );
}

function Answer({ title, icon, r, testid }: { title: string; icon: React.ReactNode; r: ReturnType<typeof answerGuest>; testid: string }) {
  return (
    <div className="card col" style={{ gap: 6, flex: "1 1 280px" }} data-testid={testid}>
      <div className="row" style={{ gap: 6, alignItems: "center" }}>
        {icon} <b>{title}</b>
      </div>
      <div style={{ whiteSpace: "pre-wrap" }}>{r.answer}</div>
      {r.items.length ? (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {r.items.map((i) => (
            <li key={i.id}>
              {i.name} <span className="muted">{rm(i.price)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Compare({ q, rules, hybrid, read, busy, items }: { q: string; rules: ReturnType<typeof answerGuest>; hybrid: ReturnType<typeof answerGuest> | null; read: { hint: AvoidHint; source: HintSource; ms: number } | null; busy: boolean; items: unknown[] }) {
  const byRules = rulesRead(items, q);
  const byModel = read ? hintItems(read.hint) : [];
  const added = byModel.filter((x) => !byRules.includes(x));
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="card col" style={{ gap: 4 }} data-testid="hybrid-readings">
        <div>
          <b>Rules read:</b> {byRules.length ? byRules.map(label).join(", ") : "nothing to avoid"}
        </div>
        <div>
          <b>Model read:</b>{" "}
          {busy && !read ? "reading…" : read ? (
            <>
              {byModel.length ? byModel.map(label).join(", ") : "nothing to avoid"}{" "}
              <span className="badge" data-testid="hybrid-source">
                {read.source === "on_device" ? <Cpu size={12} /> : <Cloud size={12} />} {read.source === "on_device" ? "on this device" : "in the cloud"} · {read.ms} ms
              </span>
            </>
          ) : (
            "not available here"
          )}
        </div>
        {added.length ? (
          <div className="alert sun" style={{ fontSize: 13, padding: "6px 10px" }} data-testid="hybrid-added">
            <ShieldAlert size={14} /> The model caught what the rules missed: {added.map(label).join(", ")}
          </div>
        ) : null}
      </div>
      <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "stretch" }}>
        <Answer title="Rules alone" icon={null} r={rules} testid="hybrid-answer-rules" />
        {hybrid ? <Answer title={`Rules + ${read?.source === "on_device" ? "on-device" : "cloud"} reader`} icon={<ShieldAlert size={14} />} r={hybrid} testid="hybrid-answer-hybrid" /> : null}
      </div>
    </div>
  );
}

const LANGS = ["en", "ms", "manglish", "zh"] as const;

/** The a1 test, run here: each message read by the rules and by the model in the chosen mode, scored against its gold. */
function A1Test({ items, enabled }: { items: unknown[]; enabled: boolean }) {
  const [sets, setSets] = useState<Record<string, AvoidCase[]>>({});
  const [which, setWhich] = useState<"a1" | "dev">("a1");
  const [mode, setMode] = useState<ReaderMode>("only_on_device");
  const [rows, setRows] = useState<{ c: AvoidCase; rules: string[]; model: string[] | null; source?: HintSource; ms?: number }[]>([]);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    for (const name of ["a1", "dev"])
      fetch(`/hybrid/${name}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .then((x) => Array.isArray(x) && setSets((s) => ({ ...s, [name]: x })))
        .catch(() => {});
  }, []);
  const cases = sets[which] ?? sets.dev;
  if (!cases) return null;

  const run = async () => {
    setRunning(true);
    const out: typeof rows = [];
    for (const c of cases) {
      const read = enabled ? await readAvoid(c.text, mode, 20000) : null;
      out.push({ c, rules: rulesRead(items, c.text), model: read ? hintItems(read.hint) : null, source: read?.source, ms: read?.ms });
      if (out.length % 10 === 0 || out.length === cases.length) setRows([...out]);
    }
    setRunning(false);
  };
  const score = (pick: (r: (typeof rows)[number]) => string[], subset = rows) => tally(subset.map((r) => r.c), subset.map((r): AvoidMark => mark(r.c, pick(r))));
  const union = (r: (typeof rows)[number]) => [...new Set([...r.rules, ...(r.model ?? [])])];
  const read = rows.filter((r) => r.model);
  const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : "–");
  const table = (name: string, pick: (r: (typeof rows)[number]) => string[]) => {
    const all = score(pick);
    return (
      <tr key={name}>
        <td>{name}</td>
        <td>{pct(all.missed, all.stating)}</td>
        <td>{pct(all.falseAlarms, all.none)}</td>
        {LANGS.map((l) => {
          const t = score(pick, rows.filter((r) => r.c.lang === l));
          return <td key={l}>{pct(t.missed, t.stating)}</td>;
        })}
      </tr>
    );
  };
  const download = () => {
    const blob = new Blob([JSON.stringify({ set: which, mode, at: new Date().toISOString(), rows: rows.map((r) => ({ id: r.c.id, rules: r.rules, model: r.model, source: r.source, ms: r.ms })) })], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${which}-${mode}.json`;
    a.click();
  };
  const onDevice = read.filter((r) => r.source === "on_device").length;
  const ms = read.length ? Math.round(read.reduce((n, r) => n + (r.ms ?? 0), 0) / read.length) : 0;

  return (
    <section className="col" style={{ gap: 10 }} data-testid="a1-test">
      <h2 style={{ margin: 0 }}>{sets[which] && which === "a1" ? `The test: ${cases.length} messages, written blind` : `Try it on ${cases.length} examples`}</h2>
      <p className="muted" style={{ margin: 0 }}>
        {which === "a1" && sets.a1
          ? "Two authors who never saw this app or its prompt wrote these guest messages, a third checked every label, and the set was frozen before it was first scored. Run it here to see what the rules miss and what the model adds."
          : "Our own examples, used while writing the prompt. The blind test is the one that counts."}
      </p>
      <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {sets.a1 && sets.dev ? (
          <select value={which} onChange={(e) => (setWhich(e.target.value as "a1" | "dev"), setRows([]))} aria-label="Which messages">
            <option value="a1">The blind test (a1)</option>
            <option value="dev">Our own examples (dev)</option>
          </select>
        ) : null}
        <select value={mode} onChange={(e) => setMode(e.target.value as ReaderMode)} aria-label="Where the model runs">
          <option value="only_on_device">On this device only</option>
          <option value="only_in_cloud">In the cloud only</option>
          <option value="prefer_on_device">On device, cloud when it can't</option>
        </select>
        <button className="btn primary" onClick={() => void run()} disabled={running}>
          <Play size={14} /> {running ? `Running… ${rows.length}/${cases.length}` : "Run the test"}
        </button>
        {rows.length && !running ? (
          <button className="btn" onClick={download}>
            <Download size={14} /> Results
          </button>
        ) : null}
      </div>
      {rows.length ? (
        <>
          <div className="hint">
            {read.length} of {rows.length} read by the model ({onDevice} on this device, {read.length - onDevice} in the cloud), {ms} ms each on average.
          </div>
          <table className="table" data-testid="a1-table">
            <thead>
              <tr>
                <th></th>
                <th>Missed</th>
                <th>False alarms</th>
                {LANGS.map((l) => (
                  <th key={l}>Missed ({l})</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table("Rules alone", (r) => r.rules)}
              {table("Rules + model", union)}
              {table("Model alone", (r) => r.model ?? [])}
            </tbody>
          </table>
        </>
      ) : null}
    </section>
  );
}
