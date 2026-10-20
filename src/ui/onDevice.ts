// Engines and device probes for the /lab/on-device page. Nothing here runs at import time: the ML
// libraries load from pinned CDN URLs only when the person taps a download button, and never end
// up in the app bundle. Their APIs are typed with the few members we use (no @types packages).

import type { ChatMessage } from "../shared/onDeviceEval";

// ---- pinned sources (versions from the npm registry, repos and sizes from the Hugging Face API, Oct 2026) ----

export const TJS_VERSION = "4.3.1";
export const TJS_URL = `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${TJS_VERSION}/dist/transformers.min.js`;
export const WEBLLM_VERSION = "0.2.86";
export const WEBLLM_URL = `https://esm.run/@mlc-ai/web-llm@${WEBLLM_VERSION}`;
export const WLLAMA_VERSION = "3.8.1";
export const WLLAMA_URL = `https://cdn.jsdelivr.net/npm/@wllama/wllama@${WLLAMA_VERSION}/esm/index.js`;
export const WLLAMA_WASM = `https://cdn.jsdelivr.net/npm/@wllama/wllama@${WLLAMA_VERSION}/esm/wasm/wllama.wasm`;
/** Hosts the page contacts only after a download tap (the e2e test checks none is hit on load). */
export const MODEL_HOSTS = /(^|\.)(esm\.run|jsdelivr\.net|huggingface\.co|hf\.co|githubusercontent\.com)$/;

/** transformers: Transformers.js (WebGPU, or WASM on the CPU); webllm: WebLLM (WebGPU); wllama: llama.cpp on the CPU; chrome: the browser's own model. */
export type EngineId = "transformers" | "webllm" | "wllama" | "chrome";
export type Device = "webgpu" | "wasm";

export interface ModelChoice {
  id: string;
  label: string;
  /** Download in MB (weights + tokenizer + runtime), on the GPU path; see the source comments for how. */
  mb: number;
  /** Download in MB on the CPU (WASM) path, or null when this model is GPU-only. */
  mbCpu?: number | null;
  /** Memory it needs, MB (the library's figure for WebLLM; ~1.2× the weights otherwise). */
  memMB: number;
  note: string;
  /** WebLLM: the f32 build for adapters without shader-f16. */
  idF32?: string;
  /** Transformers.js: Hugging Face repo and the commit it is pinned to. */
  repo?: string;
  rev?: string;
  /** Qwen3 / Gemma 4 think aloud unless told not to: we turn thinking off to fit the 200-token budget. */
  thinks?: boolean;
  /** wllama: the GGUF URL. */
  url?: string;
}

// Transformers.js models: each repo was checked for ONNX q4f16 (GPU) / q4 (CPU) weights. Sizes are the
// onnx/ files from the Hugging Face tree API, plus tokenizer.json and onnxruntime-web's WASM (~27 MB).
// Gemma 4 E2B loads text-only (Transformers.js skips its vision and audio encoders for a causal-LM
// load), but its per-layer embedding table is as big as the decoder: ~3.1 GB, not ~1 GB.
export const TJS_MODELS: ModelChoice[] = [
  { id: "LFM2.5-350M", repo: "onnx-community/LFM2.5-350M-ONNX", rev: "7dd4999565b0342c381ba90a3d8fc467d6df19c4", label: "Liquid LFM2.5 350M", mb: 287, mbCpu: 325, memMB: 400, note: "tiniest; built for phones" },
  { id: "Qwen3-0.6B", repo: "onnx-community/Qwen3-0.6B-ONNX", rev: "58ca03a5e7b354b480b1a82b34bde8dc7b854cc0", label: "Qwen3 0.6B", mb: 607, mbCpu: 955, memMB: 750, note: "good Chinese", thinks: true },
  { id: "LFM2.5-1.2B-Instruct", repo: "LiquidAI/LFM2.5-1.2B-Instruct-ONNX", rev: "10f72e70abf67ac0fd7ebf15bc5854726891d864", label: "Liquid LFM2.5 1.2B Instruct", mb: 792, mbCpu: 881, memMB: 1000, note: "on-device model; reads Chinese" },
  { id: "Qwen3-1.7B", repo: "onnx-community/Qwen3-1.7B-ONNX", rev: "3231b522c6e703b2f9b3cd8ea27426a1289a02f2", label: "Qwen3 1.7B", mb: 1463, mbCpu: null, memMB: 1800, note: "better Chinese; GPU only", thinks: true },
  { id: "gemma-4-E2B-it", repo: "onnx-community/gemma-4-E2B-it-ONNX", rev: "6f21c99d7e18237f8d2ce92aadfdbfeba877f63a", label: "Gemma 4 E2B it (text only)", mb: 3158, mbCpu: null, memMB: 3800, note: "strongest; laptops with 4 GB+ GPU memory", thinks: true },
];

