// On-device AI lab (/lab/on-device): can a guest's own phone or laptop run the menu assistant?
// Internal and unlinked (noindex). Open it on each device you want to know about.
//
// What it measures
// - Capabilities (instant, nothing downloaded): WebGPU adapter, f16 support and buffer limits,
//   device memory, CPU cores, cross-origin isolation (WASM threads), WASM SIMD / exceptions /
//   JSPI / memory64, Chrome's built-in model, storage quota and the network. The verdict says
//   which engines this device can try.
// - One engine at a time, only after a tap on "Download & test", which shows the size first
//   (Wi-Fi recommended above 300 MB; a confirm on cellular or data saver):
//     Transformers.js (WebGPU, or WASM on the CPU), WebLLM (WebGPU), wllama (llama.cpp on the
//     CPU) and Chrome's built-in model. Libraries load from pinned CDN URLs, never the app bundle.
// - Per run: download size and time, load/compile time, whether the weights came from the cache
//   (first visit vs. repeat visit), time to first token, tokens per second, peak JS heap (Chrome
//   only; GPU and WASM memory are not visible to the page), and the error if it failed.
// - Then our guest cases (src/shared/assistantEval.ts), in order, at most 200 tokens each; a
//   case passes on facts only (the dishes the answer names and what they contain). The safety
//   note rule is in src/shared/onDeviceEval.ts: the answer names allergies (allerg… / alergi /
//   过敏), or an allergy case's answer tells the guest to check with staff.
//
// How to read it
// - "Safety failures" in red disqualify a model, whatever the total.
// - Time to first token includes reading the whole menu prompt (~1k tokens) for every question:
//   that is the wait a guest would see. Tokens/s is the writing speed after that.
// - "Copy results" puts everything (device, engine, model, timings, score, answers) on the
//   clipboard as JSON to paste back to us. "Clear downloaded models" frees the space.

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ClipboardCopy, Download, Square, Trash2, Wifi } from "lucide-react";
import { useToast } from "../../src/ui/components";
import { GuestBar } from "../../src/ui/guest";
import { EVAL_CASES, sampleDishes, score, type EvalScore } from "../../src/shared/assistantEval";
import { caseMessages, cleanAnswer, replyFromText } from "../../src/shared/onDeviceEval";
import { answerLocally, guard } from "../../src/server/ai/local";
import { sampleContext } from "../../src/server/ai/evalFixture";
import {
  asyncCapabilities,
  clearModels,
  errText,
  heapSampler,
  LOADERS,
  MODELS,
  sizeFor,
  syncCapabilities,
  TJS_VERSION,
  verdicts,
  WEBLLM_VERSION,
  WLLAMA_VERSION,
  type Backend,
  type Capabilities,
  type Device,
  type Engine,
  type EngineId,
  type LoadReport,
  type ModelChoice,
  type Progress,
} from "../../src/ui/onDevice";

const MAX_TOKENS = 200;
const WIFI_MB = 300;

const ENGINES: { id: EngineId; label: string; sub: string; needs: Backend[] }[] = [
  { id: "transformers", label: "Transformers.js", sub: `v${TJS_VERSION} · WebGPU, or the CPU (WASM)`, needs: ["gpu", "cpu"] },
  { id: "webllm", label: "WebLLM", sub: `v${WEBLLM_VERSION} · WebGPU only`, needs: ["gpu"] },
  { id: "wllama", label: "wllama", sub: `v${WLLAMA_VERSION} · llama.cpp on the CPU (WASM)`, needs: ["cpu"] },
  { id: "chrome", label: "Chrome built-in", sub: "Prompt API (LanguageModel)", needs: ["chrome"] },
];

interface CaseRow {
  question: string;
  kind: string;
  lang: string;
  safety: boolean;
  pass: boolean;
  answer: string;
  dishes: string[];
  safetyNote: string | null;
  ttftMs: number | null;
  tokens: number;
  tokensApprox: boolean;
  tokPerSec: number | null;
  ms: number;
  /** As deployed: who answered (the rules engine first; the model only when it can't), and whether that passes. */
  deployedBy: "engine" | "model" | "engine (guard)";
  deployedPass: boolean;
}

