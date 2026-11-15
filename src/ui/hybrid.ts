// The hybrid avoid reader: one guest message in, what the guest says they avoid out (allergens,
// diets, meats, no alcohol), read by Gemini Nano on this device when Chrome has it and by a cloud
// model through Firebase AI Logic when it doesn't. The menu brain adds the reading to its own rules'
// (src/server/ai/brain/hint.ts): it can only make an answer more careful.
//
// Firebase is loaded only when the reader first runs, so pages that never use it don't pay for it.
// On-device inference needs desktop Chrome 139+ with the Prompt API enabled; everywhere else the
// same call goes to the cloud model.
import type { GenerativeModel } from "firebase/ai";
import { HINT_SCHEMA, HINT_SYSTEM, parseHint, type AvoidHint, type HintSource } from "../shared/brain/avoidHint";
import { CLOUD_MODEL, CLOUD_MODELS, FIREBASE_CONFIG, RECAPTCHA_PROVIDER, RECAPTCHA_SITE_KEY } from "./hybridConfig";

export type ReaderMode = "prefer_on_device" | "only_on_device" | "only_in_cloud";
export interface HintResult {
  hint: AvoidHint;
  source: HintSource;
  ms: number;
}

/** Whether the reader can run here at all (a reCAPTCHA key is set for App Check, or a debug token). */
export const readerEnabled = () => !!RECAPTCHA_SITE_KEY || debugToken() !== undefined;

/** An App Check debug token for local testing (set in localStorage by a developer, never shipped). */
function debugToken(): string | boolean | undefined {
  try {
    const t = globalThis.localStorage?.getItem("bf-appcheck-debug");
    return t ? (t === "true" ? true : t) : undefined;
  } catch {
    return undefined;
  }
}