// WebLLM: its three smallest useful prebuilt chat models. Sizes: the sum of each model's
// tensor-cache.json records on Hugging Face (mlc-ai/<id>), plus the model library (~5.5 MB) and
// web-llm itself (~6 MB). Memory: vram_required_MB from web-llm's prebuiltAppConfig (f16 build).
export const WEBLLM_MODELS: ModelChoice[] = [
  { id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC", idF32: "Qwen2.5-0.5B-Instruct-q4f32_1-MLC", label: "Qwen2.5 0.5B Instruct", mb: 290, memMB: 945, note: "tiny; reads Chinese" },
  { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC", idF32: "Llama-3.2-1B-Instruct-q4f32_1-MLC", label: "Llama 3.2 1B Instruct", mb: 707, memMB: 879, note: "1B; English first" },
  { id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", idF32: "Qwen2.5-1.5B-Instruct-q4f32_1-MLC", label: "Qwen2.5 1.5B Instruct", mb: 880, memMB: 1630, note: "small; better Chinese" },
];

// bartowski/Qwen2.5-0.5B-Instruct-GGUF at a fixed commit: Q4_K_M is 397,808,192 bytes, plus the
// wllama runtime (8.8 MB wasm, or the 16 MB compat build on browsers without JSPI / memory64).
const GGUF_REV = "41ba88dbac95fed2528c92514c131d73eb5a174b";
export const WLLAMA_MODELS: ModelChoice[] = [
  {
    id: "Qwen2.5-0.5B-Instruct-Q4_K_M.gguf",
    label: "Qwen2.5 0.5B Instruct (Q4_K_M GGUF)",
    mb: 407,
    memMB: 700,
    note: "CPU only; slow but runs anywhere with WASM SIMD",
    url: `https://huggingface.co/bartowski/Qwen2.5-0.5B-Instruct-GGUF/resolve/${GGUF_REV}/Qwen2.5-0.5B-Instruct-Q4_K_M.gguf`,
  },
];

export const CHROME_MODELS: ModelChoice[] = [{ id: "chrome-built-in", label: "Chrome built-in model", mb: 0, memMB: 0, note: "Chrome downloads and manages it (several GB, once, shared by all sites)" }];

export const MODELS: Record<EngineId, ModelChoice[]> = { transformers: TJS_MODELS, webllm: WEBLLM_MODELS, wllama: WLLAMA_MODELS, chrome: CHROME_MODELS };

/** The download for a model on a device, in MB (null: not offered there). */
export const sizeFor = (m: ModelChoice, engine: EngineId, device: Device): number | null => (engine === "transformers" && device === "wasm" ? (m.mbCpu ?? null) : m.mb);


// ---- capabilities ----

export interface Capabilities {
  userAgent: string;
  platform: string;
  mobile: boolean | null;
  webgpu: { present: boolean; adapter: boolean; info?: Record<string, string>; features?: string[]; limits?: Record<string, number>; fallback?: boolean; error?: string };
  deviceMemoryGB: number | null;
  cores: number | null;
  crossOriginIsolated: boolean;
  sharedArrayBuffer: boolean;
  wasm: { present: boolean; simd: boolean; exceptions: boolean; jspi: boolean; memory64: boolean };
  chrome: { present: boolean; availability?: string; error?: string };
  storage: { usageMB?: number; quotaMB?: number; persisted?: boolean; error?: string };
  connection: { effectiveType?: string; type?: string; saveData?: boolean; downlinkMbps?: number };
  jsHeapLimitMB: number | null;
}

// Tiny modules from wasm-feature-detect: each validates only if the feature is supported.
const SIMD = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);
const EXCEPTIONS = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 10, 8, 1, 6, 0, 6, 64, 25, 11, 11]);

const validate = (bytes: BufferSource) => {
  try {
    return typeof WebAssembly === "object" && WebAssembly.validate(bytes);
  } catch {
    return false;
  }
};

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, no) => setTimeout(() => no(new Error(`${what} did not answer in ${ms / 1000}s`)), ms))]);
}

const errText = (e: unknown) => (e instanceof Error ? `${e.name === "Error" ? "" : `${e.name}: `}${e.message}` : String(e));
export { errText };

interface NavigatorPlus {
  gpu?: { requestAdapter(o?: unknown): Promise<GpuAdapter | null> };
  deviceMemory?: number;
  connection?: { effectiveType?: string; type?: string; saveData?: boolean; downlink?: number };
  userAgentData?: { platform?: string; mobile?: boolean };
}
interface GpuAdapter {
  features: Iterable<string>;
  limits: Record<string, number>;
  info?: Record<string, unknown>;
  isFallbackAdapter?: boolean;
  requestAdapterInfo?: () => Promise<Record<string, unknown>>;
}

