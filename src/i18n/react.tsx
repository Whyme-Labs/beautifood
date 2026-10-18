import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useShared } from "@void/react";
import { DEFAULT_LOCALE, formatters, isLocale, matchLocale, minutes, translate, type MessageKey, type Vars } from "./core";
import { setApiLocale } from "../ui/api";

const STORAGE_KEY = "bf.lang";

/**
 * The server decides first (?lang, the bf_lang cookie, Accept-Language; see
 * middleware/01.locale.ts) so server-rendered and hydrated output always match.
 * Without server data, fall back to the same order in the browser.
 */
function detect(serverLocale: string | undefined): string {
  if (isLocale(serverLocale)) return serverLocale;
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const q = new URLSearchParams(window.location.search).get("lang");
  if (isLocale(q)) return q;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    /* private mode */
  }
  return matchLocale(navigator.languages?.length ? navigator.languages : [navigator.language]);
}

interface I18n {
  locale: string;
  setLocale: (l: string) => void;
  t: (key: MessageKey, vars?: Vars) => string;
  f: ReturnType<typeof formatters>;
  mins: (m: number | null | undefined) => string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  let shared: { locale?: string } | undefined;
  try {
    shared = useShared<{ locale?: string }>();
  } catch {
    shared = undefined;
  }
  const [locale, setLocaleState] = useState(() => detect(shared?.locale));
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-Hans" : locale;
    setApiLocale(locale);
  }, [locale]);
  const setLocale = useCallback((l: string) => {
    if (!isLocale(l)) return;
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
    document.cookie = `bf_lang=${l}; path=/; max-age=31536000; samesite=lax`;
    setLocaleState(l);
  }, []);
  const value = useMemo<I18n>(
    () => ({ locale, setLocale, t: (k, v) => translate(locale, k, v), f: formatters(locale), mins: (m) => minutes(locale, m) }),
    [locale, setLocale],
  );
  setApiLocale(locale);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n outside I18nProvider");
  return v;
}

export const useT = () => useI18n().t;
