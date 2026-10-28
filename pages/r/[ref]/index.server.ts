import { defineHandler, type InferProps } from "void";
import { getBranch } from "../../../src/server/domain/context";
import { menuAt } from "../../../src/server/domain/menu";
import { halalStanding } from "../../../src/shared/types";
import { clockAt } from "../../../src/shared/schedule";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async (c) => {
  const ctx = await getBranch(c.env.DB, c.req.param("ref")!);
  const menu = await menuAt(c.env.DB, ctx);
  return {
    ref: `${ctx.tenant.slug}~${ctx.branch.slug}`,
    branch: { id: ctx.branch.id, name: ctx.branch.name, address: ctx.branch.address, open: !!ctx.branch.active },
    restaurant: {
      name: ctx.tenant.name,
      slug: ctx.tenant.slug,
      cuisine: ctx.tenant.cuisine,
      story: ctx.tenant.story,
      description: ctx.tenant.description,
      translations: JSON.parse(ctx.tenant.translations || "{}") as Record<string, { story?: string; description?: string }>,
    },
    menuLanguage: menu.language ?? "en",
    currency: ctx.config.currency,
    categories: ctx.config.categories,
    modules: ctx.config.modules,
    halal: { ...ctx.config.halal, standing: halalStanding(ctx.config.halal, clockAt(Date.now(), ctx.config.timezone).date ?? "") },
    signatures: menu.items.filter((i) => i.isSignature).slice(0, 4).map((i) => ({ id: i.id, name: i.name, price: i.price, description: i.description, story: i.story, translations: i.translations })),
  };
});