/** Everything the page can learn without downloading anything. */
export function syncCapabilities(): Capabilities {
  const nav = navigator as unknown as NavigatorPlus & { userAgent: string; platform?: string; hardwareConcurrency?: number };
  const mem64 = (() => {
    try {
      new WebAssembly.Memory({ address: "i64", initial: BigInt(1) } as unknown as WebAssembly.MemoryDescriptor);
      return true;
    } catch {
      return false;
    }
  })();
  const heap = (performance as Performance & { memory?: { jsHeapSizeLimit: number } }).memory;
  return {
    userAgent: nav.userAgent,
    platform: nav.userAgentData?.platform ?? nav.platform ?? "",
    mobile: nav.userAgentData?.mobile ?? (/Mobi|Android|iPhone|iPad/i.test(nav.userAgent) ? true : null),
    webgpu: { present: !!nav.gpu, adapter: false },
    deviceMemoryGB: nav.deviceMemory ?? null,
    cores: nav.hardwareConcurrency ?? null,
    crossOriginIsolated: !!globalThis.crossOriginIsolated,
    sharedArrayBuffer: typeof SharedArrayBuffer === "function",
    wasm: { present: typeof WebAssembly === "object", simd: validate(SIMD), exceptions: validate(EXCEPTIONS), jspi: typeof WebAssembly === "object" && "Suspending" in WebAssembly, memory64: mem64 },
    chrome: { present: "LanguageModel" in globalThis },
    storage: {},
    connection: { effectiveType: nav.connection?.effectiveType, type: nav.connection?.type, saveData: nav.connection?.saveData, downlinkMbps: nav.connection?.downlink },
    jsHeapLimitMB: heap ? Math.round(heap.jsHeapSizeLimit / 1048576) : null,
  };
}

const LIMITS = ["maxBufferSize", "maxStorageBufferBindingSize", "maxComputeWorkgroupStorageSize", "maxComputeInvocationsPerWorkgroup"];

/** The probes that answer asynchronously: GPU adapter, built-in model, storage. Each is time-boxed. */
export async function asyncCapabilities(base: Capabilities): Promise<Capabilities> {
  const nav = navigator as unknown as NavigatorPlus & { userAgent: string; platform?: string; hardwareConcurrency?: number };
  const caps: Capabilities = { ...base, webgpu: { ...base.webgpu }, chrome: { ...base.chrome }, storage: {} };
  await Promise.all([
    (async () => {
      if (!nav.gpu) return;
      try {
        const a = await withTimeout(nav.gpu.requestAdapter({ powerPreference: "high-performance" }), 5000, "requestAdapter()");
        if (!a) return void (caps.webgpu.error = "requestAdapter() returned null (WebGPU blocked or no usable GPU)");
        const info = a.info ?? (a.requestAdapterInfo ? await withTimeout(a.requestAdapterInfo(), 3000, "adapter info").catch(() => undefined) : undefined);
        caps.webgpu = {
          present: true,
          adapter: true,
          info: info ? Object.fromEntries(["vendor", "architecture", "device", "description"].map((k) => [k, String(info[k] ?? "")]).filter(([, v]) => v)) : undefined,
          features: [...a.features].sort(),
          limits: Object.fromEntries(LIMITS.filter((k) => typeof a.limits[k] === "number").map((k) => [k, a.limits[k]])),
          fallback: a.isFallbackAdapter ?? (info as { isFallbackAdapter?: boolean } | undefined)?.isFallbackAdapter,
        };
      } catch (e) {
        caps.webgpu.error = errText(e);
      }
    })(),
    (async () => {
      const LM = chromeLM();
      if (!LM) return;
      try {
        caps.chrome.availability = await withTimeout(LM.availability(), 5000, "LanguageModel.availability()");
      } catch (e) {
        caps.chrome.error = errText(e);
      }
    })(),
    (async () => {
      try {
        const est = await withTimeout(navigator.storage.estimate(), 3000, "storage.estimate()");
        caps.storage = { usageMB: Math.round((est.usage ?? 0) / 1048576), quotaMB: Math.round((est.quota ?? 0) / 1048576), persisted: await navigator.storage.persisted?.().catch(() => undefined) };
      } catch (e) {
        caps.storage = { error: errText(e) };
      }
    })(),
  ]);
  return caps;
}

export type Backend = "gpu" | "cpu" | "chrome";
export type Verdict = { backend: Backend; level: "ok" | "warn" | "bad"; text: string };

