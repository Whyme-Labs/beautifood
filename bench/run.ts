// Scores an engine on the benchmark and keeps a trace of every case, so a failure can be followed to
// the stage that caused it: the intent model (with its probabilities), dish finding, constraint
// reading, the decision rules, ranking or wording.
//
//   npx tsx bench/run.ts [--engine brain|rules] [--split test|dev|all] [--data gold|parser] [--label name] [--fail]
//     [--tags bill,modifier] [--reader-url http://127.0.0.1:8080/v1 --reader-policy replace|fill --reader-cache file]
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { parseMenuText } from "../src/shared/menuParser";
import { answerGuest } from "../src/server/ai/brain";
import { read, understand, type Dish } from "../src/server/ai/brain/understand";
import { answerLocally, type AssistantContext } from "../src/server/ai/local";
import { withBranchHalal } from "../src/server/ai/halal";
import { menuNow, type Clock, type PriceRule, type TimedMenu, type Window } from "../src/shared/schedule";
import { halalStanding, type HalalInfo, type Menu, type ModifierGroup } from "../src/shared/types";
import { checkBasket, checkReading, type RawOrderReading } from "../src/server/ai/brain/reading";
import { openAiReader, readerSchema, readerSystem, type ReaderCall } from "../src/server/ai/brain/modelReader";
import { claims } from "./claims";
import type { Case, Expect } from "./schema";

const DIR = new URL(".", import.meta.url).pathname;
const arg = (k: string, d: string) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const ENGINE = arg("--engine", "brain");
// no default split: the test split is run once, on purpose, never by accident
const SPLIT = arg("--split", "");
const SET = arg("--set", "v1") as Set;
const DATA = arg("--data", "gold") as "gold" | "parser";
// only the cases with one of these tags (comma-separated), for a quicker run
const TAGS = arg("--tags", "") ? arg("--tags", "").split(",") : null;

type Item = AssistantContext["items"][number];

/** The benchmark's own reading of each dish (bench/menus/<menu>.gold.json), independent of any parser. */
export interface Gold {
  allergens: string[];
  vegetarian: boolean;
  vegan: boolean;
  halal: boolean;
  spice: number;
  note?: string;
}

/** Which case set: v1 (dev and test), v2 held-out, or v3 held-out (with its own menus, in v3/menus). */
export type Set = "v1" | "heldout" | "v3" | "v4" | "v5" | "v6" | "v7" | "v8" | "v9" | "v10" | "v11";
const menuFile = (menu: string, ext: string) => ["", "v3/", "v4/", "v5/", "v6/", "v7/", "v8/", "v9/", "v10/", "v11/"].map((d) => `${DIR}${d}menus/${menu}${ext}`).find((f) => existsSync(f)) ?? `${DIR}menus/${menu}${ext}`;

/**
 * What a branch's settings add to its menu (`<menu>.extra.json`, optional): dishes sold out, timed
 * menus and deals with their weekly windows, add-ons and sizes, what the till adds to a bill, and
 * the branch's halal standing. Dishes and categories are named as in the menu.
 */
export interface Extra {
  soldOut?: string[];
  menus?: { name: string; windows: Window[]; dishes: string[] }[];
  rules?: { name: string; kind: "percent" | "amount"; value: number; categories?: string[]; dishes?: string[]; windows: Window[] }[];
  modifiers?: Record<string, ModifierGroup[]>;
  charges?: AssistantContext["charges"];
  halal?: HalalInfo;
}
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** When a case without `at` is asked, on a menu with an extra file. */
export const DEFAULT_AT: NonNullable<Case["at"]> = { day: "Wed", time: "13:00", date: "2026-11-04" };
const clockOf = (at: NonNullable<Case["at"]>): Clock => {
  const [h, m] = at.time.split(":").map(Number);
  return { weekday: DAYS.indexOf(at.day), minutes: h * 60 + m, date: at.date };
};

export function loadGold(menu: string): Record<string, Gold> | null {
  const f = menuFile(menu, ".gold.json");
  return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as Record<string, Gold>) : null;
}

/**
 * A menu as the assistant sees it. With `source: "gold"` (the default) each dish carries the
 * benchmark's ground truth, so the assistant is scored on its own mistakes, not the parser's; with
 * "parser" it carries what the onboarding parser inferred, as a merchant who never reviewed it would.
 */
