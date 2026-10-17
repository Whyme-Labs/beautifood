import { defineHandler, type InferProps } from "void";
import { getBranch } from "../../../src/server/domain/context";
import { getMenu } from "../../../src/server/domain/menu";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async (c) => {
  const ctx = await getBranch(c.env.DB, c.req.param("ref")!);
  const menu = await getMenu(c.env.DB, ctx.tenant.id, ctx.branch.id);
  return {
    ref: `${ctx.tenant.slug}~${ctx.branch.slug}`,
    branch: { id: ctx.branch.id, name: ctx.branch.name, address: ctx.branch.address, open: !!ctx.branch.active },
    restaurant: { name: ctx.tenant.name, slug: ctx.tenant.slug, cuisine: ctx.tenant.cuisine, story: ctx.tenant.story, description: ctx.tenant.description },
    currency: ctx.config.currency,
    categories: ctx.config.categories,
    modules: ctx.config.modules,
    signatures: menu.items.filter((i) => i.isSignature).slice(0, 4).map((i) => ({ id: i.id, name: i.name, price: i.price, description: i.description })),
  };
});