/** What this device can run on (GPU, CPU, the browser's own model), in plain words. */
export function verdicts(c: Capabilities): Verdict[] {
  const f16 = c.webgpu.features?.includes("shader-f16");
  const webgpu: Verdict = !c.webgpu.present
    ? { backend: "gpu", level: "bad", text: "No WebGPU in this browser." }
    : !c.webgpu.adapter
      ? { backend: "gpu", level: "bad", text: c.webgpu.error ?? "Checking the GPU…" }
      : c.webgpu.fallback
        ? { backend: "gpu", level: "warn", text: "Only a software (fallback) GPU: expect it to be very slow." }
        : { backend: "gpu", level: f16 ? "ok" : "warn", text: f16 ? "Can try (GPU supports f16)." : "Can try, f32 builds only (no shader-f16: more memory, slower)." };
  const wasmOk = c.wasm.simd && c.wasm.exceptions;
  const wasm: Verdict = !c.wasm.present
    ? { backend: "cpu", level: "bad", text: "No WebAssembly." }
    : !wasmOk
      ? { backend: "cpu", level: "bad", text: `Missing WASM ${[!c.wasm.simd && "SIMD", !c.wasm.exceptions && "exceptions"].filter(Boolean).join(" and ")}.` }
      : {
          backend: "cpu",
          level: "warn",
          text: `Can try on the CPU, ${c.crossOriginIsolated ? `multi-threaded (${Math.max(1, Math.floor((c.cores ?? 2) / 2))} threads)` : "single-threaded (page is not cross-origin isolated)"}${c.wasm.jspi && c.wasm.memory64 ? "" : ", in the slower compat build"}.`,
        };
  const a = c.chrome.availability;
  const chrome: Verdict = !c.chrome.present
    ? { backend: "chrome", level: "bad", text: "No built-in model (Chrome desktop with the Prompt API only)." }
    : a === "available"
      ? { backend: "chrome", level: "ok", text: "Ready: the model is already on this device." }
      : a === "downloadable" || a === "downloading"
        ? { backend: "chrome", level: "warn", text: `Can try: Chrome must ${a === "downloading" ? "finish downloading" : "download"} its model first (several GB).` }
        : { backend: "chrome", level: "bad", text: c.chrome.error ?? (a ? `Not on this device (${a}).` : "Checking…") };
  return [webgpu, wasm, chrome];
}

// ---- engines ----

export interface Progress {
  /** 0..1, or null when unknown. */
  frac: number | null;
  text: string;
}

export interface LoadReport {
  /** The exact build loaded (e.g. the f32 WebGPU variant). */
  model: string;
  cached: boolean | null;
  downloadMB: number | null;
  downloadMs: number | null;
  loadMs: number;
  detail: Record<string, unknown>;
}

export interface GenResult {
  text: string;
  tokens: number;
  /** Tokens are counted from stream chunks, not the tokenizer. */
  tokensApprox: boolean;
  ttftMs: number | null;
  totalMs: number;
  stopped: boolean;
}

export interface Engine {
  report: LoadReport;
  generate(messages: ChatMessage[], o: { maxTokens: number; signal: AbortSignal }): Promise<GenResult>;
  unload(): Promise<void>;
}

interface LoadOptions {
  onProgress(p: Progress): void;
  signal: AbortSignal;
  f16: boolean;
  /** Transformers.js only: run on the GPU or the CPU. */
  device: Device;
}

const importUrl = async <T,>(url: string): Promise<T> => (await import(/* @vite-ignore */ url)) as T;

const aborted = () => new DOMException("Stopped", "AbortError");
const isAbort = (e: unknown) => (e instanceof Error || e instanceof DOMException) && (e.name === "AbortError" || e.name === "WllamaAbortError" || /abort|interrupt/i.test(e.message));
export { isAbort };

/** Rejects as soon as the signal fires, so a stuck library call never pins the page. */
function untilAbort<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(aborted());
  return new Promise<T>((yes, no) => {
    const stop = () => no(aborted());
    signal.addEventListener("abort", stop, { once: true });
    p.then(yes, no).finally(() => signal.removeEventListener("abort", stop));
  });
}

/** Streams text deltas into a result with first-token time and token count. */
async function timed(run: (onDelta: (s: string) => void) => Promise<{ tokens?: number } | void>, signal: AbortSignal): Promise<GenResult> {
  const t0 = performance.now();
  let first: number | null = null;
  let text = "";
  let chunks = 0;
  let stopped = false;
  try {
    const r = await run((d) => {
      if (!d) return;
      if (first === null) first = performance.now();
      text += d;
      chunks++;
    });
    const tokens = r && typeof r.tokens === "number" && r.tokens > 0 ? r.tokens : null;
    return { text, tokens: tokens ?? chunks, tokensApprox: tokens === null, ttftMs: first === null ? null : first - t0, totalMs: performance.now() - t0, stopped: signal.aborted };
  } catch (e) {
    if (!signal.aborted && !isAbort(e)) throw e;
    stopped = true;
  }
  return { text, tokens: chunks, tokensApprox: true, ttftMs: first === null ? null : first - t0, totalMs: performance.now() - t0, stopped };
}