export function loadMenu(menu: string, source: "gold" | "parser" = "gold", at?: Case["at"]): AssistantContext {
  const zh = new Map<string, string>();
  const text = readFileSync(menuFile(menu, ".txt"), "utf8")
    .split("\n")
    .map((line) => {
      const [main, cn] = line.split(" | ");
      if (cn) zh.set(main.replace(/^★\s*/, "").split(" - ")[0].trim(), cn.trim());
      return main;
    })
    .join("\n");
  const items = parseMenuText(text).items.map((p, n) => ({
    id: `${menu}-${n}`,
    name: p.name,
    category: p.category,
    categoryId: p.category,
    description: p.description,
    price: p.price,
    allergens: p.allergens,
    dietary: p.dietary,
    spiceLevel: p.spiceLevel,
    isSignature: p.isSignature,
    station: p.station,
    imageUrl: null,
    story: "",
    tags: [],
    modifiers: [],
    active: true,
    sort: n,
    soldOut: false,
    popularity: 0,
    translations: zh.has(p.name) ? { zh: { name: zh.get(p.name)! } } : undefined,
  }));
  const gold = source === "gold" ? loadGold(menu) : null;
  if (gold)
    for (const i of items) {
      const g = gold[i.name];
      if (!g) throw new Error(`${menu}: no gold entry for "${i.name}"`);
      i.allergens = g.allergens as typeof i.allergens;
      i.dietary = [...(g.vegan ? ["vegan", "vegetarian"] : g.vegetarian ? ["vegetarian"] : []), ...(g.halal ? ["halal_friendly"] : [])] as typeof i.dietary;
      i.spiceLevel = g.spice;
    }
  const ctx = { restaurant: { name: "Test Kitchen", cuisine: "", story: "", description: "" }, branchName: "Main", currency: "MYR", menuLanguage: "en", items } as unknown as AssistantContext;
  const f = menuFile(menu, ".extra.json");
  return existsSync(f) ? withExtra(ctx, menu, JSON.parse(readFileSync(f, "utf8")) as Extra, at ?? DEFAULT_AT) : ctx;
}

/** The menu as the branch's settings leave it at a moment, as the server builds it (menuNow). */
function withExtra(ctx: AssistantContext, menu: string, x: Extra, at: NonNullable<Case["at"]>): AssistantContext {
  const byName = (n: string) => {
    const i = ctx.items.find((d) => d.name === n);
    if (!i) throw new Error(`${menu}.extra.json: no dish "${n}"`);
    return i;
  };
  const clock = clockOf(at);
  const menus: TimedMenu[] = (x.menus ?? []).map((m, k) => ({ id: `m${k}`, name: m.name, windows: m.windows, branches: ["*"], active: true, sort: k }));
  const rules: PriceRule[] = (x.rules ?? []).map((r, k) => ({ id: `r${k}`, name: r.name, kind: r.kind, value: r.value, categories: (r.categories ?? []).map((c) => ctx.items.find((d) => d.category?.toLowerCase() === c.toLowerCase())?.categoryId ?? c), items: (r.dishes ?? []).map((n) => byName(n).id), windows: r.windows, branches: ["*"], active: true }));
  const items = ctx.items.map((i) => ({
    ...i,
    menuIds: (x.menus ?? []).flatMap((m, k) => (m.dishes.includes(i.name) ? [`m${k}`] : [])),
    soldOut: (x.soldOut ?? []).includes(i.name),
    modifiers: x.modifiers?.[i.name] ?? [],
  }));
  for (const n of [...(x.soldOut ?? []), ...Object.keys(x.modifiers ?? {}), ...(x.menus ?? []).flatMap((m) => m.dishes)]) byName(n);
  const now = menuNow({ version: 1, categories: [], items, menus, rules } as unknown as Menu, "main", clock);
  const halal = x.halal ? { ...x.halal, standing: halalStanding(x.halal, clock.date ?? "") } : undefined;
  return { ...ctx, items: withBranchHalal(now.items as typeof ctx.items, halal), now: now.now, menus: now.menus, rules: now.rules, clock, charges: x.charges, halal };
}

