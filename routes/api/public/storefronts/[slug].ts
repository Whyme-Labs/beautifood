// A restaurant's live storefront as data: the published design (or the default one) and what's on now.
// The storefront page renders this; so can a restaurant's own deployment of the open-source template.
import { api } from "../../../../src/server/http";
import { edgeCached } from "../../../../src/server/routing";
import { getStorefront, storefrontData } from "../../../../src/server/domain/storefront";
import { defaultStorefront } from "../../../../src/shared/storefront";

export const GET = api(async (c) => {
  const slug = c.req.param("slug")!;
  return edgeCached(c, 30, async () => {
    const data = await storefrontData(c.env.DB, slug);
    // a draft isn't shown until it's published; before then, the house design with the restaurant's own words
    const { published } = await getStorefront(c.env.DB, data.tenantId);
    const { tenantId: _t, ...rest } = data;
    return { design: published ?? defaultStorefront(data.restaurant), published: !!published, ...rest };
  });
});
