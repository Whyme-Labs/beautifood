// Which language a request wants: ?lang, then the bf_lang cookie (set by the language
// switcher), then the x-lang header (sent by the app's API client), then Accept-Language.
import { isLocale, matchLocale } from "../i18n/core";

export function requestLocale(req: { query: (k: string) => string | undefined; header: (k: string) => string | undefined }): string {
  const q = req.query("lang");
  if (isLocale(q)) return q;
  const cookie = req.header("cookie")?.match(/(?:^|;\s*)bf_lang=([\w-]+)/)?.[1];
  if (isLocale(cookie)) return cookie;
  const x = req.header("x-lang");
  if (isLocale(x)) return x;
  return matchLocale((req.header("accept-language") ?? "").split(","));
}