/** `set`: "v1" (cases/, dev and test), "heldout" (heldout/, v2: new authors and menus, all test) "v3" or "v4" (v3/, v4/: the same again, each on its own menus). */
export function loadCases(split = "all", set: Set = "v1"): Case[] {
  const dir = `${DIR}${{ v1: "cases", heldout: "heldout", v3: "v3", v4: "v4", v5: "v5", v6: "v6", v7: "v7", v8: "v8", v9: "v9", v10: "v10", v11: "v11" }[set]}`;
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .flatMap((f) => JSON.parse(readFileSync(`${dir}/${f}`, "utf8")) as Case[])
    .filter((c) => split === "all" || c.split === split);
}

const veg = (i: Item) => i.dietary.includes("vegetarian") || i.dietary.includes("vegan");

/** Each failed check, and whether it's a safety failure. */
export function check(e: Expect, shown: Item[], answer: string, safetyNote: boolean): { failed: string[]; unsafe: boolean } {
  const failed: string[] = [];
  let unsafe = false;
  const names = shown.map((i) => i.name);
  for (const a of e.avoid ?? []) {
    const bad = shown.filter((i) => i.allergens.includes(a));
    if (bad.length) (failed.push(`avoid ${a}: ${bad.map((i) => i.name).join(", ")}`), (unsafe = true));
  }
  if (e.vegetarian && shown.some((i) => !veg(i))) (failed.push(`not vegetarian: ${shown.filter((i) => !veg(i)).map((i) => i.name).join(", ")}`), (unsafe = true));
  if (e.vegan && shown.some((i) => !i.dietary.includes("vegan"))) (failed.push("not vegan"), (unsafe = true));
  if (e.maxSpice !== undefined && shown.some((i) => i.spiceLevel > e.maxSpice!)) failed.push(`too spicy: ${shown.filter((i) => i.spiceLevel > e.maxSpice!).map((i) => i.name).join(", ")}`);
  if (e.minSpice !== undefined && shown.some((i) => i.spiceLevel < e.minSpice!)) failed.push("not spicy enough");
  if (e.maxPrice !== undefined && shown.some((i) => i.price > e.maxPrice!)) failed.push("over budget");
  if (e.maxTotal !== undefined && shown.reduce((s, i) => s + i.price, 0) > e.maxTotal) failed.push("over the total");
  if (e.category && shown.some((i) => !new RegExp(e.category!, "i").test(i.category ?? ""))) failed.push(`not ${e.category}: ${shown.filter((i) => !new RegExp(e.category!, "i").test(i.category ?? "")).map((i) => i.name).join(", ")}`);
  for (const n of e.includes ?? []) if (!names.includes(n)) failed.push(`missing ${n}`);
  if (e.includesAny?.length && !e.includesAny.some((n) => names.includes(n))) failed.push(`none of ${e.includesAny.join(" / ")}`);
  for (const n of e.excludes ?? []) if (names.includes(n)) failed.push(`shows ${n}`);
  if (e.onlyFrom && shown.some((i) => !e.onlyFrom!.includes(i.name))) failed.push(`outside the earlier dishes: ${shown.filter((i) => !e.onlyFrom!.includes(i.name)).map((i) => i.name).join(", ")}`);
  if (e.minDishes !== undefined && shown.length < e.minDishes) failed.push(`only ${shown.length} dishes`);
  if (e.maxDishes !== undefined && shown.length > e.maxDishes) failed.push(`${shown.length} dishes`);
  if (e.noDishes && shown.length) failed.push(`dishes shown: ${names.join(", ")}`);
  for (const re of e.says ?? []) if (!new RegExp(re, "i").test(answer)) failed.push(`doesn't say /${re}/`);
  if (e.safetyNote && !safetyNote) failed.push("no safety note");
  return { failed, unsafe };
}

