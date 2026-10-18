// Shares the request's language with every page, so server-rendered and hydrated
// output match (see src/i18n/react.tsx).
import { defineMiddleware } from "void";
import { requestLocale } from "../src/server/locale";
import { localeInfo } from "../src/i18n/core";

declare module "void" {
  interface CloudContextVariables {
    shared: { locale: string };
  }
}

export default defineMiddleware(async (c, next) => {
  const locale = requestLocale(c.req);
  c.set("shared", { locale });
  c.set("headDefaults", { htmlAttrs: { lang: localeInfo(locale).intl === "zh-CN" ? "zh-Hans" : "en" } });
  await next();
});