// Transformers.js: ONNX Runtime Web on WebGPU, or on WASM (the CPU) where there is no GPU. On WASM
// ONNX Runtime runs in its own proxy worker, so a slow phone CPU never freezes the page.
interface TjsTensor {
  dims: number[];
}
interface TjsTokenizer {
  apply_chat_template(messages: ChatMessage[], o: Record<string, unknown>): { input_ids: TjsTensor; attention_mask: TjsTensor };
}
interface TjsModel {
  generate(o: Record<string, unknown>): Promise<unknown>;
  dispose(): Promise<unknown>;
}
interface TjsLib {
  env: { backends: { onnx: { wasm?: { proxy?: boolean; numThreads?: number } } } };
  AutoTokenizer: { from_pretrained(id: string, o: Record<string, unknown>): Promise<TjsTokenizer> };
  AutoModelForCausalLM: { from_pretrained(id: string, o: Record<string, unknown>): Promise<TjsModel> };
  TextStreamer: new (tok: TjsTokenizer, o: Record<string, unknown>) => unknown;
  InterruptableStoppingCriteria: new () => { interrupt(): void };
}

/** Whether Transformers.js already holds this model's weights in its Cache API store. */
async function tjsCached(m: ModelChoice): Promise<boolean | null> {
  try {
    if (!("caches" in globalThis) || !(await caches.has("transformers-cache"))) return false;
    const keys = await (await caches.open("transformers-cache")).keys();
    return keys.some((k) => k.url.includes(`${m.repo}/resolve/${m.rev}/onnx/`));
  } catch {
    return null;
  }
}

export async function loadTransformers(choice: ModelChoice, o: LoadOptions): Promise<Engine> {
  const t0 = performance.now();
  const device = o.device;
  // q4f16 needs the GPU's shader-f16; plain q4 everywhere else
  const dtype = device === "webgpu" && o.f16 ? "q4f16" : "q4";
  o.onProgress({ frac: null, text: `Loading Transformers.js ${TJS_VERSION} from the CDN…` });
  const lib = await untilAbort(importUrl<TjsLib>(TJS_URL), o.signal);
  if (lib.env.backends.onnx.wasm) lib.env.backends.onnx.wasm.proxy = device === "wasm";
  const cached = await tjsCached(choice);
  let downloadEnd: number | null = null;
  let bytes: number | null = null;
  const progress_callback = (p: { status: string; loaded?: number; total?: number; file?: string }) => {
    if (p.status !== "progress_total" || !p.total) return;
    bytes = p.total;
    if ((p.loaded ?? 0) >= p.total) downloadEnd ??= performance.now();
    o.onProgress({ frac: (p.loaded ?? 0) / p.total, text: `${cached ? "Reading cached model" : "Downloading model"}: ${Math.round((p.loaded ?? 0) / 1048576)} / ${Math.round(p.total / 1048576)} MB` });
  };
  const opts = { revision: choice.rev, progress_callback };
  const tokenizer = await untilAbort(lib.AutoTokenizer.from_pretrained(choice.repo!, opts), o.signal);
  const model = await untilAbort(lib.AutoModelForCausalLM.from_pretrained(choice.repo!, { ...opts, dtype, device }), o.signal);
  const loadEnd = performance.now();
  const downloadMs = cached ? 0 : downloadEnd === null ? null : (downloadEnd as number) - t0;
  return {
    report: {
      model: `${choice.repo}@${choice.rev!.slice(0, 7)} (${dtype}, ${device})`,
      cached,
      downloadMB: cached ? 0 : bytes === null ? null : Math.round((bytes as number) / 1048576),
      downloadMs,
      loadMs: downloadMs === null ? loadEnd - t0 : loadEnd - t0 - downloadMs,
      detail: { library: `@huggingface/transformers@${TJS_VERSION}`, device, dtype, wasmProxyWorker: device === "wasm" },
    },
    generate: (messages, g) =>
      timed(async (onDelta) => {
        const inputs = tokenizer.apply_chat_template(messages, { add_generation_prompt: true, return_dict: true, ...(choice.thinks ? { enable_thinking: false } : {}) });
        let tokens = 0;
        const stopper = new lib.InterruptableStoppingCriteria();
        const stop = () => stopper.interrupt();
        g.signal.addEventListener("abort", stop, { once: true });
        try {
          const streamer = new lib.TextStreamer(tokenizer, {
            skip_prompt: true,
            skip_special_tokens: true,
            callback_function: (t: string) => onDelta(t),
            token_callback_function: (ids: unknown[]) => void (tokens += ids?.length ?? 1),
          });
          await model.generate({ ...inputs, max_new_tokens: g.maxTokens, do_sample: false, streamer, stopping_criteria: stopper });
        } finally {
          g.signal.removeEventListener("abort", stop);
        }
        return { tokens };
      }, g.signal),
    unload: async () => {
      await model.dispose().catch(() => {});
    },
  };
}

