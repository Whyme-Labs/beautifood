import { defineHandler, defineHead, type InferProps } from "void";
import { env } from "void/env";
import { getStorefront, storefrontData } from "../../src/server/domain/storefront";
import { listDomains } from "../../src/server/domain/domains";
import { defaultStorefront } from "../../src/shared/storefront";
import { storefrontUrls } from "../../src/shared/domains";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async (c) => {
  const { tenantId, ...data } = await storefrontData(c.env.DB, c.req.param("slug")!);
  const [{ published }, domains] = await Promise.all([getStorefront(c.env.DB, tenantId), listDomains(c.env.DB, tenantId)]);
  // one address for search engines and shared links, whichever host this was asked on
  const canonical = storefrontUrls(data.restaurant.slug, env.PUBLIC_URL, env.STOREFRONT_DOMAIN, domains).primary;
  return { design: published ?? defaultStorefront(data.restaurant), data, canonical };
});

export const head = defineHead<Props>((_c, p) => ({
  title: p.data.restaurant.name,
  meta: [
    { name: "description", content: p.data.restaurant.description || `${p.data.restaurant.name}: queue, order and book online` },
    { property: "og:title", content: p.data.restaurant.name },
    { property: "og:url", content: p.canonical },
    { name: "theme-color", content: p.design.theme.bg },
  ],
  link: [{ rel: "canonical", href: p.canonical }],
}));
