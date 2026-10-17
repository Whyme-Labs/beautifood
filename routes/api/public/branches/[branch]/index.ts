import { api } from "../../../../../src/server/http";
import { getBranch } from "../../../../../src/server/domain/context";

export const GET = api(async (c) => {
  const { branch, tenant, config } = await getBranch(c.env.DB, c.req.param("branch")!);
  return {
    id: branch.id,
    ref: `${tenant.slug}~${branch.slug}`,
    name: branch.name,
    address: branch.address,
    open: !!branch.active,
    restaurant: { id: tenant.id, slug: tenant.slug, name: tenant.name, cuisine: tenant.cuisine, description: tenant.description, story: tenant.story },
    currency: config.currency,
    timezone: config.timezone,
    categories: config.categories,
    qrMode: config.qrMode,
    modules: config.modules,
    booking: config.booking,
    serviceChargePct: config.serviceChargePct,
    taxPct: config.taxPct,
  };
});
