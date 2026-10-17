import { api } from "../../../../src/server/http";
import { memberFromRequest } from "../../../../src/server/routing";
import { ensureMember, memberHistory, tierFor, toMember } from "../../../../src/server/domain/loyalty";
import { getTenant, loyaltyConfig } from "../../../../src/server/domain/context";
import { fail } from "../../../../src/server/errors";

export const GET = api(async (c) => {
  const tok = await memberFromRequest(c);
  if (!tok) fail(401, "unauthorized", "Sign in to see your rewards");
  const t = await getTenant(c.env.DB, tok.t);
  const m = await ensureMember(c.env.DB, t.id, tok.email);
  const cfg = loyaltyConfig(t);
  const tiers = [...cfg.tiers].sort((a, b) => a.minLifetime - b.minLifetime);
  const next = tiers.find((x) => x.minLifetime > m.lifetime_points) ?? null;
  return {
    restaurant: { id: t.id, name: t.name, slug: t.slug },
    member: toMember(m),
    tier: tierFor(t, m.lifetime_points),
    nextTier: next ? { name: next.name, pointsNeeded: next.minLifetime - m.lifetime_points } : null,
    redeem: { valuePerPoint: cfg.redeemValue, minRedeem: cfg.minRedeem },
    ...(await memberHistory(c.env.DB, m.id)),
  };
});

export const PATCH = api(async (c) => {
  const tok = await memberFromRequest(c);
  if (!tok) fail(401, "unauthorized", "Sign in first");
  const b = (await c.req.json()) as { optIn?: boolean; name?: string };
  await c.env.DB.prepare("UPDATE members SET opt_in = COALESCE(?, opt_in), name = COALESCE(?, name) WHERE tenant_id = ? AND email = ?")
    .bind(b.optIn === undefined ? null : b.optIn ? 1 : 0, b.name?.slice(0, 60) ?? null, tok.t, tok.email)
    .run();
  return { ok: true };
});
