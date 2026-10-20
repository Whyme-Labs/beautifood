// Storefront hosts: <slug>.<STOREFRONT_DOMAIN> and restaurants' own domains serve that restaurant's
// storefront at "/". Ordering, queue and booking pages work there as they do on the app; the staff
// console and sign-in stay on the app's own address, so staff sessions never live on a
// restaurant's domain.
import { defineMiddleware } from "void";
import { env } from "void/env";
import { appOnlyPath } from "../src/shared/domains";
import { storefrontForHost } from "../src/server/domain/domains";

export default defineMiddleware(async (c, next) => {
  if (c.isRewritten()) return next();
  const url = new URL(c.req.url);
  let slug: string | null = null;
  try {
    slug = await storefrontForHost(c.env.DB, url.host);
  } catch (e) {
    console.error("storefront host", e);
  }
  if (!slug) return next();
  if (url.pathname === "/") return c.rewrite(`/at/${slug}`);
  if (url.pathname === `/at/${slug}`) return c.redirect(`/${url.search}`, 301);
  if (appOnlyPath(url.pathname)) return c.redirect(`${env.PUBLIC_URL.replace(/\/$/, "")}${url.pathname}${url.search}`, 302);
  return next();
});
