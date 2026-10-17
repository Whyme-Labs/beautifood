import { api } from "../../../../../src/server/http";
import { edgeCached } from "../../../../../src/server/routing";
import { getBranch } from "../../../../../src/server/domain/context";
import { getMenu } from "../../../../../src/server/domain/menu";

export const GET = api((c) =>
  edgeCached(c, 15, async () => {
    const ctx = await getBranch(c.env.DB, c.req.param("branch")!);
    return { currency: ctx.config.currency, ...(await getMenu(c.env.DB, ctx.tenant.id, ctx.branch.id)) };
  }),
);
