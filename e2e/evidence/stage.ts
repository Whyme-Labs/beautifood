// Recorded browser contexts for the evidence videos. Each persona gets its own context with
// its own video file in test-results/<test>/video-<name>/, which scripts/evidence-videos.sh
// converts to docs/evidence/videos/<name>.mp4.
import type { Browser, BrowserContext, Dialog, Page, TestInfo } from "@playwright/test";
import { captions, type Captioner } from "./caption";
import { BASE } from "../helpers";

export const PHONE = { width: 390, height: 844 };
export const DESKTOP = { width: 1366, height: 860 };
export const TABLET = { width: 820, height: 1180 };
export const TV = { width: 1280, height: 720 };

export interface Actor {
  name: string;
  ctx: BrowserContext;
  page: Page;
  say: Captioner;
  /** Answers queued for window.prompt/confirm (in order); alerts are recorded in `alerts`. */
  answers: string[];
  alerts: string[];
}

const open: BrowserContext[] = [];

/** A recorded browser for one persona (the video is the viewport size, 1 CSS px = 1 video px). */
export async function actor(browser: Browser, info: TestInfo, name: string, who: string, viewport: { width: number; height: number }, opts: { mobile?: boolean } = {}): Promise<Actor> {
  const mobile = opts.mobile ?? viewport.width < 500;
  const ctx = await browser.newContext({
    baseURL: BASE,
    viewport,
    deviceScaleFactor: 1,
    isMobile: mobile,
    hasTouch: mobile,
    locale: "en-MY",
    timezoneId: "Asia/Kuala_Lumpur",
    extraHTTPHeaders: { "x-auth-trusted-key": process.env.AUTH_TRUSTED_KEY ?? "e2e-trusted" },
    recordVideo: { dir: info.outputPath(`video-${name}`), size: viewport },
  });
  open.push(ctx);
  const page = await ctx.newPage();
  const a: Actor = { name, ctx, page, say: await captions(page, who), answers: [], alerts: [] };
  page.on("dialog", (d: Dialog) => {
    if (d.type() === "alert") {
      a.alerts.push(d.message());
      void d.accept();
    } else if (d.type() === "prompt") void d.accept(a.answers.shift() ?? d.defaultValue());
    else void d.accept();
  });
  return a;
}

/** Close every recorded context so the videos are flushed to disk. */
export async function wrap() {
  while (open.length) await open.pop()!.close().catch(() => undefined);
}

/** Navigate and wait for React to hydrate (clicks and typing then reach the app). */
export async function go(page: Page, url: string) {
  await page.goto(url);
  await page.locator("html[data-hydrated]").waitFor();
}

/** Give a recorded browser the session of an API client that is already signed in. */
export async function signInAs(a: Actor, api: import("@playwright/test").APIRequestContext) {
  const state = await api.storageState();
  await a.ctx.addCookies(state.cookies);
}
