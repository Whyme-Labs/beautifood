// Timed menus and happy hours. A menu (Breakfast, Lunch, All day…) is served in weekly windows
// of branch-local time; a dish on no menu is served whenever the branch is open. A price rule
// (Happy hour: drinks −30%, weekdays 3–6 pm) changes a dish's price while its window is on.
// The server, the guest menu and the till all read "now" through these functions, so what a
// guest sees is what the kitchen gets and what the bill charges.
import type { Menu, MenuItem } from "./types";

/** Days are 0 = Sunday … 6 = Saturday; times "HH:MM" branch-local. `to` before `from` runs past midnight. */
export interface Window {
  days: number[];
  from: string;
  to: string;
  /**
   * A season or a promotion's dates, inclusive, "YYYY-MM-DD" branch-local: the window only runs
   * between them (Durian season 1 Oct – 30 Nov, a Raya promo). Either may be left open.
   */
  start?: string;
  end?: string;
}

export interface TimedMenu {
  id: string;
  name: string;
  translations?: Record<string, { name?: string }>;
  windows: Window[];
  /** Branch ids it applies at; ["*"] for every branch. */
  branches: string[];
  active: boolean;
  sort: number;
}

export interface PriceRule {
  id: string;
  name: string;
  translations?: Record<string, { name?: string }>;
  kind: "percent" | "amount";
  /** Percent off (e.g. 30) or minor units off each dish (e.g. 200). */
  value: number;
  /** What it covers: empty lists on both means the whole menu. */
  categories: string[];
  items: string[];
  windows: Window[];
  branches: string[];
  active: boolean;
}

export interface Clock {
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  /** Minutes since local midnight. */
  minutes: number;
  /** The local date, "YYYY-MM-DD": windows with dates only run between them. Without it, dates are ignored. */
  date?: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

/** The branch-local weekday and time of an instant. */
export function clockAt(at: number, timezone: string): Clock {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(at));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at));
  return { weekday: WEEKDAYS.indexOf(g("weekday")), minutes: (Number(g("hour")) % 24) * 60 + Number(g("minute")), date: d };
}

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
export const fromMinutes = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Each window as week-minute spans [start, end), an overnight window spilling into the next day. */
function spans(w: Window): [number, number][] {
  const from = toMinutes(w.from);
  let to = toMinutes(w.to);
  if (to <= from) to += MINUTES_PER_DAY; // past midnight (or a full day when equal)
  return w.days.map((d) => [d * MINUTES_PER_DAY + from, d * MINUTES_PER_DAY + to]);
}

const weekMinute = (c: Clock) => c.weekday * MINUTES_PER_DAY + c.minutes;

/** "YYYY-MM-DD" plus n days. */
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** The windows whose dates allow `date` (+ up to `ahead` days): all of them when the clock has no date. */
const dated = (windows: Window[], c: Clock, ahead = 0) =>
  c.date ? windows.filter((w) => (!w.end || w.end >= c.date!) && (!w.start || w.start <= addDays(c.date!, ahead))) : windows;

/** Is any window on at this time? */
export function isOn(windows: Window[], c: Clock): boolean {
  const t = weekMinute(c);
  return dated(windows, c, 0).some((w) => spans(w).some(([s, e]) => (t >= s && t < e) || (t + MINUTES_PER_WEEK >= s && t + MINUTES_PER_WEEK < e)));
}

/** When the windows next start, within the coming week: the weekday and "HH:MM", and whether it is today. */
export function nextStart(windows: Window[], c: Clock): { weekday: number; time: string; today: boolean } | null {
  const t = weekMinute(c);
  let best = Infinity;
  for (const w of dated(windows, c, 6))
    for (const [s] of spans(w))
      for (const cand of [s, s + MINUTES_PER_WEEK]) {
        if (cand <= t || cand >= best) continue;
        // a season that starts in a few days: its first day, not an earlier weekday
        const day = c.date ? addDays(c.date, Math.floor((cand - t + c.minutes) / MINUTES_PER_DAY)) : null;
        if (day && ((w.start && day < w.start) || (w.end && day > w.end))) continue;
        best = cand;
      }
  if (best === Infinity) return null;
  const m = best % MINUTES_PER_WEEK;
  const weekday = Math.floor(m / MINUTES_PER_DAY);
  return { weekday, time: fromMinutes(m % MINUTES_PER_DAY), today: best - t < MINUTES_PER_DAY - c.minutes };
}

/** When the windows that are on now end: "HH:MM" (the latest end among those running). */
export function endsAt(windows: Window[], c: Clock): string | null {
  const t = weekMinute(c);
  let end = -1;
  for (const w of dated(windows, c, 0))
    for (const [s, e] of spans(w)) {
      if (t >= s && t < e) end = Math.max(end, e);
      if (t + MINUTES_PER_WEEK >= s && t + MINUTES_PER_WEEK < e) end = Math.max(end, e - MINUTES_PER_WEEK);
    }
  return end < 0 ? null : fromMinutes(((end % MINUTES_PER_WEEK) + MINUTES_PER_WEEK) % MINUTES_PER_WEEK % MINUTES_PER_DAY);
}

const atBranch = (branches: string[], branchId: string | null | undefined) => !branchId || branches.includes("*") || branches.includes(branchId);

/** The menus that apply at this branch (on now or not). */
export const menusAt = (menus: TimedMenu[], branchId?: string | null) => menus.filter((m) => m.active && atBranch(m.branches, branchId));