let ready: Promise<typeof import("firebase/ai") & { app: import("firebase/app").FirebaseApp; check: import("firebase/app-check").AppCheck; getToken: typeof import("firebase/app-check").getToken }> | null = null;
// Google's free tier allows few cloud requests a minute and a day, per project. When it says "over quota",
// the cloud is left alone until its retry time (the device model, which has no quota, carries on), so a
// guest's answer never waits on a request that will be refused.
const PAUSE_KEY = "bf-cloud-pause";
let pausedUntil = (() => {
  try {
    return Number(globalThis.localStorage?.getItem(PAUSE_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
})();
/** Milliseconds until the cloud model may be asked again (0: now). */
export const cloudPause = () => Math.max(0, pausedUntil - Date.now());
/** Google's "Please retry in 1h18m45.8s" / "retry in 34.5s", in ms (default a minute). */
export function retryAfter(message: string): number {
  const m = message.match(/retry in ((?:\d+h)?(?:\d+m)?(?:[\d.]+s)?)/i)?.[1] ?? "";
  const part = (u: string) => Number(m.match(new RegExp(`([\\d.]+)${u}`))?.[1] ?? 0);
  const ms = (part("h") * 3600 + part("m") * 60 + part("s")) * 1000;
  return ms > 0 ? Math.min(ms, 24 * 3600_000) : 60_000;
}
function pauseCloud(message: string) {
  pausedUntil = Date.now() + retryAfter(message);
  try {
    globalThis.localStorage?.setItem(PAUSE_KEY, String(pausedUntil));
  } catch {
    /* (a private window: the pause lasts this page only) */
  }
}
let deviceReady: boolean | null = null;

/** Why the reader last failed, for the /hybrid page's status (guests never see it). */
let lastError = "";
export const readerError = () => lastError;
function firebase() {
  ready ??= (async () => {
    const [{ getApps, initializeApp }, { getToken, initializeAppCheck, ReCaptchaEnterpriseProvider, ReCaptchaV3Provider }, ai] = await Promise.all([import("firebase/app"), import("firebase/app-check"), import("firebase/ai")]);
    const app = getApps()[0] ?? initializeApp(FIREBASE_CONFIG);
    const debug = debugToken();
    if (debug !== undefined) (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = debug;
    const key = RECAPTCHA_SITE_KEY || "debug";
    const check = initializeAppCheck(app, { provider: RECAPTCHA_PROVIDER === "enterprise" ? new ReCaptchaEnterpriseProvider(key) : new ReCaptchaV3Provider(key), isTokenAutoRefreshEnabled: true });
    return { ...ai, app, check, getToken };
  })();
  return ready;
}

/** The cloud model in use: the default, or one of CLOUD_MODELS named in the page's ?model= (for comparing them). */
export function cloudModel(): string {
  try {
    const asked = new URLSearchParams(globalThis.location?.search ?? "").get("model");
    return asked && asked in CLOUD_MODELS ? asked : CLOUD_MODEL;
  } catch {
    return CLOUD_MODEL;
  }
}

const models = new Map<ReaderMode, Promise<GenerativeModel>>();
function model(mode: ReaderMode): Promise<GenerativeModel> {
  let m = models.get(mode);
  if (!m) {
    m = firebase().then(({ app, getAI, getGenerativeModel, GoogleAIBackend, ThinkingLevel }) =>
      getGenerativeModel(getAI(app, { backend: new GoogleAIBackend() }), {
        mode,
        inCloudParams: {
          model: cloudModel(),
          systemInstruction: HINT_SYSTEM,
          // (reading a few words into a fixed vocabulary needs no deliberation: with the model's default thinking a reading took ~10 s)
          generationConfig: { temperature: 0, thinkingConfig: { thinkingLevel: ThinkingLevel[CLOUD_MODELS[cloudModel()] ?? "MINIMAL"] }, responseMimeType: "application/json", responseJsonSchema: HINT_SCHEMA as unknown as Record<string, unknown> },
        },
        onDeviceParams: {
          createOptions: {
            initialPrompts: [{ role: "system", content: [{ type: "text", value: HINT_SYSTEM }] }],
            expectedInputs: [{ type: "text", languages: ["en"] }],
            expectedOutputs: [{ type: "text", languages: ["en"] }],
          },
          promptOptions: { responseConstraint: HINT_SCHEMA },
        },
      }),
    );
    models.set(mode, m);
  }
  return m;
}

/** Chrome's own word on its on-device model: "available", "downloadable", "downloading", "unavailable", or "none" (no Prompt API here). */
export async function deviceModelStatus(): Promise<string> {
  const lm = (globalThis as unknown as { LanguageModel?: { availability: (o?: unknown) => Promise<string> } }).LanguageModel;
  if (!lm) return "none";
  try {
    return await lm.availability({ expectedInputs: [{ type: "text", languages: ["en"] }], expectedOutputs: [{ type: "text", languages: ["en"] }] });
  } catch {
    return "unavailable";
  }
}

/** Start (or finish) the on-device model's download. Chrome wants this on a user's click or tap. */
export async function prepareDevice(onProgress?: (share: number) => void): Promise<void> {
  if (!readerEnabled() || (await deviceModelStatus()) === "none") return;
  const m = await model("prefer_on_device");
  await m.initializeDeviceModel(onProgress);
}

/** What `message` says the guest avoids, or null when the reader is off, fails or takes too long (the rules answer alone). */
export async function readAvoid(message: string, mode: ReaderMode = "prefer_on_device", timeoutMs = 8000): Promise<HintResult | null> {
  if (!readerEnabled() || !message.trim()) return null;
  // the cloud is over its quota: the device model alone, if this device has one
  if (mode !== "only_on_device" && cloudPause() > 0) {
    deviceReady ??= (await deviceModelStatus()) === "available";
    if (!deviceReady) {
      lastError = `the cloud model's free quota is used up; it is asked again in ${Math.ceil(cloudPause() / 60_000)} min`;
      return null;
    }
    mode = "only_on_device";
  }
  // one budget for everything (App Check's token, loading Firebase, the model): past it, the rules answer alone
  const deadline = performance.now() + timeoutMs;
  const left = () => Math.max(0, deadline - performance.now());
  const late = <T,>(p: Promise<T>) => Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error("timeout")), left()))]);
  try {
    // App Check guards the cloud model only: when the device's model answers, a refused or unreachable App
    // Check (a kiosk offline, a browser reCAPTCHA doubts) doesn't stop it
    const onDevice = mode === "only_on_device" || (mode === "prefer_on_device" && (await deviceModelStatus()) === "available");
    if (onDevice) await late(firebase());
    else {
      const ready = await late(warmReader());
      if (ready !== "ok") throw new Error(ready);
    }
    const m = await late(model(onDevice ? "only_on_device" : mode));
    const t0 = performance.now();
    const result = await late(m.generateContent(`Message: ${message.slice(0, 600)}\nJSON:`));
    const hint = parseHint(result.response.text());
    if (!hint) {
      lastError = "the model's answer wasn't the JSON asked for";
      return null;
    }
    lastError = "";
    return { hint, source: result.response.inferenceSource === "on_device" ? "on_device" : "in_cloud", ms: Math.round(performance.now() - t0) };
  } catch (e) {
    lastError = errorText(e);
    const full = String((e as { message?: string })?.message ?? e);
    if (/\b429\b|RESOURCE_EXHAUSTED|exceeded your current quota/i.test(full)) pauseCloud(full);
    return null;
  }
}

const errorText = (e: unknown) => String((e as { message?: string })?.message ?? e).replace(/\s+/g, " ").slice(0, 240);

let warming: Promise<string> | null = null;
/** Load Firebase and get App Check's first token ahead of the first question (call when a page that reads opens). */
export function warmReader(): Promise<string> {
  if (!readerEnabled()) return Promise.resolve("off");
  warming ??= appCheckStatus().then((r) => {
    if (r !== "ok") warming = null;
    return r;
  });
  return warming;
}

/** Whether App Check gives this browser a token (what the cloud model needs): "ok", or why not. */
export async function appCheckStatus(): Promise<string> {
  if (!readerEnabled()) return "off";
  try {
    const { check, getToken } = await firebase();
    await getToken(check, false);
    return "ok";
  } catch (e) {
    return errorText(e);
  }
}
