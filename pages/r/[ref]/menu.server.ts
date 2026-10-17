import { defineHandler, type InferProps } from "void";
import { getBranch } from "../../../src/server/domain/context";
import { getMenu } from "../../../src/server/domain/menu";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async (c) => {
  const ctx = await getBranch(c.env.DB, c.req.param("ref")!);
  return {
    ref: `${ctx.tenant.slug}~${ctx.branch.slug}`,
    restaurant: ctx.tenant.name,
    cuisine: ctx.tenant.cuisine,
    branch: ctx.branch.name,
    address: ctx.branch.address,
    currency: ctx.config.currency,
    menuDisplay: ctx.config.modules.menuDisplay,
    aiAssistant: ctx.config.modules.aiAssistant,
    menu: await getMenu(c.env.DB, ctx.tenant.id, ctx.branch.id),
  };
});
