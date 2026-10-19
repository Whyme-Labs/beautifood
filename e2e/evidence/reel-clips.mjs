// Reel clips · short, sharp screen recordings of the real app for the music video (video/).
//
//   PORT=5190 ./scripts/e2e-server.sh &          # fresh production build on :5190
//   REEL_LANG=en node e2e/evidence/reel-clips.mjs              # every clip, app in English
//   REEL_LANG=zh node e2e/evidence/reel-clips.mjs p-join d-pos # just these, app in 中文
//
// Every clip is recorded in one language, so each video speaks one language throughout.
// Output: video/public/reel-clips/<lang>/<name>.mp4 (H.264, yuv420p, crf 18, keyframe every 0.5 s,
// no audio) and video/src/reel/cues/<lang>.json (duration + key moments with the bounding box of
// the important element, in video pixels), which the video project reads to time its camera.
//
// Why not Playwright's recordVideo: it scales the CSS-pixel screencast up to the video size and
// encodes VP8 at ~1 Mbit/s, so text is soft. Here Chromium runs with a real device scale factor
// (--force-device-scale-factor, matching the context's deviceScaleFactor), so CDP
// Page.startScreencast delivers frames at device resolution; each frame is kept with its
// timestamp and ffmpeg assembles them into a constant 30 fps H.264 file.
import { chromium, request } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LANG = process.env.REEL_LANG === "zh" ? "zh" : "en";
const OUT = path.join(ROOT, "video/public/reel-clips", LANG);
const CUES = path.join(ROOT, "video/src/reel/cues", `${LANG}.json`);
const BASE = `http://127.0.0.1:${process.env.E2E_PORT ?? 5190}`;
const TRUSTED = { "x-auth-trusted-key": process.env.AUTH_TRUSTED_KEY ?? "e2e-trusted" };
const EXE = process.env.PW_CHROMIUM ?? (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);

