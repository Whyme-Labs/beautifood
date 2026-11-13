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
import { CLOUD_MODEL, FIREBASE_CONFIG, RECAPTCHA_PROVIDER, RECAPTCHA_SITE_KEY } from "./hybridConfig";

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

let ready: Promise<typeof import("firebase/ai") & { app: import("firebase/app").FirebaseApp }> | null = null;
function firebase() {
  ready ??= (async () => {
    const [{ getApps, initializeApp }, { initializeAppCheck, ReCaptchaEnterpriseProvider, ReCaptchaV3Provider }, ai] = await Promise.all([import("firebase/app"), import("firebase/app-check"), import("firebase/ai")]);
    const app = getApps()[0] ?? initializeApp(FIREBASE_CONFIG);
    const debug = debugToken();
    if (debug !== undefined) (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = debug;
    const key = RECAPTCHA_SITE_KEY || "debug";
    initializeAppCheck(app, { provider: RECAPTCHA_PROVIDER === "enterprise" ? new ReCaptchaEnterpriseProvider(key) : new ReCaptchaV3Provider(key), isTokenAutoRefreshEnabled: true });
    return { ...ai, app };
  })();
  return ready;
}

const models = new Map<ReaderMode, Promise<GenerativeModel>>();
function model(mode: ReaderMode): Promise<GenerativeModel> {
  let m = models.get(mode);
  if (!m) {
    m = firebase().then(({ app, getAI, getGenerativeModel, GoogleAIBackend }) =>
      getGenerativeModel(getAI(app, { backend: new GoogleAIBackend() }), {
        mode,
        inCloudParams: {
          model: CLOUD_MODEL,
          systemInstruction: HINT_SYSTEM,
          generationConfig: { temperature: 0, responseMimeType: "application/json", responseJsonSchema: HINT_SCHEMA as unknown as Record<string, unknown> },
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
  const t0 = performance.now();
  try {
    const m = await model(mode);
    const result = await Promise.race([
      m.generateContent(`Message: ${message.slice(0, 600)}\nJSON:`),
      new Promise<never>((_, no) => setTimeout(() => no(new Error("timeout")), timeoutMs)),
    ]);
    const hint = parseHint(result.response.text());
    if (!hint) return null;
    return { hint, source: result.response.inferenceSource === "on_device" ? "on_device" : "in_cloud", ms: Math.round(performance.now() - t0) };
  } catch {
    return null;
  }
}
