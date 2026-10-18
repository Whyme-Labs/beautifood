// Framework-free i18n core, shared by the browser and the Worker (emails, assistant).
//
// Adding a language:
//   1. copy src/i18n/locales/en.ts to <code>.ts and translate the strings
//      (TypeScript fails the build if a key is missing or misspelt),
//   2. register it in LOCALES and CATALOGS below.
// Everything else (detection, the switcher, money/date formatting, menu
// translations, email templates) picks it up from the registry.
import en, { type Messages } from "./locales/en";
import zh from "./locales/zh";

export interface LocaleInfo {
  code: string;
  /** Name in its own language, for the switcher. */
  label: string;
  /** BCP 47 tag used for Intl formatting. */
  intl: string;
  /** Name in English, for prompts to translation models. */
  english: string;
}

export const LOCALES: LocaleInfo[] = [
  { code: "en", label: "English", intl: "en-MY", english: "English" },
  { code: "zh", label: "中文", intl: "zh-CN", english: "Simplified Chinese" },
];

const CATALOGS: Record<string, Messages> = { en, zh };

export const DEFAULT_LOCALE = "en";
export const isLocale = (c: unknown): c is string => typeof c === "string" && c in CATALOGS;
export const localeInfo = (c: string) => LOCALES.find((l) => l.code === c) ?? LOCALES[0];

/** Best supported locale for a list of preferences such as navigator.languages or Accept-Language. */
export function matchLocale(prefs: readonly (string | null | undefined)[]): string {
  for (const p of prefs) {
    if (!p) continue;
    const tag = p.toLowerCase().split(";")[0].trim();
    if (tag in CATALOGS) return tag;
    const base = tag.split("-")[0];
    if (base in CATALOGS) return base;
  }
  return DEFAULT_LOCALE;
}

type Plural = { zero?: string; one?: string; two?: string; few?: string; many?: string; other: string };
type Leaf = string | Plural;

// Dotted keys of the English catalog ("guest.ticket.ahead"), so t() is type-checked.
type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Keys<T> = { [K in keyof T & string]: T[K] extends string ? K : T[K] extends Plural ? K : Join<K, Keys<T[K]>> }[keyof T & string];
export type MessageKey = Keys<Messages>;
export type Vars = Record<string, string | number | null | undefined>;

function lookup(cat: Messages, key: string): Leaf | undefined {
  let cur: unknown = cat;
  for (const part of key.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string" || (cur && typeof cur === "object" && "other" in cur) ? (cur as Leaf) : undefined;
}

const pluralRules = new Map<string, Intl.PluralRules>();

/** Translate `key` into `locale`, falling back to English and then to the key itself. */
export function translate(locale: string, key: string, vars: Vars = {}): string {
  let leaf = lookup(CATALOGS[locale] ?? en, key) ?? lookup(en, key);
  if (leaf === undefined) return key;
  if (typeof leaf !== "string") {
    const n = Number(vars.count ?? 0);
    let pr = pluralRules.get(locale);
    if (!pr) pluralRules.set(locale, (pr = new Intl.PluralRules(localeInfo(locale).intl)));
    const form = n === 0 && leaf.zero !== undefined ? "zero" : pr.select(n);
    leaf = leaf[form as keyof Plural] ?? leaf.other;
  }
  return leaf.replace(/\{(\w+)\}/g, (m, name: string) => (vars[name] === undefined || vars[name] === null ? m : String(vars[name])));
}

/** A translator bound to one locale. */
export const translator = (locale: string) => (key: MessageKey, vars?: Vars) => translate(locale, key, vars);

const CURRENCY_SYMBOL: Record<string, string> = { MYR: "RM", USD: "$", SGD: "S$", EUR: "€", GBP: "£", AUD: "A$", IDR: "Rp", THB: "฿" };

/** Locale-aware formatters. Money keeps the local symbol (RM 12.90) that guests read on menus. */
export function formatters(locale: string) {
  const intl = localeInfo(locale).intl;
  const num = new Intl.NumberFormat(intl, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return {
    money: (minor: number, currency = "MYR") => `${minor < 0 ? "-" : ""}${CURRENCY_SYMBOL[currency] ?? `${currency} `}${num.format(Math.abs(minor) / 100)}`,
    number: (n: number) => new Intl.NumberFormat(intl).format(n),
    date: (ms: number, timeZone?: string) => new Intl.DateTimeFormat(intl, { dateStyle: "medium", timeZone }).format(new Date(ms)),
    time: (ms: number, timeZone?: string) => new Intl.DateTimeFormat(intl, { timeStyle: "short", timeZone }).format(new Date(ms)),
    dateTime: (ms: number, timeZone?: string) => new Intl.DateTimeFormat(intl, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(ms)),
    fullDateTime: (ms: number, timeZone?: string) => new Intl.DateTimeFormat(intl, { dateStyle: "full", timeStyle: "short", timeZone }).format(new Date(ms)),
    weekday: (ms: number, timeZone?: string) => new Intl.DateTimeFormat(intl, { weekday: "short", day: "numeric", month: "short", timeZone }).format(new Date(ms)),
    relativeMinutes: (mins: number) => new Intl.RelativeTimeFormat(intl, { numeric: "auto" }).format(-Math.round(mins), "minute"),
  };
}

/** "~12 min", "now", "~1 h 05 min" in the locale. */
export function minutes(locale: string, m: number | null | undefined): string {
  if (m == null) return "—";
  if (m <= 0) return translate(locale, "common.now");
  if (m < 60) return translate(locale, "common.aboutMinutes", { count: m });
  return translate(locale, "common.aboutHours", { h: Math.floor(m / 60), m: String(m % 60).padStart(2, "0") });
}
