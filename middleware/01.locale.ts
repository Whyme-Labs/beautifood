// Shares the request's language with every page, so server-rendered and hydrated
// output match (see src/i18n/react.tsx).
import { defineMiddleware } from "void";
import { requestLocale } from "../src/server/locale";

declare module "void" {
  interface CloudContextVariables {
    shared: { locale: string };
  }
}

export default defineMiddleware(async (c, next) => {
  c.set("shared", { locale: requestLocale(c.req) });
  await next();
});