interface Run {
  at: string;
  engine: EngineId;
  library: string;
  device: Device | null;
  model: { choice: string; label: string; expectedMB: number | null };
  load: LoadReport | null;
  /** Whether the weights came from this browser's cache: false on a first visit, true on a repeat. */
  weightsFromCache: boolean | null;
  firstTokenMedianMs: number | null;
  tokensPerSec: number | null;
  totalMs: number;
  peakJsHeapMB: number | null;
  stopped: boolean;
  error: string | null;
  /** The tab was killed mid-run (found after the reload). */
  crashed?: boolean;
  score: Pick<EvalScore, "passed" | "total" | "unsafe"> | null;
  /** The assistant as guests would get it: rules engine first, this model for the rest, the allergen guard. */
  deployedScore?: Pick<EvalScore, "passed" | "total" | "unsafe"> | null;
  cases: CaseRow[];
}

const ms = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v < 1000 ? `${Math.round(v)} ms` : `${(v / 1000).toFixed(1)} s`);
const mb = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v >= 1000 ? `${(v / 1000).toFixed(2)} GB` : `${Math.round(v)} MB`);
const yn = (v: boolean | null | undefined) => (v === null || v === undefined ? "—" : v ? "yes" : "no");
const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null);

function summarize(rows: CaseRow[]) {
  const decode = rows.filter((r) => r.ttftMs !== null && r.tokens > 1 && r.ms > r.ttftMs);
  const secs = decode.reduce((s, r) => s + (r.ms - r.ttftMs!) / 1000, 0);
  return {
    firstTokenMedianMs: median(rows.flatMap((r) => (r.ttftMs === null ? [] : [r.ttftMs]))),
    tokensPerSec: secs > 0 ? +(decode.reduce((s, r) => s + r.tokens - 1, 0) / secs).toFixed(1) : null,
  };
}

// A tab the browser kills (iPhone Safari does when memory runs out) can't report anything, so each
// step is written down first: after a crash the page says where the last run stopped. Finished runs
// are kept too, so a crash doesn't lose the ones before it.
const LAST = "bf-lab-last-run";
const RUNS = "bf-lab-runs";
const store = {
  get: <T,>(k: string): T | null => {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  },
  set: (k: string, v: unknown) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* private mode or full: nothing to keep */
    }
  },
  drop: (k: string) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* nothing to drop */
    }
  },
};

interface Breadcrumb {
  run: Run;
  stage: string;
  at: string;
}