/** Which stage a failure most likely came from, from the case, its trace and its failed checks. */
function stage(c: Case, t: Trace, failed: string[]): string {
  const e = c.expect;
  if (failed.every((f) => f.startsWith("claims "))) return "answer (claims)";
  const named = [...(e.includes ?? []), ...(e.includesAny ?? [])];
  if (failed.some((f) => f.startsWith("missing") || f.startsWith("none of")) && named.length && /dish_info|dish_allergen|compare|pairing/.test(c.tags.join(" ")) && !named.some((n) => t.dishes.includes(n))) return "dish finding";
  if (e.avoid?.length && failed.some((f) => f.startsWith("avoid")) && !e.avoid.every((a) => t.avoid.includes(a) || t.memoryAvoid.includes(a))) return "constraint reading (allergen)";
  if (e.vegetarian && failed.some((f) => f.startsWith("not vegetarian")) && !t.diet.includes("vegetarian") && !t.diet.includes("vegan")) return "constraint reading (diet)";
  if (e.maxSpice !== undefined && failed.some((f) => f.startsWith("too spicy")) && (t.maxSpice === null || t.maxSpice > e.maxSpice)) return "constraint reading (spice)";
  if (e.minSpice !== undefined && failed.some((f) => f.startsWith("not spicy")) && t.minSpice === null) return "constraint reading (spice)";
  if (e.maxPrice !== undefined && failed.includes("over budget") && t.budget === null) return "constraint reading (budget)";
  if (e.category && failed.some((f) => f.startsWith("not ")) && !t.courses.length) return "constraint reading (course)";
  if (c.tags.includes("followup") && failed.some((f) => f.startsWith("outside"))) return "follow-up (reference)";
  if ((e.noDishes || c.tags.includes("service")) && failed.some((f) => f.startsWith("dishes shown"))) return t.modelIntent === t.decided ? "intent model" : "decision rules";
  if (t.modelIntent !== t.decided) return "decision rules";
  return "answer (policy, ranking or wording)";
}

interface Trace {
  modelIntent: string;
  confidence: number;
  /** Top probability minus the second. */
  margin: number;
  /** Top logit minus the second: how far apart the model held its two best guesses. */
  logitGap: number;
  /** Entropy of the intent distribution, in bits (0 = certain, log2(12) ≈ 3.6 = no idea). */
  entropy: number;
  /** Open-set rejection overrode the logits (no word of the question was in training). */
  rejected: boolean;
  /** Every intent's raw logit. */
  logits: Record<string, number>;
  top3: [string, number][];
  decided: string;
  dishes: string[];
  avoid: string[];
  memoryAvoid: string[];
  diet: string[];
  maxSpice: number | null;
  minSpice: number | null;
  budget: number | null;
  courses: string[];
  delexicalized: string;
}

/** What a guest can order now, in the menu's order: the dishes a model reader is shown. */
export const readable = (ctx: AssistantContext) => ctx.items.filter((i) => i.active !== false && !i.soldOut && i.servedNow !== false) as unknown as Dish[];

/**
 * Each case's latest message read by a model (--reader-url), as the raw JSON it returned, cached in
 * --reader-cache by prompt and message so a run can be repeated without the model.
 */
export async function readAll(cases: Case[], data: "gold" | "parser", call: ReaderCall, cachePath: string, log = false): Promise<Map<string, RawOrderReading | null>> {
  const cache: Record<string, string> = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : {};
  const out = new Map<string, RawOrderReading | null>();
  const money = (n: number) => `RM${(n / 100).toFixed(2)}`;
  // (by menu, so the model server's prompt cache holds the menu between calls)
  const sorted = [...cases].sort((a, b) => `${a.menu}${JSON.stringify(a.at ?? null)}`.localeCompare(`${b.menu}${JSON.stringify(b.at ?? null)}`));
  let n = 0;
  for (const c of sorted) {
    const dishes = readable(loadMenu(c.menu, data, c.at));
    const system = readerSystem(dishes, money);
    const k = createHash("sha256").update(`${system}\n${c.question}`).digest("hex").slice(0, 24);
    if (!(k in cache)) {
      try {
        cache[k] = await call(system, `Message: ${c.question}\nJSON:`, readerSchema(dishes));
      } catch (e) {
        cache[k] = "";
        if (log) console.error(`reader failed on ${c.id}: ${(e as Error).message}`);
      }
      if (++n % 10 === 0) {
        writeFileSync(cachePath, JSON.stringify(cache));
        if (log) console.error(`read ${n}`);
      }
    }
    const json = cache[k].replace(/<think>[\s\S]*?<\/think>/g, "").match(/\{[\s\S]*\}/)?.[0];
    let raw: RawOrderReading | null = null;
    try {
      raw = json ? (JSON.parse(json) as RawOrderReading) : null;
    } catch {
      raw = null;
    }
    out.set(c.id, raw);
  }
  writeFileSync(cachePath, JSON.stringify(cache));
  return out;
}

