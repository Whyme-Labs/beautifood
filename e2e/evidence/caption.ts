// Caption bar for the evidence videos: a fixed yellow strip that says what the viewer is
// watching. It survives navigations (an init script redraws it from sessionStorage on every
// document) and never intercepts clicks (pointer-events: none).
import type { Page } from "@playwright/test";

const KEY = "__evidence_caption";

interface Cap {
  title: string;
  text: string;
  big: boolean;
}

/** Self-contained (serialized into the page): store the caption if given, then draw it. */
function paint(arg: { key: string; cap: Cap | null }) {
  const w = window as unknown as { __evCap?: Cap };
  let cap = arg.cap;
  if (cap) {
    w.__evCap = cap;
    try {
      sessionStorage.setItem(arg.key, JSON.stringify(cap));
    } catch {
      /* opaque origins (setContent, about:blank) have no storage */
    }
  } else {
    try {
      const raw = sessionStorage.getItem(arg.key);
      if (raw) cap = JSON.parse(raw) as Cap;
    } catch {
      /* ignore */
    }
    cap = cap ?? w.__evCap ?? null;
  }
  if (!cap) return;
  const c = cap;
  const draw = () => {
    const host = document.body ?? document.documentElement;
    if (!host) return;
    let el = document.getElementById("__evidence_caption");
    if (!el) {
      el = document.createElement("div");
      el.id = "__evidence_caption";
      el.setAttribute("aria-hidden", "true");
      host.appendChild(el);
    }
    el.setAttribute(
      "style",
      [
        "position:fixed",
        "left:0",
        "right:0",
        "bottom:0",
        "z-index:2147483647",
        "pointer-events:none",
        "background:#ffd12e",
        "color:#1a1814",
        "border-top:3px solid #1a1814",
        "box-shadow:0 -6px 18px rgba(26,24,20,.25)",
        `padding:${c.big ? "12px 22px 14px" : "8px 12px 10px"}`,
        "font-family:Figtree Variable, Figtree, system-ui, -apple-system, 'PingFang SC', 'Noto Sans CJK SC', sans-serif",
        "line-height:1.25",
        "text-align:left",
      ].join(";"),
    );
    // The text lives in CSS generated content, so it never matches the test's text locators.
    el.dataset.title = c.title;
    el.dataset.text = c.text;
    if (!document.getElementById("__evidence_caption_style")) {
      const st = document.createElement("style");
      st.id = "__evidence_caption_style";
      st.textContent =
        "#__evidence_caption::before{content:attr(data-title);display:block;font-weight:800;letter-spacing:.06em;text-transform:uppercase;opacity:.75;margin-bottom:2px;font-size:var(--evt)}" +
        "#__evidence_caption::after{content:attr(data-text);display:block;font-weight:700;font-size:var(--evb);white-space:pre-wrap}";
      (document.head ?? host).appendChild(st);
    }
    el.style.setProperty("--evt", c.big ? "14px" : "11px");
    el.style.setProperty("--evb", c.big ? "25px" : "17px");
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", draw, { once: true });
  else draw();
}

export interface Captioner {
  (text: string): Promise<void>;
}

/**
 * Install the caption bar on a page. Returns a setter: `await say("Guest joins the queue")`.
 * `who` is the small label above the text (persona and device).
 */
export async function captions(page: Page, who: string, opts: { big?: boolean } = {}): Promise<Captioner> {
  const big = opts.big ?? (page.viewportSize()?.width ?? 0) >= 700;
  await page.addInitScript(paint, { key: KEY, cap: null });
  let n = 0;
  return async (text: string) => {
    n++;
    const cap: Cap = { title: `${who} · ${n}`, text, big };
    // also redraw after the next navigation, in case it is already under way
    await page.evaluate(paint, { key: KEY, cap }).catch(() => undefined);
    await beat(page, 700);
  };
}

/** A pause so a human watching the video can follow (and the screencast catches the frame). */
export async function beat(page: Page, ms = 1200) {
  await page.waitForTimeout(ms);
}