export default function OnDeviceLab() {
  const toast = useToast();
  const dishes = useMemo(() => sampleDishes(), []);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [probing, setProbing] = useState(true);
  const [engine, setEngine] = useState<EngineId>("transformers");
  const [device, setDevice] = useState<Device>("webgpu");
  const [pick, setPick] = useState<Record<EngineId, number>>({ transformers: 0, webllm: 0, wllama: 0, chrome: 0 });
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [live, setLive] = useState<Run | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const abort = useRef<AbortController | null>(null);
  const [crashed, setCrashed] = useState<Breadcrumb | null>(null);

  // a run that never finished: the tab was killed while it ran
  useEffect(() => {
    const kept = store.get<Run[]>(RUNS) ?? [];
    const last = store.get<Breadcrumb>(LAST);
    store.drop(LAST);
    if (last) {
      const lost: Run = { ...last.run, error: `The browser closed the page during: ${last.stage} (most likely it ran out of memory)`, crashed: true };
      kept.push(lost);
      store.set(RUNS, kept);
      setCrashed(last);
    }
    setRuns(kept);
  }, []);

  useEffect(() => {
    const base = syncCapabilities();
    setCaps(base);
    let alive = true;
    asyncCapabilities(base)
      .then((c) => {
        if (!alive) return;
        setCaps(c);
        setDevice(c.webgpu.adapter ? "webgpu" : "wasm");
      })
      .finally(() => alive && setProbing(false));
    return () => {
      alive = false;
      abort.current?.abort();
    };
  }, []);

  const verdict = caps ? verdicts(caps) : [];
  const ok = (b: Backend) => verdict.some((v) => v.backend === b && v.level !== "bad");
  const engineOk = (id: EngineId) => ENGINES.find((e) => e.id === id)!.needs.some(ok);
  const models = MODELS[engine];
  const model = models[Math.min(pick[engine], models.length - 1)];
  const dev: Device | null = engine === "transformers" ? (device === "webgpu" && !ok("gpu") ? "wasm" : device === "wasm" && !ok("cpu") ? "webgpu" : device) : engine === "webllm" ? "webgpu" : engine === "wllama" ? "wasm" : null;
  const size = sizeFor(model, engine, dev ?? "webgpu");
  const conn = caps?.connection ?? {};
  const metered = !!conn.saveData || conn.type === "cellular" || /2g|3g/.test(conn.effectiveType ?? "");
  const memGB = caps?.deviceMemoryGB ?? null;
  const tooBig = model.memMB > 0 && ((memGB !== null && model.memMB > memGB * 1024 * 0.5) || (!!caps?.mobile && model.memMB > 1500));
  const f16 = !!caps?.webgpu.features?.includes("shader-f16");

  async function start() {
    if (!caps || running) return;
    if (size === null) return;
    if (metered && size > 0 && !window.confirm(`This downloads about ${mb(size)} and you seem to be on ${conn.saveData ? "data saver" : "a cellular or slow connection"}. Continue?`)) return;
    if (tooBig && !window.confirm(`${model.label} needs about ${mb(model.memMB)} of memory, which may be too much for this device: the tab could crash. Try anyway?`)) return;
    const ac = new AbortController();
    abort.current = ac;
    const heap = heapSampler();
    const t0 = performance.now();
    const lib = { transformers: `@huggingface/transformers@${TJS_VERSION}`, webllm: `@mlc-ai/web-llm@${WEBLLM_VERSION}`, wllama: `@wllama/wllama@${WLLAMA_VERSION}`, chrome: "Prompt API" }[engine];
    let run: Run = {
      at: new Date().toISOString(),
      engine,
      library: lib,
      device: dev,
      model: { choice: model.id, label: model.label, expectedMB: size },
      load: null,
      weightsFromCache: null,
      firstTokenMedianMs: null,
      tokensPerSec: null,
      totalMs: 0,
      peakJsHeapMB: null,
      stopped: false,
      error: null,
      score: null,
      cases: [],
    };
    let stage = "starting";
    const crumb = (s: string) => {
      stage = s;
      store.set(LAST, { run, stage, at: new Date().toISOString() } satisfies Breadcrumb);
    };
    const update = (patch: Partial<Run>) => {
      run = { ...run, ...patch, totalMs: performance.now() - t0 };
      setLive(run);
      crumb(stage);
    };
    // the loader's own steps ("Downloading model: 120 / 287 MB", "Compiling…"), at most every 5%
    let lastFrac = -1;
    const onProgress = (p: Progress) => {
      setProgress(p);
      if (p.frac === null || p.frac - lastFrac >= 0.05 || p.frac >= 1) {
        lastFrac = p.frac ?? lastFrac;
        crumb(`loading — ${p.text}`);
      }
    };
    setRunning(true);
    setCrashed(null);
    setProgress({ frac: null, text: "Starting…" });
    update({});
    crumb("starting the engine");
    let loaded: Engine | null = null;
    try {
      loaded = await LOADERS[engine](model, { onProgress, signal: ac.signal, f16, device: dev ?? "webgpu" });
      update({ load: loaded.report, weightsFromCache: loaded.report.cached });
      const results: Parameters<typeof score>[0] = [];
      const deployed: Parameters<typeof score>[0] = [];
      const ctx = sampleContext();
      for (const [i, c] of EVAL_CASES.entries()) {
        if (ac.signal.aborted) break;
        setProgress({ frac: i / EVAL_CASES.length, text: `Case ${i + 1} of ${EVAL_CASES.length}: ${c.question}` });
        crumb(`answering case ${i + 1} of ${EVAL_CASES.length} ("${c.question}")`);
        const g = await loaded.generate(caseMessages(c, dishes), { maxTokens: MAX_TOKENS, signal: ac.signal });
        if (g.stopped && ac.signal.aborted) break;
        const text = cleanAnswer(g.text);
        const r = replyFromText(c, text, dishes);
        results.push({ c, r });
        // as deployed: the rules engine answers what it understands; this model the rest, through the guard
        const local = answerLocally(ctx, c.question, c.lang);
        const used = local.confident ? local : guard(ctx, c.question, { answer: text, items: [], engine: "model" }, local, c.lang);
        const deployedBy: CaseRow["deployedBy"] = local.confident ? "engine" : used === local ? "engine (guard)" : "model";
        const dr =
          deployedBy === "model"
            ? { ...replyFromText(c, used.answer, dishes), ...(used.safetyNote ? { safetyNote: used.safetyNote } : {}) }
            : { answer: used.answer, safetyNote: used.safetyNote, dishes: used.items.map((x) => dishes.find((d) => d.id === x.id)!).filter(Boolean) };
        deployed.push({ c, r: dr });
        const row: CaseRow = {
          question: c.question,
          kind: c.kind,
          lang: c.lang,
          safety: !!c.safety,
          pass: c.check(r),
          answer: r.answer,
          dishes: r.dishes.map((d) => d.name),
          safetyNote: r.safetyNote ?? null,
          ttftMs: g.ttftMs === null ? null : Math.round(g.ttftMs),
          tokens: g.tokens,
          tokensApprox: g.tokensApprox,
          tokPerSec: g.ttftMs !== null && g.tokens > 1 && g.totalMs > g.ttftMs ? +((g.tokens - 1) / ((g.totalMs - g.ttftMs) / 1000)).toFixed(1) : null,
          ms: Math.round(g.totalMs),
          deployedBy,
          deployedPass: c.check(dr),
        };
        const cases = [...run.cases, row];
        const s = score(results);
        const d = score(deployed);
        update({ cases, ...summarize(cases), score: { passed: s.passed, total: s.total, unsafe: s.unsafe }, deployedScore: { passed: d.passed, total: d.total, unsafe: d.unsafe } });
      }
      update({ stopped: ac.signal.aborted });
    } catch (e) {
      update({ error: ac.signal.aborted ? null : errText(e), stopped: ac.signal.aborted });
    } finally {
      setProgress({ frac: null, text: "Unloading the model…" });
      crumb("unloading the model");
      await loaded?.unload().catch(() => {});
      update({ peakJsHeapMB: heap.stop() });
      setRuns((rs) => {
        const next = [...rs, run];
        store.set(RUNS, next);
        return next;
      });
      store.drop(LAST);
      setLive(null);
      setProgress(null);
      setRunning(false);
      abort.current = null;
      asyncCapabilities(caps).then(setCaps, () => {});
    }
  }

  const report = () => JSON.stringify({ page: "/lab/on-device", at: new Date().toISOString(), capabilities: caps, runs }, null, 2);

  async function copy() {
    const text = report();
    try {
      await navigator.clipboard.writeText(text);
      toast("Results copied");
    } catch {
      const ta = document.getElementById("lab-json") as HTMLTextAreaElement | null;
      if (ta) {
        ta.closest("details")?.setAttribute("open", "");
        ta.select();
        const done = document.execCommand?.("copy");
        toast(done ? "Results copied" : "Select the text below and copy it", !done);
      }
    }
  }

  async function clear() {
    if (running || !window.confirm("Delete the models this page downloaded?")) return;
    try {
      const gone = await clearModels();
      toast(gone.length ? `Cleared ${gone.join(", ")}` : "Nothing to clear");
    } catch (e) {
      toast(errText(e), true);
    }
    if (caps) asyncCapabilities(caps).then(setCaps, () => {});
  }

  const shown = live ?? runs[runs.length - 1] ?? null;

  return (
    <>
      <GuestBar>On-device AI lab</GuestBar>
      <main className="narrow col" style={{ gap: 18 }}>
        <section>
          <h1 style={{ marginBottom: 6 }}>Can this device run the menu assistant?</h1>
          <p className="muted" style={{ margin: 0 }}>
            Checks what this browser supports, then (only when you tap) downloads one small model and asks it our {EVAL_CASES.length} guest questions. Results stay on this device until you copy them.
          </p>
        </section>

        <section className="card col" data-testid="lab-caps">
          <div className="row between">
            <h2 style={{ margin: 0 }}>This device</h2>
            {probing && <span className="badge">checking…</span>}
          </div>
          <div className="col tight" data-testid="lab-verdict">
            {verdict.map((v) => (
              <div key={v.backend} className="row nowrap" style={{ alignItems: "flex-start" }}>
                <span className={`badge ${v.level}`} style={{ minWidth: 64, justifyContent: "center" }}>
                  {{ gpu: "GPU", cpu: "CPU", chrome: "Built-in" }[v.backend]}
                </span>
                <span style={{ fontSize: 14 }}>{v.text}</span>
              </div>
            ))}
          </div>
          {caps && <CapsTable c={caps} />}
        </section>

        <section className="card col">
          <h2 style={{ margin: 0 }}>Try an engine</h2>
          <div className="col tight" role="radiogroup" aria-label="Engine">
            {ENGINES.map((e) => (
              <label key={e.id} className="inline" style={{ alignItems: "flex-start", fontSize: 15, color: "var(--ink)", opacity: engineOk(e.id) ? 1 : 0.55 }}>
                <input type="radio" name="engine" checked={engine === e.id} disabled={running} onChange={() => setEngine(e.id)} style={{ marginTop: 2, flex: "none", width: 18 }} />
                <span className="grow">
                  <b>{e.label}</b> {!engineOk(e.id) && !probing && <span className="badge bad">not on this device</span>}
                  <div className="hint">{e.sub}</div>
                </span>
              </label>
            ))}
          </div>

          {engine === "transformers" && (
            <div className="segmented" role="tablist" aria-label="Run on">
              {(["webgpu", "wasm"] as Device[]).map((d) => (
                <button key={d} type="button" role="tab" aria-selected={dev === d} disabled={running || !ok(d === "webgpu" ? "gpu" : "cpu")} onClick={() => setDevice(d)}>
                  {d === "webgpu" ? "GPU (WebGPU)" : "CPU (WASM)"}
                </button>
              ))}
            </div>
          )}

          {engine !== "chrome" && (
            <div className="col tight" role="radiogroup" aria-label="Model">
              {models.map((m, i) => {
                const s = sizeFor(m, engine, dev ?? "webgpu");
                return (
                  <label key={m.id} className="inline" style={{ alignItems: "flex-start", fontSize: 15, color: "var(--ink)", opacity: s === null ? 0.5 : 1 }}>
                    <input type="radio" name="model" checked={model.id === m.id} disabled={running || s === null} onChange={() => setPick({ ...pick, [engine]: i })} style={{ marginTop: 2, flex: "none", width: 18 }} />
                    <span className="grow">
                      {m.label} <span className="badge">{s === null ? "GPU only" : mb(s)}</span>
                      <div className="hint">{m.note}</div>
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {engine === "wllama" && (
            <div className="hint">
              Multi-threading needs a cross-origin isolated page; this page is {caps?.crossOriginIsolated ? "isolated, so it uses several threads" : "not isolated, so it runs single-threaded (slower, but works everywhere)"}.
            </div>
          )}
          {engine === "chrome" && <div className="hint">Chrome manages this model itself: the first time, it may download several GB (needs ~22 GB free disk). Answers are cut at about {MAX_TOKENS} stream chunks.</div>}

          <div className="card sunk tight row between nowrap" data-testid="lab-size">
            <span className="col tight" style={{ gap: 2 }}>
              <span className="hint">Download</span>
              <b style={{ fontSize: 22 }}>{engine === "chrome" ? "managed by Chrome" : `≈ ${mb(size)}`}</b>
            </span>
            {size !== null && size > WIFI_MB && (
              <span className="badge warn">
                <Wifi /> Wi-Fi recommended
              </span>
            )}
          </div>
          {metered && (
            <div className="alert bad">
              <AlertTriangle size={18} />
              <span>You seem to be on {conn.saveData ? "data saver" : "a cellular or slow connection"}. Downloads count against your data.</span>
            </div>
          )}
          {tooBig && (
            <div className="alert bad">
              <AlertTriangle size={18} />
              <span>
                {model.label} needs about {mb(model.memMB)} of memory; this device reports {memGB !== null ? `${memGB} GB` : "a phone"}. It may crash the tab: start with the smallest model.
              </span>
            </div>
          )}

          {running ? (
            <div className="col tight" data-testid="lab-progress">
              <div className="meter" aria-label="Progress">
                <div style={{ width: `${Math.round((progress?.frac ?? 0) * 100)}%` }} />
              </div>
              <div className="hint" style={{ overflowWrap: "anywhere" }}>{progress?.text}</div>
              <button className="btn danger block" onClick={() => abort.current?.abort()}>
                <Square size={16} /> Stop
              </button>
            </div>
          ) : (
            <button className="btn primary block big" data-testid="lab-download" disabled={!caps || probing || !engineOk(engine) || size === null} onClick={start}>
              <Download size={18} /> {engine === "chrome" ? "Test the built-in model" : `Download & test (≈ ${mb(size)})`}
            </button>
          )}
        </section>

        {crashed && (
          <div className="alert bad" role="alert" data-testid="lab-crashed">
            <span>
              <b>The last run didn't finish.</b> The browser closed the page while it was {crashed.stage} ({crashed.run.model.label}, {crashed.run.engine}
              {crashed.run.device ? `, ${crashed.run.device === "webgpu" ? "GPU" : "CPU"}` : ""}). On iPhone this almost always means it ran out of memory. It's kept in the results below; try a smaller model, or the other device option.
            </span>
          </div>
        )}
        {shown && <RunCard run={shown} live={!!live} />}

        <section className="card col">
          <h2 style={{ margin: 0 }}>Results</h2>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            {runs.length ? `${runs.length} run${runs.length > 1 ? "s" : ""} kept on this device.` : "No runs yet."} Copy sends the device details and every run as JSON.
          </p>
          {runs.length > 1 && (
            <div className="list">
              {runs.map((r, i) => (
                <div key={i} className="row between nowrap" style={{ fontSize: 14 }}>
                  <span className="grow">
                    {r.model.label} <span className="hint">· {r.engine}{r.device ? ` · ${r.device}` : ""}{r.weightsFromCache ? " · from cache" : ""}</span>
                  </span>
                  <span className={`badge ${r.error ? "bad" : r.score?.unsafe.length ? "bad" : "ok"}`}>{r.error ? "failed" : r.score ? `${r.score.passed}/${r.score.total}` : "—"}</span>
                </div>
              ))}
            </div>
          )}
          <div className="row">
            <button className="btn" data-testid="lab-copy" onClick={copy} disabled={!caps}>
              <ClipboardCopy size={16} /> Copy results
            </button>
            <button className="btn danger" data-testid="lab-clear" onClick={clear} disabled={running}>
              <Trash2 size={16} /> Clear downloaded models
            </button>
            {runs.length > 0 && (
              <button className="btn ghost" disabled={running} onClick={() => window.confirm("Forget the results kept on this device?") && (store.drop(RUNS), setRuns([]), setCrashed(null))}>
                Forget results
              </button>
            )}
          </div>
          <details>
            <summary className="hint">Show the JSON</summary>
            <textarea id="lab-json" readOnly value={caps ? report() : ""} style={{ width: "100%", minHeight: 160, fontSize: 12, fontFamily: "ui-monospace, monospace" }} />
          </details>
        </section>
      </main>
    </>
  );
}

function CapsTable({ c }: { c: Capabilities }) {
  const g = c.webgpu;
  const lim = (k: string) => (g.limits?.[k] === undefined ? "—" : mb(g.limits[k] / 1048576));
  const rows: [string, string][] = [
    ["Browser", c.userAgent],
    ["Platform", `${c.platform || "—"}${c.mobile ? " · mobile" : ""}`],
    ["WebGPU", g.present ? (g.adapter ? `adapter${g.fallback ? " (software fallback)" : ""}` : (g.error ?? "present, no adapter yet")) : "not present"],
    ...(g.adapter
      ? ([
          ["GPU", Object.values(g.info ?? {}).join(" · ") || "not disclosed"],
          ["shader-f16", yn(g.features?.includes("shader-f16"))],
          ["Features", g.features?.join(", ") || "—"],
          ["maxBufferSize", lim("maxBufferSize")],
          ["maxStorageBufferBindingSize", lim("maxStorageBufferBindingSize")],
        ] as [string, string][])
      : []),
    ["Device memory", c.deviceMemoryGB === null ? "not reported" : `${c.deviceMemoryGB} GB (browser rounds, max 8)`],
    ["CPU threads", c.cores === null ? "—" : String(c.cores)],
    ["Cross-origin isolated", `${yn(c.crossOriginIsolated)} (SharedArrayBuffer ${yn(c.sharedArrayBuffer)})`],
    ["WASM", c.wasm.present ? `SIMD ${yn(c.wasm.simd)} · exceptions ${yn(c.wasm.exceptions)} · JSPI ${yn(c.wasm.jspi)} · memory64 ${yn(c.wasm.memory64)}` : "not present"],
    ["Chrome built-in", c.chrome.present ? (c.chrome.availability ?? c.chrome.error ?? "checking…") : "not present"],
    ["Storage", c.storage.error ?? (c.storage.quotaMB === undefined ? "checking…" : `${mb(c.storage.usageMB)} used of ${mb(c.storage.quotaMB)}${c.storage.persisted ? " · persisted" : ""}`)],
    ["Network", [c.connection.type, c.connection.effectiveType, c.connection.downlinkMbps !== undefined && `${c.connection.downlinkMbps} Mbps`, c.connection.saveData && "data saver"].filter(Boolean).join(" · ") || "not reported"],
    ["JS heap limit", c.jsHeapLimitMB === null ? "not reported" : mb(c.jsHeapLimitMB)],
  ];
  return (
    <dl className="kv" style={{ margin: 0 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "contents" }}>
          <dt>{k}</dt>
          <dd style={{ overflowWrap: "anywhere", fontSize: k === "Browser" || k === "Features" ? 12 : undefined }}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function RunCard({ run, live }: { run: Run; live: boolean }) {
  const s = run.score;
  return (
    <section className="card col" data-testid="lab-results">
      <div className="row between">
        <h2 style={{ margin: 0 }}>{run.model.label}</h2>
        {s && <span className={`badge ${s.unsafe.length ? "bad" : s.passed === s.total ? "ok" : "warn"}`}>model alone {s.passed}/{s.total}</span>}
        {run.deployedScore && (
          <span className={`badge ${run.deployedScore.unsafe.length ? "bad" : "ok"}`} data-testid="lab-deployed" title="Rules engine first, this model for the rest, the allergen guard">
            as deployed {run.deployedScore.passed}/{run.deployedScore.total}
          </span>
        )}
      </div>
      <div className="hint">
        {run.library}
        {run.load ? ` · ${run.load.model}` : ""}
        {live ? " · running" : run.stopped ? " · stopped" : ""}
      </div>
      {run.error && (
        <div className="alert bad" role="alert" data-testid="lab-error">
          <AlertTriangle size={18} />
          <span style={{ overflowWrap: "anywhere" }}>{run.error}</span>
        </div>
      )}
      <dl className="kv" style={{ margin: 0 }}>
        <dt>Weights from cache</dt>
        <dd>{run.load ? (run.weightsFromCache === null ? "unknown" : run.weightsFromCache ? "yes (repeat visit)" : "no (first visit)") : "—"}</dd>
        <dt>Downloaded</dt>
        <dd>{run.load ? `${mb(run.load.downloadMB)} in ${ms(run.load.downloadMs)}` : "—"}</dd>
        <dt>Load / compile</dt>
        <dd>{ms(run.load?.loadMs)}</dd>
        <dt>First token (median)</dt>
        <dd>{ms(run.firstTokenMedianMs)}</dd>
        <dt>Tokens per second</dt>
        <dd>{run.tokensPerSec ?? "—"}{run.cases.some((c) => c.tokensApprox) ? " (≈, counted from stream chunks)" : ""}</dd>
        <dt>Peak JS heap</dt>
        <dd>{run.peakJsHeapMB === null ? (live ? "measuring…" : "not reported") : mb(run.peakJsHeapMB)}</dd>
        <dt>Total time</dt>
        <dd>{ms(run.totalMs)}</dd>
      </dl>
      {!!s?.unsafe.length && (
        <div className="alert bad" data-testid="lab-unsafe">
          <AlertTriangle size={18} />
          <span>
            <b>Safety failures of the model alone ({s.unsafe.length}){run.deployedScore && !run.deployedScore.unsafe.length ? "; none as deployed, where the rules engine answers these" : ""}:</b>
            <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
              {s.unsafe.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </span>
        </div>
      )}
      {run.cases.length > 0 && (
        <div className="list" data-testid="lab-cases">
          {run.cases.map((c, i) => (
            <div key={i} className="col tight">
              <div className="row nowrap" style={{ alignItems: "flex-start" }}>
                <span className={`badge ${c.pass ? "ok" : "bad"}`}>{c.pass ? "pass" : "fail"}</span>
                {c.deployedBy && <span className={`badge ${c.deployedPass ? "ok" : "bad"}`} title="As deployed">{c.deployedBy === "model" ? "model" : "engine"} {c.deployedPass ? "✓" : "✗"}</span>}
                <span className="grow" style={{ fontWeight: 650 }}>
                  {c.question} {c.safety && <span className="badge warn">safety</span>}
                </span>
              </div>
              <div style={{ fontSize: 14, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{c.answer || <span className="muted">(no answer)</span>}</div>
              <div className="hint">
                {c.dishes.length ? `Named: ${c.dishes.join(", ")}` : "Named no dish"} · safety note: {c.safetyNote ?? "none"} · first token {ms(c.ttftMs)} · {c.tokens} tokens{c.tokensApprox ? " ≈" : ""}
                {c.tokPerSec !== null ? ` · ${c.tokPerSec} tok/s` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