// WebGPU via WebLLM, run in a module worker so a busy GPU or tokenizer never freezes the page,
// and so Stop during a download can simply terminate it.
interface WebLLMChunk {
  choices: { delta?: { content?: string | null } }[];
  usage?: { completion_tokens?: number; extra?: Record<string, number> } | null;
}
interface WebLLMEngine {
  chat: { completions: { create(o: Record<string, unknown>): Promise<AsyncIterable<WebLLMChunk>> } };
  interruptGenerate(): void | Promise<void>;
  unload(): Promise<void>;
}
interface WebLLMLib {
  CreateWebWorkerMLCEngine(worker: Worker, model: string, cfg: Record<string, unknown>): Promise<WebLLMEngine>;
  CreateMLCEngine(model: string, cfg: Record<string, unknown>): Promise<WebLLMEngine>;
  hasModelInCache(model: string): Promise<boolean>;
}

export async function loadWebLLM(choice: ModelChoice, o: LoadOptions): Promise<Engine> {
  const model = o.f16 || !choice.idF32 ? choice.id : choice.idF32;
  const t0 = performance.now();
  o.onProgress({ frac: null, text: `Loading web-llm ${WEBLLM_VERSION} from the CDN…` });
  const lib = await untilAbort(importUrl<WebLLMLib>(WEBLLM_URL), o.signal);
  const cached = await lib.hasModelInCache(model).catch(() => null);
  let lastFetch: number | null = null;
  let fetchedMB: number | null = null;
  const initProgressCallback = (r: { progress: number; text: string }) => {
    const m = /(\d+)MB fetched/.exec(r.text);
    if (/fetch/i.test(r.text)) lastFetch = performance.now();
    if (m) fetchedMB = +m[1];
    o.onProgress({ frac: r.progress, text: r.text });
  };
  const cfg = { initProgressCallback, logLevel: "WARN" };
  let worker: Worker | null = null;
  let engine: WebLLMEngine;
  let inWorker = true;
  try {
    const code = `import { WebWorkerMLCEngineHandler } from "${WEBLLM_URL}";\nconst h = new WebWorkerMLCEngineHandler();\nself.onmessage = (m) => h.onmessage(m);\n`;
    const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
    worker = new Worker(url, { type: "module" });
    const w = worker;
    const failed = new Promise<never>((_, no) => w.addEventListener("error", (e) => no(new Error(`web-llm worker failed: ${e.message || "could not start"}`)), { once: true }));
    const stop = () => w.terminate();
    o.signal.addEventListener("abort", stop, { once: true });
    try {
      engine = await untilAbort(Promise.race([lib.CreateWebWorkerMLCEngine(w, model, cfg), failed]), o.signal);
    } finally {
      o.signal.removeEventListener("abort", stop);
      URL.revokeObjectURL(url);
    }
  } catch (e) {
    worker?.terminate();
    worker = null;
    if (o.signal.aborted || !/worker/i.test(errText(e))) throw e;
    // some browsers cannot start module workers from a blob: run on the page instead
    inWorker = false;
    engine = await untilAbort(lib.CreateMLCEngine(model, cfg), o.signal);
  }
  const loadEnd = performance.now();
  const downloadMs = lastFetch === null ? (cached ? 0 : null) : (lastFetch as number) - t0;
  return {
    report: { model, cached, downloadMB: fetchedMB ?? (cached ? 0 : choice.mb), downloadMs, loadMs: downloadMs === null ? loadEnd - t0 : loadEnd - t0 - downloadMs, detail: { library: `@mlc-ai/web-llm@${WEBLLM_VERSION}`, f16: model === choice.id, inWorker } },
    generate: (messages, g) =>
      timed(async (onDelta) => {
        let usage: WebLLMChunk["usage"] = null;
        const stream = await engine.chat.completions.create({ messages, stream: true, max_tokens: g.maxTokens, temperature: 0.2, stream_options: { include_usage: true } });
        const stop = () => void engine.interruptGenerate();
        g.signal.addEventListener("abort", stop, { once: true });
        try {
          for await (const ch of stream) {
            onDelta(ch.choices[0]?.delta?.content ?? "");
            if (ch.usage) usage = ch.usage;
          }
        } finally {
          g.signal.removeEventListener("abort", stop);
        }
        return { tokens: usage?.completion_tokens };
      }, g.signal),
    unload: async () => {
      await engine.unload().catch(() => {});
      worker?.terminate();
    },
  };
}