export function runEngine(engine: string, cases: Case[], data: "gold" | "parser" = "gold", readings?: Map<string, RawOrderReading | null>, policy?: "replace" | "fill" | "merge", conv?: { baskets: Map<string, (RawOrderReading & { changed?: boolean }) | null>; policy: "replace" | "edits" }) {
  const menus = new Map<string, AssistantContext>();
  return cases.map((c) => {
    const key = `${c.menu} ${JSON.stringify(c.at ?? null)}`;
    const base = menus.get(key) ?? menus.set(key, loadMenu(c.menu, data, c.at)).get(key)!;
    const raw = readings?.get(c.id);
    let ctx: AssistantContext = raw && policy ? { ...base, reading: checkReading(raw, readable(base), () => true, c.question), readerPolicy: policy } : base;
    // a conversation reader's order as it stands after this turn (checked against the whole conversation)
    const basket = conv?.baskets.get(c.id);
    if (basket) ctx = { ...ctx, basket: checkBasket(basket, readable(base), () => true, [...(c.before ?? []).flatMap((b) => [b.user, b.assistant]), c.question]), basketChanged: basket.changed !== false, basketPolicy: conv!.policy };
    const history = [...(c.before ?? []).flatMap((b) => [{ role: "user" as const, content: b.user }, { role: "assistant" as const, content: b.assistant }]), { role: "user" as const, content: c.question }];
    const t0 = performance.now();
    let answer = "";
    let shownIds: string[] = [];
    let labels: { id: string; label?: string }[] = [];
    let note = false;
    let decided = "";
    let error: string | null = null;
    try {
      const r = engine === "rules" ? answerLocally(ctx, c.question, c.lang) : answerGuest(ctx, history, c.lang);
      answer = r.answer;
      shownIds = r.items.map((i) => i.id);
      labels = r.items;
      note = !!r.safetyNote;
      decided = (r as { intent?: string }).intent ?? "";
    } catch (e) {
      error = (e as Error).message;
    }
    const ms = performance.now() - t0;
    const shown = shownIds.map((id) => ctx.items.find((i) => i.id === id)!).filter(Boolean);
    const facts = error ? { failed: [`threw: ${error}`], unsafe: false } : check(c.expect, shown, answer, note);
    // what the answer's words claim about the dishes it names
    const said = error ? { failed: [], unsafe: false, read: 0 } : claims(answer, ctx.items, labels);
    const failed = [...facts.failed, ...said.failed];
    const unsafe = facts.unsafe || said.unsafe;
    // the trace: what the brain read (for the rules engine too, as a reference point)
    const u = understand(ctx.items as Dish[], c.question);
    const memory = (c.before ?? []).flatMap((b) => read(ctx.items as Dish[], b.user).avoid);
    const ranked = u.guess.ranked;
    const trace: Trace = {
      modelIntent: u.intent,
      confidence: +u.confidence.toFixed(3),
      margin: +(ranked[0].p - (ranked[1]?.p ?? 0)).toFixed(3),
      logitGap: +([...ranked].sort((a, b) => b.logit - a.logit).slice(0, 2).reduce((d, x, i) => (i ? d - x.logit : x.logit), 0)).toFixed(3),
      entropy: +(-ranked.reduce((h, x) => h + (x.p > 0 ? x.p * Math.log2(x.p) : 0), 0)).toFixed(3),
      rejected: u.guess.rejected,
      logits: Object.fromEntries(ranked.map((x) => [x.intent, +x.logit.toFixed(3)])),
      top3: ranked.slice(0, 3).map((x) => [x.intent, +x.p.toFixed(3)]),
      decided,
      dishes: u.dishes.map((d) => d.name),
      avoid: u.avoid,
      memoryAvoid: [...new Set(memory)],
      diet: u.diet,
      maxSpice: u.maxSpice,
      minSpice: u.minSpice,
      budget: u.budget,
      courses: u.courses,
      delexicalized: u.delexicalized.join(" "),
    };
    return { id: c.id, menu: c.menu, split: c.split, lang: c.lang, tags: c.tags, question: c.question, pass: !failed.length, unsafe, failed, stage: failed.length ? stage(c, trace, failed) : null, answer, shown: shown.map((i) => i.name), claimsRead: said.read, ms: +ms.toFixed(2), trace };
  });
}

type Row = ReturnType<typeof runEngine>[number];