const PHONE = { viewport: { width: 390, height: 844 }, dsf: 3, mobile: true };
const DESKTOP = { viewport: { width: 1440, height: 900 }, dsf: 2, mobile: false };
const TV = { viewport: { width: 1280, height: 720 }, dsf: 1.5, mobile: false };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let seq = 0;
const uid = (p = "x") => `${p}${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

/** What the script types and clicks, per language (labels match src/i18n/locales). */
const L = {
  en: {
    restaurant: "Auntie Lim's Kitchen",
    queue: [["Aisha", 2], ["Ravi", 1], ["Siew Ling", 2], ["Daniel Tan", 4], ["Priya", 3], ["Kumar family", 6], ["Hafiz", 2]],
    queue2: [["Jia Hui", 2], ["Marcus", 4], ["Farah", 2]],
    board: [["Lim family", 4], ["Nurul", 2], ["Jason", 2], ["Mei Ling", 1], ["Arjun", 3], ["Tan family", 6], ["Wei", 2]],
    joiner: "Mei", waiter: "Ben", diners: ["Ann", "Ben"],
    more: "More people", namePh: "What should we call you?", getNumber: "Get my number",
    yourName: "Your name", start: "Start ordering", add: /^Add/,
    askOpen: /Ask what to eat/, askLabel: "Ask the menu assistant",
    allergy: "I'm allergic to peanuts, what can I eat?", signatures: "What are your signatures?",
    call: "Call", seat: "Seat", called: "Called", pax: "pax",
    openDrawer: "Open drawer", openSince: "Open since", promoCode: "Promo code", apply: "Apply", promoApplied: "Promo applied",
    discount: /^Discount/, cashTendered: "Cash tendered", payCash: "Pay cash", change: "Change",
    owner: "Faye Wong", setupName: "Faye's Noodle Bar", cuisine: "Hong Kong noodles", branch: "Damansara", create: "Create restaurant",
    menuText: "NOODLES\n★ Wonton Mee - RM12.90 - egg noodles, char siu, prawn wontons\nPan Mee 11.50\nDRINKS\nLime Juice - 5.00",
    floorText: "4 two-seaters and 2 tables of 4", generate: "Generate my setup",
    refresh: /Refresh machine translations/, translate: "Translate menu",
    reports: "Reports", hourly: "Sales by hour", bestSellers: "Best sellers",
  },
  zh: {
    restaurant: "林阿姨小厨",
    queue: [["李明", 2], ["王芳", 1], ["林秀玲", 2], ["陈大伟", 4], ["黄美华", 3], ["张家", 6], ["刘洋", 2]],
    queue2: [["吴佳慧", 2], ["郑浩", 4], ["何婷", 2]],
    board: [["林家", 4], ["周敏", 2], ["杨杰", 2], ["许美玲", 1], ["马超", 3], ["陈家", 6], ["孙伟", 2]],
    joiner: "小美", waiter: "小明", diners: ["美美", "小明"],
    more: "增加人数", namePh: "我们该怎么称呼你？", getNumber: "取号",
    yourName: "你的名字", start: "开始点餐", add: /^加入/,
    askOpen: /问问吃什么/, askLabel: "向菜单助手提问",
    allergy: "我对花生过敏，可以吃什么？", signatures: "招牌菜是什么？",
    call: "叫号", seat: "入座", called: "已叫号", pax: "位",
    openDrawer: "开钱箱", openSince: "开箱", promoCode: "优惠码", apply: "使用", promoApplied: "优惠码已使用",
    discount: /^折扣/, cashTendered: "收现金", payCash: "现金付款", change: "找零",
    owner: "王芳", setupName: "阿芳云吞面", cuisine: "港式面食", branch: "白沙罗", create: "创建餐厅",
    menuText: "面食\n★ 云吞面 - RM12.90 - 蛋面、叉烧、鲜虾云吞\n板面 11.50\n饮料\n酸柑水 - 5.00",
    floorText: "4张两人桌，2张四人桌", generate: "生成我的设置",
    refresh: /重新机器翻译/, translate: "翻译菜单",
    reports: "报表", hourly: "每小时营业额", bestSellers: "畅销菜",
  },
}[LANG];

// ───────────────────────────── API helpers (same calls as e2e/helpers.ts) ─────────────────────────────

async function ok(r, status) {
  const res = await r;
  const body = await res.text();
  if (status ? res.status() !== status : !res.ok()) throw new Error(`${res.url()} → ${res.status()} ${body.slice(0, 300)}`);
  return body ? JSON.parse(body) : null;
}

async function staffClient(name = "Olivia Tan", email = `${uid("owner")}@test.co`) {
  const api = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { ...TRUSTED, origin: BASE } });
  await ok(api.post("/api/auth/sign-up/email", { data: { email, password: "password-123456", name } }), 200);
  return { api, email };
}

async function guest(device = uid("dev-")) {
  return request.newContext({ baseURL: BASE, extraHTTPHeaders: { ...TRUSTED, "x-device": device } });
}

/** Fresh two-branch demo restaurant (KLCC + Bangsar) owned by a new user. */
async function seedRestaurant(name) {
  const { api, email } = await staffClient("Olivia Tan");
  let r = await api.post(`/api/dev/seed?name=${encodeURIComponent(name)}`);
  if (r.status() !== 201) r = await api.post(`/api/dev/seed?name=${encodeURIComponent(`${name} ${uid("").slice(-3).toUpperCase()}`)}`);
  const s = await ok(r, 201);
  const m = await ok(api.get("/api/m/menu"));
  const item = (n) => {
    const i = m.items.find((x) => x.name === n);
    if (!i) throw new Error(`no menu item ${n}`);
    return i;
  };
  return { owner: api, ownerEmail: email, tenantId: s.tenantId, slug: s.slug, klcc: s.branches[0], bangsar: s.branches[1], menu: m, item };
}

async function tables(api, branchId) {
  const ts = await ok(api.get(`/api/m/branches/${branchId}/tables`));
  return Object.fromEntries(ts.map((t) => [t.label, t]));
}

async function join(ref, partySize, name, extra = {}) {
  const g = await guest();
  return ok(g.post(`/api/public/branches/${ref}/queue`, { data: { partySize, name, ...extra } }));
}

async function seat(api, branchId, tableIds, partySize = 2) {
  const r = await ok(api.post(`/api/m/branches/${branchId}/seat`, { data: { partySize, tableIds } }), 201);
  return { ...r, token: new URL(BASE + r.sessionUrl).searchParams.get("k") };
}

/** Order lines [[name, qty]] — required modifier groups (Teh Tarik's Temperature) get Iced/first option. */
function lines(s, list) {
  return list.map(([n, qty]) => {
    const it = s.item(n);
    const modifiers = (it.modifiers ?? []).filter((g) => g.min >= 1).map((g) => ({ group: g.name, option: (g.options.find((o) => o.name === "Iced") ?? g.options[0]).name }));
    return { itemId: it.id, qty, ...(modifiers.length ? { modifiers } : {}) };
  });
}

async function order(s, branchId, label, list, party = 2) {
  const t = await tables(s.owner, branchId);
  const st = await seat(s.owner, branchId, [t[label].id], party);
  const o = await ok(s.owner.post(`/api/m/branches/${branchId}/orders`, { data: { seatingId: st.seatingId, items: lines(s, list) } }), 201);
  return { ...o, seatingId: st.seatingId };
}

/** A whole meal: seat, order, serve, pay by card, close the table, clean it — counts as today's sales. */
async function sale(s, branchId, label, list, method = "card") {
  const o = await order(s, branchId, label, list);
  const full = await ok(s.owner.get(`/api/m/branches/${branchId}/orders/${o.id}`));
  await ok(s.owner.post(`/api/m/branches/${branchId}/kitchen/status`, { data: { itemIds: full.items.map((i) => i.id), status: "served" } })).catch(() => undefined);
  await ok(s.owner.post(`/api/m/branches/${branchId}/orders/${o.id}/pay`, { data: { method, amount: full.due ?? full.total, ...(method === "cash" ? { tendered: Math.ceil((full.due ?? full.total) / 5000) * 5000 } : {}), msgId: uid() } }));
  await ok(s.owner.post(`/api/m/branches/${branchId}/seatings/${o.seatingId}/close`, { data: {} })).catch(() => undefined);
  const t = await tables(s.owner, branchId);
  await ok(s.owner.post(`/api/m/branches/${branchId}/tables/${t[label].id}/clean`, { data: {} })).catch(() => undefined);
  return o;
}

async function call(s, branchId, ticketId, holdLabels = []) {
  const t = await tables(s.owner, branchId);
  return ok(s.owner.post(`/api/m/branches/${branchId}/tickets/${ticketId}/call`, { data: { holdTableIds: holdLabels.map((l) => t[l].id) } }));
}

/** A busy lunch: queues in every line, tables eating, bills paid at both branches. */
async function busyRestaurant() {
  const s = await seedRestaurant(L.restaurant);
  log("seeded", s.slug);
  // Paid bills (today's sales) at both branches
  await sale(s, s.klcc.id, "T6", [["Char Kway Teow", 2], ["Teh Tarik", 2]]);
  await sale(s, s.klcc.id, "T7", [["Nasi Lemak Ayam Rempah", 2], ["Kopi O", 2], ["Cendol", 1]], "cash");
  await sale(s, s.klcc.id, "T8", [["Char Kway Teow", 1], ["Satay (6 sticks)", 1], ["Iced Barley", 2]]);
  await sale(s, s.klcc.id, "P5", [["Hainanese Chicken Rice", 3], ["Fresh Lime Juice", 3], ["Ais Kacang", 2]]);
  await sale(s, s.klcc.id, "P6", [["Penang Assam Laksa", 2], ["Curry Mee", 2], ["Teh Tarik", 4]]);
  await sale(s, s.bangsar.id, "T1", [["Hainanese Chicken Rice", 2], ["Ais Kacang", 1]]);
  await sale(s, s.bangsar.id, "T2", [["Penang Assam Laksa", 1], ["Char Kway Teow", 2], ["Kopi O", 2]], "cash");
  await sale(s, s.bangsar.id, "P1", [["Nasi Kerabu", 2], ["Curry Mee", 1], ["Cendol", 3]]);
  // Tables eating at KLCC (open bills, tickets on the kitchen display)
  s.open = {};
  s.open.T1 = await order(s, s.klcc.id, "T1", [["Char Kway Teow", 2], ["Teh Tarik", 1], ["Cendol", 1]]);
  s.open.T2 = await order(s, s.klcc.id, "T2", [["Nasi Kerabu", 1], ["Kopi O", 2], ["Ais Kacang", 1]]);
  s.open.P2 = await order(s, s.klcc.id, "P2", [["Nasi Lemak Ayam Rempah", 2], ["Satay (6 sticks)", 1], ["Rojak", 1], ["Teh Tarik", 2]], 4);
  s.open.P3 = await order(s, s.klcc.id, "P3", [["Hainanese Chicken Rice", 2], ["Curry Mee", 1], ["Fresh Lime Juice", 3]], 3);
  // Bangsar has a couple of tables eating too
  await order(s, s.bangsar.id, "T3", [["Char Kway Teow", 1], ["Teh Tarik", 1]]);
  // Queues: KLCC A (1–2), B (3–4), C (5–8); Bangsar
  s.q = {};
  for (const [n, p] of L.queue) s.q[n] = await join(s.klcc.ref, p, n, { lang: LANG });
  for (const [n, p] of L.queue2) await join(s.bangsar.ref, p, n, { lang: LANG });
  return s;
}

// ───────────────────────────── recording ─────────────────────────────

const browsers = new Map();
async function browserFor(dsf) {
  if (!browsers.has(dsf)) browsers.set(dsf, await chromium.launch({ executablePath: EXE, args: [`--force-device-scale-factor=${dsf}`, "--disable-gpu", "--hide-scrollbars"] }));
  return browsers.get(dsf);
}

/** A browser context + page for one device; `lang` sets the remembered language (bf_lang cookie). */
async function device(kind, { lang = LANG, auth, participant } = {}) {
  const b = await browserFor(kind.dsf);
  const ctx = await b.newContext({
    baseURL: BASE,
    viewport: kind.viewport,
    deviceScaleFactor: kind.dsf,
    isMobile: kind.mobile,
    hasTouch: kind.mobile,
    locale: lang === "zh" ? "zh-CN" : "en-MY",
    timezoneId: "Asia/Kuala_Lumpur",
    extraHTTPHeaders: TRUSTED,
  });
  await ctx.addCookies([{ name: "bf_lang", value: lang, url: BASE }]);
  await ctx.addInitScript(([l, p]) => {
    try {
      localStorage.setItem("bf.lang", l);
      localStorage.setItem("bf_lang", l);
      if (p && !localStorage.getItem("bf.participant")) localStorage.setItem("bf.participant", JSON.stringify(p));
    } catch {}
  }, [lang, participant ?? null]);
  if (auth) await ctx.addCookies((await auth.storageState()).cookies);
  const page = await ctx.newPage();
  page.on("dialog", (d) => void d.accept());
  return { ctx, page, kind };
}

async function go(page, url) {
  await page.goto(url + (url.includes("?") ? "&" : "?") + `lang=${LANG}`);
  await page.locator("html[data-hydrated]").waitFor();
  await settle(page);
}

/** Wait for fonts, images and a quiet network so the first frame is a finished page. */
async function settle(page, ms = 600) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.evaluate(() => document.fonts.ready).catch(() => undefined);
  await sleep(ms);
}

class Recorder {
  constructor(dev, name) {
    this.dev = dev;
    this.page = dev.page;
    this.name = name;
    this.dsf = dev.kind.dsf;
    this.size = { width: Math.round(dev.kind.viewport.width * this.dsf), height: Math.round(dev.kind.viewport.height * this.dsf) };
    this.frames = [];
    this.cues = [];
  }
  async start() {
    this.cdp = await this.dev.ctx.newCDPSession(this.page);
    this.cdp.on("Page.screencastFrame", (f) => {
      const arrived = Date.now() / 1000;
      const ts = f.metadata?.timestamp && Math.abs(f.metadata.timestamp - arrived) < 1 ? f.metadata.timestamp : arrived;
      if (!this.stopped) this.frames.push({ ts, data: f.data });
      this.cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => undefined);
    });
    // frame zero: the settled page, at device resolution
    const first = await this.cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 92 });
    this.frames.push({ ts: Date.now() / 1000, data: first.data });
    await this.cdp.send("Page.startScreencast", { format: "jpeg", quality: Number(process.env.REEL_Q ?? 92), maxWidth: this.size.width, maxHeight: this.size.height, everyNthFrame: 1 });
  }
  now() {
    return Math.round((Date.now() / 1000 - this.t0) * 100) / 100;
  }
  /** Record a key moment now; `target` (a Locator) gives the box of the important element. */
  async cue(label, target) {
    const t = this.now();
    let box = null;
    if (target) {
      const b = await target.filter({ visible: true }).first().boundingBox({ timeout: 2000 }).catch(() => null);
      if (b) {
        const x0 = Math.max(0, Math.round(b.x * this.dsf));
        const y0 = Math.max(0, Math.round(b.y * this.dsf));
        const x1 = Math.min(this.size.width, Math.round((b.x + b.width) * this.dsf));
        const y1 = Math.min(this.size.height, Math.round((b.y + b.height) * this.dsf));
        if (x1 > x0 && y1 > y0) box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      }
    }
    this.cues.push({ label, t, box });
    log(`  ${this.name} @${t.toFixed(2)}s ${label}`, box ? JSON.stringify(box) : "");
  }
  async stop(end) {
    this.end = end ?? Date.now() / 1000;
    this.stopped = true;
    await this.cdp.send("Page.stopScreencast").catch(() => undefined);
  }
  /** Frames (variable rate) → constant 30 fps H.264. */
  encode() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `reel-${this.name}-`));
    const all = this.frames.filter((f) => f.ts < this.end).sort((a, b) => a.ts - b.ts);
    // the newest frame from before t0 stands for the start of the clip
    const before = all.filter((f) => f.ts <= this.t0).at(-1);
    const frames = [...(before ? [before] : []), ...all.filter((f) => f.ts > this.t0)];
    let list = "";
    frames.forEach((f, i) => {
      const file = path.join(dir, `f${String(i).padStart(5, "0")}.jpg`);
      fs.writeFileSync(file, Buffer.from(f.data, "base64"));
      const start = i === 0 ? this.t0 : f.ts;
      const next = i + 1 < frames.length ? frames[i + 1].ts : this.end;
      list += `file '${file}'\nduration ${Math.max(0.001, next - start).toFixed(4)}\n`;
    });
    list += `file '${path.join(dir, `f${String(frames.length - 1).padStart(5, "0")}.jpg`)}'\n`;
    fs.writeFileSync(path.join(dir, "list.txt"), list);
    const duration = Math.round((this.end - this.t0) * 100) / 100;
    const out = path.join(OUT, `${this.name}.mp4`);
    const { width: W, height: H } = this.size;
    execFileSync(
      "ffmpeg",
      ["-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt"),
        "-vf", `scale=${W}:${H}:flags=lanczos,fps=30,format=yuv420p`, "-t", duration.toFixed(2),
        "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-g", "15", "-keyint_min", "15", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", "-an", out],
      { stdio: "inherit" },
    );
    fs.rmSync(dir, { recursive: true, force: true });
    const effFps = frames.length / duration;
    if (process.env.REEL_DEBUG) log("  frame times:", frames.map((f) => Math.max(0, f.ts - this.t0).toFixed(2)).join(" "));
    log(`  → ${path.relative(ROOT, out)} ${W}x${H} ${duration}s ${(fs.statSync(out).size / 1e6).toFixed(1)} MB (${frames.length} captured frames, ${effFps.toFixed(1)}/s)`);
    return { file: `${this.name}.mp4`, width: W, height: H, duration, cues: this.cues };
  }
}

/** Record one or more devices in sync: `body` gets recorders started at the same t0. */
async function record(names, devs, body) {
  const recs = devs.map((d, i) => new Recorder(d, names[i]));
  for (const r of recs) await r.start();
  await sleep(300);
  const t0 = Date.now() / 1000;
  for (const r of recs) r.t0 = t0;
  await sleep(400);
  await body(...recs);
  const end = Date.now() / 1000;
  for (const r of recs) await r.stop(end);
  const out = recs.map((r) => r.encode());
  for (const d of devs) await d.ctx.close().catch(() => undefined);
  return out;
}

const type = (loc, text, delay = 70) => loc.pressSequentially(text, { delay });
async function tap(loc, pause = 250) {
  await loc.scrollIntoViewIfNeeded();
  await loc.hover().catch(() => undefined);
  await sleep(120);
  await loc.click();
  await sleep(pause);
}
/** Scroll the target into view, record the cue with its box, then tap it. */
async function cueTap(r, label, loc, pause = 250, boxOf = loc) {
  await loc.scrollIntoViewIfNeeded();
  await r.cue(label, boxOf);
  await tap(loc, pause);
}
async function smoothScroll(page, dy, ms) {
  // eased scroll driven by requestAnimationFrame inside the page (no per-step input round trips)
  await page.evaluate(
    ([dy, ms]) =>
      new Promise((done) => {
        const el = document.scrollingElement;
        const from = el.scrollTop;
        const t0 = performance.now();
        const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
        const step = (now) => {
          const p = Math.min(1, (now - t0) / ms);
          el.scrollTop = from + dy * ease(p);
          if (p < 1) requestAnimationFrame(step);
          else done();
        };
        requestAnimationFrame(step);
      }),
    [dy, ms],
  );
}

// ───────────────────────────── clips ─────────────────────────────

const tablesOf = (text) => (text.match(/(?:pax|位)\s*(?:to|→)?\s*([TP]\d+[ab]?(?:\s*\+\s*[TP]\d+[ab]?)*)/)?.[1] ?? "").split("+").map((x) => x.trim()).filter(Boolean);

const CLIPS = {
  // Phone: branch page → + → name → Get my number → ticket
  async "p-join"(w) {
    const d = await device(PHONE);
    const { page } = d;
    await go(page, `/r/${w.klcc.ref}`);
    await page.getByPlaceholder(L.namePh).evaluate((el) => el.closest("section").scrollIntoView({ block: "center" }));
    await settle(page, 400);
    return record(["p-join"], [d], async (r) => {
      const plus = page.getByRole("button", { name: L.more });
      await r.cue("tap +", plus.first());
      await tap(plus.first(), 500);
      const name = page.getByPlaceholder(L.namePh);
      await tap(name, 150);
      await r.cue("type name", name);
      await type(name, L.joiner, 140);
      await sleep(400);
      const btn = page.getByRole("button", { name: L.getNumber });
      await r.cue("tap Get my number", btn);
      await tap(btn, 0);
      await page.waitForURL(/\/ticket\//);
      await page.getByTestId("ticket-number").waitFor();
      await settle(page, 0);
      await r.cue("ticket number appears", page.getByTestId("ticket-number"));
      // the first view can come from the 2 s shared board cache; the next poll has the place in line
      await page.waitForFunction(() => document.querySelector(".ticket-fields b.serial")?.textContent?.trim() !== "0", null, { timeout: 8000 }).catch(() => undefined);
      await sleep(300);
      await r.cue("ahead + wait", page.locator(".ticket-fields").or(page.getByTestId("ticket-wait")).first());
      await sleep(1500);
    });
  },

  // Phone: ticket → the host calls it → "table ready"
  async "p-ticket-called"(w) {
    const tk = await join(w.klcc.ref, 2, L.waiter, { lang: LANG });
    const d = await device(PHONE);
    const { page } = d;
    await go(page, tk.url);
    await page.getByTestId("ticket-number").waitFor();
    // time the call so it lands just before the page's next 4 s poll
    const polled = () => page.waitForResponse((res) => res.url().includes(`/api/public/tickets/${tk.ticket.id}`), { timeout: 15_000 });
    await polled();
    await polled();
    await sleep(1200);
    return record(["p-ticket-called"], [d], async (r) => {
      await r.cue("waiting ticket", page.getByTestId("ticket-stub"));
      await sleep(1100);
      await call(w, w.klcc.id, tk.ticket.id, ["T4"]);
      await r.cue("host calls (API)");
      await page.getByTestId("ticket-called").waitFor({ timeout: 15_000 });
      await sleep(150);
      await r.cue("table ready", page.getByTestId("ticket-called"));
      await r.cue("ticket stub (called)", page.getByTestId("ticket-stub"));
      await sleep(2600);
    });
  },

  // Phone: ticket → preorder → add 2 dishes → save
  async "p-preorder"(w) {
    const tk = await join(w.klcc.ref, 2, L.waiter, { lang: LANG });
    const d = await device(PHONE, { participant: { id: `p-${uid()}`, name: L.waiter } });
    const { page } = d;
    await go(page, tk.url);
    return record(["p-preorder"], [d], async (r) => {
      await r.cue("tap preorder", page.getByTestId("preorder"));
      await tap(page.getByTestId("preorder"), 0);
      await page.waitForURL(/\/s\//);
      await page.locator("html[data-hydrated]").waitFor();
      const nameInput = page.getByLabel(L.yourName);
      await Promise.race([page.getByTestId("menu-list").waitFor(), nameInput.waitFor()]);
      if (await nameInput.isVisible().catch(() => false)) {
        await type(nameInput, L.waiter, 120);
        await tap(page.getByRole("button", { name: L.start }), 200);
      }
      await page.getByTestId("menu-list").waitFor();
      await settle(page, 300);
      await r.cue("preorder menu", page.getByTestId("menu-list"));
      const ckt = page.getByTestId("dish").filter({ hasText: "Char Kway Teow" });
      await r.cue("add Char Kway Teow", ckt);
      await tap(ckt.getByRole("button", { name: L.add }), 500);
      const cendol = page.getByTestId("dish").filter({ hasText: "Cendol" });
      await cendol.scrollIntoViewIfNeeded();
      await r.cue("add Cendol", cendol);
      await tap(cendol.getByRole("button", { name: L.add }), 400);
      await page.getByTestId("tab-cart").filter({ hasText: "2" }).waitFor();
      await r.cue("cart (2)", page.getByTestId("send-order"));
      await tap(page.getByTestId("tab-cart"), 600);
      await r.cue("cart lines", page.getByTestId("cart"));
      await tap(page.getByTestId("send-order"), 0);
      await page.getByTestId("sent-item").nth(1).waitFor();
      await page.getByTestId("sent-item").first().scrollIntoViewIfNeeded();
      await sleep(200);
      await r.cue("preorder saved", page.getByTestId("bill"));
      await sleep(2000);
    });
  },

  // Two phones at one table: the shared cart updates live on both
  async "p-cart"(w) {
    const t = await tables(w.owner, w.klcc.id);
    const st = await seat(w.owner, w.klcc.id, [t.T5.id], 2);
    const a = await device(PHONE);
    const b = await device(PHONE);
    await go(a.page, st.sessionUrl);
    await go(b.page, st.sessionUrl);
    const A = a.page;
    const B = b.page;
    const an = A.getByLabel(L.yourName);
    const bn = B.getByLabel(L.yourName);
    await an.waitFor();
    await bn.waitFor();
    const [nameA, nameB] = L.diners;
    return record(["p-cart-a", "p-cart-b"], [a, b], async (ra, rb) => {
      await ra.cue("A types name", an);
      await rb.cue("B types name", bn);
      await Promise.all([type(an, nameA, 140), type(bn, nameB, 160)]);
      await Promise.all([tap(A.getByRole("button", { name: L.start }), 0), tap(B.getByRole("button", { name: L.start }), 0)]);
      await A.getByTestId("menu-list").waitFor();
      await B.getByTestId("menu-list").waitFor();
      await sleep(400);
      const adish = (n) => A.getByTestId("dish").filter({ hasText: n });
      const bdish = (n) => B.getByTestId("dish").filter({ hasText: n });
      await Promise.all([
        cueTap(ra, "A adds Char Kway Teow", adish("Char Kway Teow").getByRole("button", { name: L.add }), 350, adish("Char Kway Teow")),
        cueTap(rb, "B adds Cendol", bdish("Cendol").getByRole("button", { name: L.add }), 350, bdish("Cendol")),
      ]);
      await Promise.all([
        cueTap(ra, "A adds Nasi Lemak", adish("Nasi Lemak Ayam Rempah").getByRole("button", { name: L.add }), 200, adish("Nasi Lemak Ayam Rempah")),
        cueTap(rb, "B adds Satay", bdish("Satay").getByRole("button", { name: L.add }), 200, bdish("Satay")),
      ]);
      // live: each phone's cart count reaches 4 (two of the dishes were added on the other phone)
      await Promise.all([
        A.getByTestId("tab-cart").filter({ hasText: "4" }).waitFor({ timeout: 20_000 }).then(() => ra.cue("cart picks up the other phone's dishes (4)", A.getByTestId("send-order"))),
        B.getByTestId("tab-cart").filter({ hasText: "4" }).waitFor({ timeout: 20_000 }).then(() => rb.cue("cart picks up the other phone's dishes (4)", B.getByTestId("send-order"))),
      ]);
      await sleep(400);
      await Promise.all([tap(A.getByTestId("tab-cart"), 0), tap(B.getByTestId("tab-cart"), 0)]);
      await sleep(300);
      await ra.cue("cart view (grouped by person)", A.getByTestId("cart"));
      await rb.cue("cart view (grouped by person)", B.getByTestId("cart"));
      await sleep(1800);
    });
  },

  // Phone: Ask what to eat → peanut allergy → safe picks + safety note
  async "p-assistant"(w) {
    return assistantClip(w, "p-assistant", L.allergy, true);
  },

  // Phone: the same assistant, asked for the signatures
  async "p-signatures"(w) {
    return assistantClip(w, "p-signatures", L.signatures, false);
  },

  // Phone: the menu scrolling slowly, allergen filter open
  async "p-menu"(w) {
    const d = await device(PHONE);
    const { page } = d;
    await go(page, `/r/${w.klcc.ref}/menu`);
    // open the allergen filter so its chips are on screen
    await page.locator("details summary").first().click().catch(() => undefined);
    await settle(page, 300);
    const midDish = async () => {
      const i = await page.getByTestId("dish").evaluateAll((els) => els.findIndex((e) => e.getBoundingClientRect().top > innerHeight * 0.3));
      return page.getByTestId("dish").nth(Math.max(0, i));
    };
    return record(["p-menu"], [d], async (r) => {
      await r.cue("allergen filter chips", page.locator("details").first());
      await sleep(700);
      await r.cue("first dish", page.getByTestId("dish").first());
      await smoothScroll(page, 450, 2000);
      await r.cue("dish", await midDish());
      await smoothScroll(page, 600, 2600);
      await r.cue("dish card", await midDish());
      await sleep(700);
    });
  },

  // Desktop: host stand → Call one suggestion → Seat another → floor updates
  async "d-host"(w) {
    const d = await device(DESKTOP, { auth: w.owner });
    const { page } = d;
    await go(page, "/m/host");
    await page.getByTestId("suggestion").first().waitFor();
    await settle(page, 400);
    return record(["d-host"], [d], async (r) => {
      const sugg = page.getByTestId("suggestion");
      await r.cue("suggestions", sugg.first());
      await sleep(900);
      const callBtn = (row) => row.getByRole("button", { name: L.call, exact: true });
      const toCall = sugg.filter({ has: page.getByRole("button", { name: L.call, exact: true }) }).first();
      const callNum = (await toCall.textContent()).match(/[A-Z]\d{3}/)?.[0];
      const callTables = tablesOf(await toCall.textContent());
      await r.cue("Call", callBtn(toCall));
      await tap(callBtn(toCall), 0);
      await page.getByTestId("ticket-row").filter({ hasText: callNum }).filter({ hasText: L.called }).waitFor();
      await r.cue("called: table held on the floor", page.getByTestId(`table-${callTables[0]}`));
      await sleep(1000);
      const toSeat = sugg.filter({ hasNotText: callNum }).first();
      const seatNum = (await toSeat.textContent()).match(/[A-Z]\d{3}/)?.[0];
      const seatTables = tablesOf(await toSeat.textContent());
      const seatBtn = toSeat.getByRole("button", { name: L.seat, exact: true });
      await r.cue("Seat", seatBtn);
      await tap(seatBtn, 0);
      await page.getByTestId("ticket-row").filter({ hasText: seatNum }).waitFor({ state: "detached" });
      const tile = seatTables.length ? page.getByTestId(`table-${seatTables[0]}`) : page.locator(".tbl.seated").first();
      await r.cue("floor: seated", tile);
      await sleep(2200);
    });
  },

  // Desktop: kitchen display → bump an item → All ready → Served
  async "d-kitchen"(w) {
    const d = await device(DESKTOP, { auth: w.owner });
    const { page } = d;
    await go(page, "/m/kitchen");
    await page.getByTestId("kds-ticket").first().waitFor();
    await settle(page, 400);
    return record(["d-kitchen"], [d], async (r) => {
      const tk = page.getByTestId("kds-ticket").filter({ hasText: "T1" }).first();
      // hold on to this exact ticket: another one can match the same text once it is gone
      const el = await tk.elementHandle();
      await r.cue("tickets", page.getByTestId("kds"));
      await sleep(800);
      const ckt = tk.locator("li").filter({ hasText: "Char Kway Teow" });
      await r.cue("bump → cooking", ckt);
      await tap(ckt.locator(".kds-bump"), 700);
      await r.cue("bump → ready", ckt);
      await tap(ckt.locator(".kds-bump"), 700);
      const allReady = tk.locator("button.btn.primary.big");
      await r.cue("all ready", allReady);
      await tap(allReady, 0);
      const served = tk.locator("button.btn.sun.big");
      await served.waitFor();
      await sleep(500);
      await r.cue("served button", served);
      await tap(served, 0);
      await page.waitForFunction((e) => !e.isConnected, el, { timeout: 15_000 });
      await r.cue("ticket cleared", page.getByTestId("kds"));
      await sleep(1800);
    });
  },

  // Desktop: POS → open bill → promo WELCOME10 → cash with tendered → change toast
  async "d-pos"(w) {
    const d = await device(DESKTOP, { auth: w.owner });
    const { page } = d;
    await go(page, "/m/pos");
    const o = w.open.P2;
    // a cash drawer must be open for cash payments
    if (await page.getByRole("button", { name: L.openDrawer }).isVisible().catch(() => false)) {
      page.removeAllListeners("dialog");
      page.once("dialog", (dl) => void dl.accept("200.00"));
      await page.getByRole("button", { name: L.openDrawer }).click();
      await page.getByTestId("shift").filter({ hasText: L.openSince }).waitFor();
      page.on("dialog", (dl) => void dl.accept());
    }
    await settle(page, 400);
    return record(["d-pos"], [d], async (r) => {
      const billBtn = page.getByTestId("open-bills").getByRole("button").filter({ hasText: o.number });
      await r.cue("select bill", billBtn);
      await tap(billBtn, 500);
      const bill = page.getByTestId("bill");
      await page.getByTestId("bill-item").first().waitFor();
      await r.cue("bill open", bill);
      const promo = bill.getByLabel(L.promoCode);
      await tap(promo, 100);
      await type(promo, "WELCOME10", 80);
      await tap(bill.getByRole("button", { name: L.apply }), 0);
      await page.getByText(L.promoApplied).first().waitFor();
      await r.cue("promo applied (discount line)", bill.getByText(L.discount).first());
      await sleep(700);
      const pay = page.getByTestId("pay-panel");
      const tendered = pay.getByLabel(L.cashTendered);
      await tap(tendered, 100);
      await type(tendered, "100", 120);
      await sleep(300);
      await r.cue("change preview", pay.locator(".pos-change"));
      await sleep(350);
      await tap(pay.getByRole("button", { name: L.payCash }), 0);
      const toast = page.getByTestId("toast").filter({ hasText: L.change });
      await toast.waitFor();
      await r.cue("change toast", toast);
      await sleep(1600);
    });
  },

  // Desktop: AI setup for a brand-new restaurant
  async "d-setup"() {
    const { api } = await staffClient(L.owner);
    const d = await device(DESKTOP, { auth: api });
    const { page } = d;
    await go(page, "/m/setup");
    const C = { en: ["Restaurant name", "Cuisine", "First branch"], zh: ["餐厅名称", "菜系", "第一家分店"] }[LANG];
    await page.getByLabel(C[0]).fill(L.setupName);
    await page.getByLabel(C[1]).fill(L.cuisine).catch(() => undefined);
    await page.getByLabel(C[2]).fill(L.branch);
    await page.getByRole("button", { name: L.create }).click();
    await page.getByTestId("menu-text").waitFor();
    await settle(page, 400);
    return record(["d-setup"], [d], async (r) => {
      const menu = page.getByTestId("menu-text");
      await r.cue("paste menu", menu);
      await tap(menu, 0);
      await menu.fill(L.menuText);
      await sleep(700);
      const floor = page.getByTestId("floor-text");
      await r.cue("describe floor", floor);
      await tap(floor, 100);
      await type(floor, L.floorText, LANG === "zh" ? 90 : 35);
      await sleep(300);
      const gen = page.getByRole("button", { name: L.generate });
      await r.cue("Generate my setup", gen);
      await tap(gen, 0);
      await page.getByTestId("draft-item").first().waitFor({ timeout: 30_000 });
      await sleep(200);
      await r.cue("draft items appear", page.getByTestId("draft-item").first());
      const apply = page.getByTestId("apply-draft");
      await page.getByTestId("draft-table").first().scrollIntoViewIfNeeded();
      await smoothScroll(page, 300, 600);
      await r.cue("draft tables", page.getByTestId("draft-table").first());
      await sleep(500);
      await apply.scrollIntoViewIfNeeded();
      await r.cue("Apply", apply);
      await tap(apply, 0);
      await page.getByTestId("setup-done").waitFor({ timeout: 30_000 });
      await page.getByTestId("setup-done").scrollIntoViewIfNeeded();
      await r.cue("applied", page.getByTestId("setup-done"));
      await sleep(1800);
    });
  },

  // Desktop: menu → Translate menu → result, and the translated dishes below
  async "d-translate"(w) {
    const d = await device(DESKTOP, { auth: w.owner });
    const { page } = d;
    await go(page, "/m/menu");
    const box = page.getByTestId("menu-translate");
    await box.waitFor();
    await box.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 150));
    await settle(page, 300);
    return record(["d-translate"], [d], async (r) => {
      const refresh = box.getByLabel(L.refresh);
      if (await refresh.count()) await tap(refresh, 200);
      const btn = box.getByRole("button", { name: L.translate });
      await r.cue("Translate menu", btn);
      await tap(btn, 0);
      await page.getByTestId("translate-result").waitFor({ timeout: 30_000 });
      await sleep(200);
      await r.cue("translation result", page.getByTestId("translate-result"));
      await sleep(1500);
      await smoothScroll(page, 380, 1200);
      await r.cue("dishes", page.locator("main").first());
      await sleep(1600);
    });
  },

  // Desktop: boss dashboard (2 branches, sales, insights) → Reports
  async "d-boss"(w) {
    const d = await device(DESKTOP, { auth: w.owner });
    const { page } = d;
    await go(page, "/m");
    await page.getByTestId("branch-overview").waitFor();
    await settle(page, 600);
    return record(["d-boss"], [d], async (r) => {
      await r.cue("today across both branches (totals)", page.getByTestId("totals"));
      await sleep(600);
      await r.cue("branch cards", page.getByTestId("branch-overview"));
      await smoothScroll(page, 420, 1300);
      await r.cue("AI insights", page.getByTestId("insights"));
      await sleep(900);
      const rep = page.getByTestId("staff-nav").getByRole("link", { name: L.reports, exact: true });
      await r.cue("click Reports", rep);
      await tap(rep, 0);
      await page.waitForURL(/\/m\/reports/);
      await page.getByTestId("report-sales").waitFor();
      await settle(page, 100);
      await r.cue("report KPIs", page.getByTestId("report-sales"));
      await r.cue("sales by hour chart", page.locator(".card").filter({ hasText: L.hourly }).last());
      await sleep(1100);
      await smoothScroll(page, 560, 1100);
      await r.cue("best sellers & menu engineering", page.locator(".card").filter({ hasText: L.bestSellers }).last());
      await sleep(1400);
    });
  },

  // TV board 1920×1080: two tickets get called (via the host API)
  async "d-display"() {
    // its own restaurant, so the board starts with nobody called
    const v = await seedRestaurant(L.restaurant);
    const [[n1, p1], [n2, p2], ...rest] = L.board;
    const first = await join(v.klcc.ref, p1, n1, { lang: LANG });
    const second = await join(v.klcc.ref, p2, n2, { lang: LANG });
    for (const [n, p] of rest) await join(v.klcc.ref, p, n, { lang: LANG });
    const d = await device(TV);
    const { page } = d;
    await go(page, `/r/${v.klcc.ref}/display`);
    const now = page.getByTestId("now-calling");
    const card = (num) => now.locator(".calling", { hasText: num }).locator("xpath=..");
    return record(["d-display"], [d], async (r) => {
      await r.cue("board: nobody called yet", now);
      await sleep(900);
      await call(v, v.klcc.id, first.ticket.id, ["P1"]);
      await card(first.ticket.number).waitFor({ timeout: 15_000 });
      await sleep(150);
      await r.cue("first called", card(first.ticket.number));
      await sleep(1800);
      await call(v, v.klcc.id, second.ticket.id, ["T2"]);
      await card(second.ticket.number).waitFor({ timeout: 15_000 });
      await sleep(150);
      await r.cue("second called", card(second.ticket.number));
      await sleep(2200);
    });
  },
};

async function assistantClip(w, name, question, safety) {
  const d = await device(PHONE);
  const { page } = d;
  await go(page, `/r/${w.klcc.ref}`);
  const open = page.getByRole("button", { name: L.askOpen });
  await open.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await settle(page, 300);
  return record([name], [d], async (r) => {
    await cueTap(r, "tap Ask what to eat", open, 500);
    const input = page.getByLabel(L.askLabel);
    await input.waitFor();
    await tap(input, 100);
    await r.cue("type question", input);
    await type(input, question, LANG === "zh" ? 150 : 45);
    await sleep(250);
    await input.press("Enter");
    const ans = page.getByTestId("assistant-answer");
    await ans.first().waitFor({ timeout: 30_000 });
    await sleep(200);
    await r.cue("answer appears", ans.first());
    await sleep(700);
    if (safety) {
      const note = ans.first().getByTestId("safety-note");
      await note.scrollIntoViewIfNeeded().catch(() => undefined);
      await sleep(300);
      await r.cue("safety note", note);
    } else {
      await smoothScroll(page, 250, 600);
      await r.cue("recommended dishes", ans.first());
    }
    await sleep(2200);
  });
}

// ───────────────────────────── main ─────────────────────────────

const ORDER = ["p-join", "p-ticket-called", "p-preorder", "p-cart", "p-assistant", "p-signatures", "p-menu", "d-kitchen", "d-pos", "d-host", "d-display", "d-translate", "d-boss", "d-setup"];
const wanted = process.argv.slice(2).map((n) => (n.startsWith("p-cart") ? "p-cart" : n));
const run = wanted.length ? ORDER.filter((n) => wanted.includes(n)) : ORDER;

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.dirname(CUES), { recursive: true });
const cuesFile = CUES;
const cues = fs.existsSync(cuesFile) ? JSON.parse(fs.readFileSync(cuesFile, "utf8")) : { clips: {} };
let world;
try {
  if (run.some((n) => n !== "d-setup")) world = await busyRestaurant();
  for (const name of run) {
    log(`● ${name}`);
    let res;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        res = await CLIPS[name](world);
        break;
      } catch (e) {
        log(`  ${name} attempt ${attempt} failed: ${e.message.split("\n")[0]}`);
        if (attempt === 2) throw e;
        world = await busyRestaurant();
      }
    }
    for (const c of res) {
      cues.clips[c.file.replace(/\.mp4$/, "")] = { file: c.file, width: c.width, height: c.height, fps: 30, duration: c.duration, cues: c.cues };
    }
    cues.lang = LANG;
    cues.note = "t = seconds from the start of the clip; box = {x,y,w,h} of the key element in video pixels at that moment (CSS box × deviceScaleFactor).";
    fs.writeFileSync(cuesFile, JSON.stringify(cues, null, 2) + "\n");
  }
} finally {
  for (const b of browsers.values()) await b.close().catch(() => undefined);
}
log("done →", path.relative(ROOT, cuesFile));