// CPU (WebAssembly) via wllama: llama.cpp in its own worker. GPU offload is turned off on purpose,
// this is the fallback for devices without WebGPU.
interface WllamaChunk {
  choices: { delta?: { content?: string | null } }[];
  usage?: { completion_tokens?: number } | null;
}
interface Wllama {
  setCompat(c: "default" | null, mode?: string): void;
  loadModelFromUrl(url: string, p: Record<string, unknown>): Promise<void>;
  createChatCompletion(p: Record<string, unknown>): Promise<void>;
  isMultithread(): boolean;
  getNumThreads(): number;
  exit(): Promise<void>;
}
interface WllamaLib {
  Wllama: new (paths: Record<string, string>, cfg?: Record<string, unknown>) => Wllama;
  LoggerWithoutDebug?: unknown;
}

export async function loadWllama(choice: ModelChoice, o: LoadOptions): Promise<Engine> {
  const t0 = performance.now();
  o.onProgress({ frac: null, text: `Loading wllama ${WLLAMA_VERSION} from the CDN…` });
  const lib = await untilAbort(importUrl<WllamaLib>(WLLAMA_URL), o.signal);
  const cachedBefore = await inOpfsCache(choice.url!.split("/").pop()!);
  const w = new lib.Wllama({ default: WLLAMA_WASM }, { parallelDownloads: 3, suppressNativeLog: true, ...(lib.LoggerWithoutDebug ? { logger: lib.LoggerWithoutDebug } : {}) });
  // Safari and older browsers lack JSPI / memory64: wllama then needs its compat build (from the CDN)
  w.setCompat("default");
  let downloadEnd: number | null = null;
  let bytes: number | null = null;
  const progressCallback = ({ loaded, total }: { loaded: number; total: number }) => {
    bytes = total || loaded;
    if (total && loaded >= total) downloadEnd ??= performance.now();
    o.onProgress({ frac: total ? loaded / total : null, text: `Downloading model: ${Math.round(loaded / 1048576)} / ${total ? Math.round(total / 1048576) : "?"} MB` });
  };
  try {
    const params = { n_ctx: 2048, n_gpu_layers: 0, ...(globalThis.crossOriginIsolated ? {} : { n_threads: 1 }), progressCallback, signal: o.signal };
    await untilAbort(w.loadModelFromUrl(choice.url!, params), o.signal);
  } catch (e) {
    await w.exit().catch(() => {});
    throw e;
  }
  const loadEnd = performance.now();
  const cached = cachedBefore ?? bytes === null;
  const downloadMs = cached ? 0 : downloadEnd === null ? null : (downloadEnd as number) - t0;
  let threads: number | null = null;
  try {
    threads = w.getNumThreads();
  } catch {
    /* older builds */
  }
  return {
    report: {
      model: choice.id,
      cached,
      downloadMB: cached ? 0 : bytes === null ? null : Math.round((bytes as number) / 1048576),
      downloadMs,
      loadMs: downloadMs === null ? loadEnd - t0 : loadEnd - t0 - downloadMs,
      detail: { library: `@wllama/wllama@${WLLAMA_VERSION}`, multithread: (() => { try { return w.isMultithread(); } catch { return null; } })(), threads, gpuLayers: 0 },
    },
    generate: (messages, g) =>
      timed(async (onDelta) => {
        let tokens: number | undefined;
        await w.createChatCompletion({
          messages,
          stream: true,
          max_tokens: g.maxTokens,
          temperature: 0.2,
          abortSignal: g.signal,
          onData: (ch: WllamaChunk) => {
            onDelta(ch.choices?.[0]?.delta?.content ?? "");
            if (ch.usage?.completion_tokens) tokens = ch.usage.completion_tokens;
          },
        });
        return { tokens };
      }, g.signal),
    unload: () => w.exit().catch(() => {}),
  };
}

/** wllama keeps downloads in OPFS "cache/" as `<sha1 of url>_<file name>`; null when OPFS is unreadable. */
async function inOpfsCache(fileName: string): Promise<boolean | null> {
  try {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle("cache");
    for await (const name of (dir as unknown as { keys(): AsyncIterable<string> }).keys()) if (name.endsWith(`_${fileName}`)) return true;
    return false;
  } catch (e) {
    return (e as DOMException)?.name === "NotFoundError" ? false : null;
  }
}