export function summarise(rows: Row[]) {
  const pct = (xs: Row[]) => (xs.length ? +((100 * xs.filter((r) => r.pass).length) / xs.length).toFixed(1) : null);
  const group = (key: (r: Row) => string[]) => {
    const m = new Map<string, Row[]>();
    for (const r of rows) for (const k of key(r)) m.set(k, [...(m.get(k) ?? []), r]);
    return Object.fromEntries([...m].sort().map(([k, xs]) => [k, { n: xs.length, pass: pct(xs), unsafe: xs.filter((r) => r.unsafe).length }]));
  };
  const failing = rows.filter((r) => !r.pass);
  const stages = new Map<string, number>();
  for (const r of failing) stages.set(r.stage!, (stages.get(r.stage!) ?? 0) + 1);
  const ms = rows.map((r) => r.ms).sort((a, b) => a - b);
  // how sure the intent model was, on cases that passed and failed: a calibrated model is less sure when wrong
  const meanConf = (xs: Row[]) => (xs.length ? +(xs.reduce((s, r) => s + r.trace.confidence, 0) / xs.length).toFixed(3) : null);
  return {
    n: rows.length,
    pass: pct(rows),
    unsafe: rows.filter((r) => r.unsafe).length,
    safetyCases: rows.filter((r) => r.tags.includes("allergy") || r.tags.includes("diet") || r.tags.includes("dish_allergen")).length,
    p50ms: ms[Math.floor(ms.length / 2)],
    p99ms: ms[Math.floor(ms.length * 0.99)],
    byMenu: group((r) => [r.menu]),
    byLang: group((r) => [r.lang === "zh" ? "zh" : r.tags.includes("manglish") ? "manglish" : r.tags.includes("malay") ? "malay" : "en"]),
    byTag: group((r) => r.tags),
    failuresByStage: Object.fromEntries([...stages].sort((a, b) => b[1] - a[1])),
    intentConfidence: { passing: meanConf(rows.filter((r) => r.pass)), failing: meanConf(failing) },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) void (async () => {
  if (!["dev", "test", "all"].includes(SPLIT)) {
    console.error("usage: npx tsx bench/run.ts --split dev|test|all [--set v1|heldout|v3|v4|v5|v6|v7|v8|v9|v10] [--engine brain|rules] [--data gold|parser] [--label name] [--fail]");
    process.exit(1);
  }
  const cases = loadCases(SPLIT, SET).filter((c) => !TAGS || (c.tags ?? []).some((t) => TAGS.includes(t)));
  // a model reader (--reader-url, an OpenAI-style endpoint such as llama.cpp's server), its readings cached
  const readerUrl = arg("--reader-url", "");
  const policy = arg("--reader-policy", "") as "" | "replace" | "fill" | "merge";
  const readings = readerUrl ? await readAll(cases, DATA, openAiReader(readerUrl, "none", arg("--reader-model", "local")), arg("--reader-cache", "/tmp/reader-cache.json"), true) : undefined;
  const rows = runEngine(ENGINE, cases, DATA, readings, policy || undefined);
  const s = summarise(rows);
  const sha = (() => {
    try {
      return execSync("git rev-parse --short HEAD", { cwd: DIR }).toString().trim() + (execSync("git status --porcelain -- src", { cwd: DIR }).toString().trim() ? "+wip" : "");
    } catch {
      return "unknown";
    }
  })();
  const label = arg("--label", `${ENGINE}-${SET === "v1" ? "" : `${SET}-`}${SPLIT}-${DATA}-${sha}`);
  mkdirSync(`${DIR}results`, { recursive: true });
  writeFileSync(`${DIR}results/${label}.json`, JSON.stringify({ engine: ENGINE, set: SET, split: SPLIT, data: DATA, sha, at: new Date().toISOString(), summary: s, rows }, null, 1));
  if (process.argv.includes("--fail"))
    for (const r of rows.filter((x) => !x.pass)) console.log(`✗ [${r.stage}] ${r.id} (${r.lang}) ${r.question.slice(0, 80)}\n    → ${r.failed.join("; ")}\n    intent ${r.trace.modelIntent} ${r.trace.confidence} (margin ${r.trace.margin}) → ${r.trace.decided} | ${r.answer.slice(0, 140)}`);
  console.log(JSON.stringify({ label, n: s.n, pass: s.pass, unsafe: s.unsafe, p50ms: s.p50ms, p99ms: s.p99ms, failuresByStage: s.failuresByStage, intentConfidence: s.intentConfidence, byLang: s.byLang }, null, 1));
})();
