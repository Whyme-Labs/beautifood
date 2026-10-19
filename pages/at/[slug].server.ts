import { defineHandler, defineHead, type InferProps } from "void";
import { getStorefront, storefrontData } from "../../src/server/domain/storefront";
import { defaultStorefront } from "../../src/shared/storefront";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async (c) => {
  const { tenantId, ...data } = await storefrontData(c.env.DB, c.req.param("slug")!);
  const { published } = await getStorefront(c.env.DB, tenantId);
  return { design: published ?? defaultStorefront(data.restaurant), data };
});

export const head = defineHead<Props>((_c, p) => ({
  title: p.data.restaurant.name,
  meta: [
    { name: "description", content: p.data.restaurant.description || `${p.data.restaurant.name}: queue, order and book online` },
    { property: "og:title", content: p.data.restaurant.name },
    { name: "theme-color", content: p.design.theme.bg },
  ],
}));