// Chrome's built-in model (Prompt API). Chrome owns the download; each question gets a fresh
// session holding the instruction and any earlier exchange, so cases never leak into each other.
interface LMSession {
  promptStreaming(input: string, o?: { signal?: AbortSignal }): ReadableStream<string>;
  destroy(): void;
}
interface LMStatic {
  availability(o?: Record<string, unknown>): Promise<string>;
  create(o?: Record<string, unknown>): Promise<LMSession>;
}
const chromeLM = () => (globalThis as { LanguageModel?: LMStatic }).LanguageModel ?? null;
const LM_LANG = { expectedInputs: [{ type: "text", languages: ["en"] }], expectedOutputs: [{ type: "text", languages: ["en"] }] };

export async function loadChrome(_choice: ModelChoice, o: LoadOptions): Promise<Engine> {
  const LM = chromeLM();
  if (!LM) throw new Error("LanguageModel is not available in this browser");
  const t0 = performance.now();
  const before = await LM.availability(LM_LANG).catch(() => LM.availability());
  let lastProgress: number | null = null;
  o.onProgress({ frac: null, text: before === "available" ? "Starting the built-in model…" : "Chrome is downloading its model…" });
  const warm = await untilAbort(
    LM.create({
      ...LM_LANG,
      signal: o.signal,
      monitor(m: EventTarget) {
        m.addEventListener("downloadprogress", (e) => {
          lastProgress = performance.now();
          o.onProgress({ frac: (e as Event & { loaded: number }).loaded, text: "Chrome is downloading its model…" });
        });
      },
    }),
    o.signal,
  );
  warm.destroy();
  const loadEnd = performance.now();
  const downloadMs = before === "available" ? 0 : lastProgress === null ? null : (lastProgress as number) - t0;
  return {
    report: { model: "LanguageModel (Chrome built-in)", cached: before === "available", downloadMB: null, downloadMs, loadMs: downloadMs === null ? loadEnd - t0 : loadEnd - t0 - downloadMs, detail: { availabilityBefore: before } },
    generate: (messages, g) =>
      timed(async (onDelta) => {
        const last = messages[messages.length - 1];
        const s = await LM.create({ ...LM_LANG, signal: g.signal, initialPrompts: messages.slice(0, -1) });
        const cut = new AbortController();
        const stop = () => cut.abort();
        g.signal.addEventListener("abort", stop, { once: true });
        let seen = "";
        let chunks = 0;
        try {
          const reader = s.promptStreaming(last.content, { signal: cut.signal }).getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            // older Chrome streamed the whole answer so far; newer streams just the new text
            const delta = value.startsWith(seen) && seen ? value.slice(seen.length) : value;
            seen += delta;
            onDelta(delta);
            // no max-tokens option here: stop at the same budget the other engines get
            if (++chunks >= g.maxTokens) {
              cut.abort();
              break;
            }
          }
        } catch (e) {
          if (!cut.signal.aborted || g.signal.aborted) throw e;
        } finally {
          g.signal.removeEventListener("abort", stop);
          s.destroy();
        }
      }, g.signal),
    unload: async () => {},
  };
}

export const LOADERS: Record<EngineId, (c: ModelChoice, o: LoadOptions) => Promise<Engine>> = { transformers: loadTransformers, webllm: loadWebLLM, wllama: loadWllama, chrome: loadChrome };

/** Removes what the libraries cached: Transformers.js and web-llm Cache API stores, wllama's OPFS folder. */
export async function clearModels(): Promise<string[]> {
  const done: string[] = [];
  if ("caches" in globalThis) {
    for (const k of await caches.keys()) {
      if (/webllm|tvmjs|wllama|transformers/i.test(k) && (await caches.delete(k))) done.push(`cache "${k}"`);
    }
  }
  try {
    const root = await navigator.storage.getDirectory();
    await (root as FileSystemDirectoryHandle & { removeEntry(n: string, o?: { recursive?: boolean }): Promise<void> }).removeEntry("cache", { recursive: true });
    done.push("OPFS cache folder");
  } catch {
    /* nothing stored, or no OPFS */
  }
  if ("indexedDB" in globalThis && indexedDB.databases) {
    for (const db of await indexedDB.databases().catch(() => [])) {
      if (db.name && /webllm|tvmjs/i.test(db.name)) {
        indexedDB.deleteDatabase(db.name);
        done.push(`database "${db.name}"`);
      }
    }
  }
  return done;
}

/** Samples the JS heap (Chrome only) until stopped; returns the peak in MB. */
export function heapSampler(): { stop(): number | null } {
  const mem = () => (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null;
  let peak = mem();
  const t = setInterval(() => {
    const m = mem();
    if (m !== null && (peak === null || m > peak)) peak = m;
  }, 500);
  return {
    stop() {
      clearInterval(t);
      const m = mem();
      if (m !== null && (peak === null || m > peak)) peak = m;
      return peak === null ? null : Math.round(peak / 1048576);
    },
  };
}