/** The price rules that apply at this branch. */
export const rulesAt = (rules: PriceRule[], branchId?: string | null) => rules.filter((r) => r.active && atBranch(r.branches, branchId));

const covers = (r: PriceRule, item: Pick<MenuItem, "id" | "categoryId">) => (!r.categories.length && !r.items.length) || r.items.includes(item.id) || r.categories.includes(item.categoryId);

/** A dish's price after a rule: never below zero. */
export const ruledPrice = (price: number, r: Pick<PriceRule, "kind" | "value">) => Math.max(0, r.kind === "percent" ? Math.round((price * (100 - r.value)) / 100) : price - Math.round(r.value));

export interface Serving {
  /** Served right now (on a menu that is on, or on no menu). */
  servedNow: boolean;
  /** When it is next served, if not now. */
  next: { weekday: number; time: string; today: boolean; menu: string; menuId: string } | null;
  /** The price now, the list price and the rule that changed it. */
  price: number;
  listPrice: number;
  rule: PriceRule | null;
}

/**
 * Whether a dish is served now and what it costs now. `menuIds` empty = served all day. `menus`
 * are the ones that apply at this branch and are switched on: a dish only on others isn't served
 * here at all. With several rules on, the guest gets the best price.
 */
export function serving(item: Pick<MenuItem, "id" | "categoryId" | "price" | "menuIds">, menus: TimedMenu[], rules: PriceRule[], c: Clock): Serving {
  const mine = menus.filter((m) => (item.menuIds ?? []).includes(m.id));
  const servedNow = !(item.menuIds ?? []).length || mine.some((m) => isOn(m.windows, c));
  let next: Serving["next"] = null;
  if (!servedNow)
    for (const m of mine) {
      const n = nextStart(m.windows, c);
      if (n && (!next || order(n, c) < order(next, c))) next = { ...n, menu: m.name, menuId: m.id };
    }
  let price = item.price;
  let rule: PriceRule | null = null;
  for (const r of rules)
    if (covers(r, item) && isOn(r.windows, c)) {
      const p = ruledPrice(item.price, r);
      if (p < price) (price = p), (rule = r);
    }
  return { servedNow, next, price, listPrice: item.price, rule };
}

const order = (n: { weekday: number; time: string }, c: Clock) => (((n.weekday - c.weekday + 7) % 7) * MINUTES_PER_DAY + toMinutes(n.time) - c.minutes + MINUTES_PER_WEEK) % MINUTES_PER_WEEK;

/**
 * The menu as it stands at this branch now: each dish carries whether it is served now, when it
 * is next, and its price now (`price`) with the list price beside it when a rule changed it.
 */
export function menuNow(menu: Menu, branchId: string | null | undefined, c: Clock): Menu {
  const menus = menusAt(menu.menus ?? [], branchId);
  const rules = rulesAt(menu.rules ?? [], branchId);
  return {
    ...menu,
    menus,
    rules,
    now: {
      menus: menus.filter((m) => isOn(m.windows, c)).map((m) => ({ id: m.id, name: m.name, until: endsAt(m.windows, c) })),
      deals: rules.filter((r) => isOn(r.windows, c)).map((r) => ({ id: r.id, name: r.name, until: endsAt(r.windows, c) })),
      dealsNext: rules.filter((r) => !isOn(r.windows, c)).flatMap((r) => {
        const n = nextStart(r.windows, c);
        return n ? [{ id: r.id, name: r.name, ...n }] : [];
      }),
    },
    // a dish only on menus that don't run here (another branch's supper, a switched-off brunch) isn't on this branch's menu
    items: menu.items.filter((i) => !(i.menuIds ?? []).length || menus.some((m) => i.menuIds!.includes(m.id))).map((i) => {
      const s = serving(i, menus, rules, c);
      return {
        ...i,
        price: s.price,
        listPrice: s.rule ? s.listPrice : undefined,
        deal: s.rule ? { id: s.rule.id, name: s.rule.name } : undefined,
        servedNow: s.servedNow,
        nextServed: s.next ?? undefined,
      };
    }),
  };
}

/** A timed menu's or rule's name in a language (the restaurant's own when untranslated). */
export const scheduleName = (x: { name: string; translations?: Record<string, { name?: string }> }, locale: string) => x.translations?.[locale]?.name || x.name;

/** "HH:MM" as a reader expects it: "3:00 pm", "15:00", "下午3:00". */
export function clockLabel(hhmm: string, locale: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 4, h, m)));
}

/** Short weekday names in a language, Sunday first. */
export const weekdayNames = (locale: string) => Array.from({ length: 7 }, (_, d) => new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 4 + d))));

/** Days as short as they read: "Every day", "Mon–Fri", "Sat, Sun", "Mon, Wed, Fri". */
export function daysLabel(days: number[], names: string[], everyDay: string): string {
  const d = [...new Set(days)].sort((a, b) => a - b);
  if (d.length === 7) return everyDay;
  const mon = d.map((x) => (x + 6) % 7).sort((a, b) => a - b); // Monday-first runs
  const run = mon.length > 2 && mon.every((x, i) => i === 0 || x === mon[i - 1] + 1);
  const name = (m: number) => names[(m + 1) % 7];
  return run ? `${name(mon[0])}–${name(mon[mon.length - 1])}` : mon.map(name).join(", ");
}
