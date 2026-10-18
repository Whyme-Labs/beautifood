import { z } from "zod";
import { api, body } from "../../../src/server/http";
import { staffTenant, actorOf } from "../../../src/server/routing";
import { getTenant, loyaltyConfig } from "../../../src/server/domain/context";
import { listBranches, updateTenant } from "../../../src/server/domain/tenants";
import { isLocale } from "../../../src/i18n/core";

export const GET = api(async (c) => {
  const s = await staffTenant(c, null);
  const t = await getTenant(c.env.DB, s.tenantId);
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    description: t.description,
    cuisine: t.cuisine,
    story: t.story,
    currency: t.currency,
    timezone: t.timezone,
    menuLanguage: t.menu_language || "en",
    loyalty: loyaltyConfig(t),
    onboarding: JSON.parse(t.onboarding || "{}"),
    branches: (await listBranches(c.env.DB, t.id)).filter((b) => s.branches.includes("*") || ["owner", "admin", "marketing"].includes(s.role) || s.branches.includes(b.id)),
    me: { role: s.role, branches: s.branches, name: s.name, email: s.email },
  };
});

const Patch = z
  .object({
    name: z.string().min(2).max(80),
    description: z.string().max(500),
    cuisine: z.string().max(60),
    story: z.string().max(2000),
    currency: z.string().length(3),
    timezone: z.string().max(60),
    menuLanguage: z.string().refine(isLocale, "Unknown language"),
    loyalty: z.object({
      enabled: z.boolean(),
      earnPerUnit: z.number().min(0).max(100),
      redeemValue: z.number().int().min(1).max(1000),
      minRedeem: z.number().int().min(0),
      tiers: z.array(z.object({ name: z.string().min(1).max(30), minLifetime: z.number().int().min(0), multiplier: z.number().min(1).max(5) })).min(1).max(6),
    }),
    onboarding: z.record(z.string(), z.boolean()),
  })
  .partial()
  .strict();

export const PATCH = api(async (c) => {
  const s = await staffTenant(c, "settings.manage");
  const patch = await body(c, Patch);
  if (patch.onboarding) {
    const t = await getTenant(c.env.DB, s.tenantId);
    patch.onboarding = { ...JSON.parse(t.onboarding || "{}"), ...patch.onboarding };
  }
  const { menuLanguage, ...rest } = patch;
  await updateTenant(c.env.DB, s.tenantId, actorOf(s), { ...rest, ...(menuLanguage ? { menu_language: menuLanguage } : {}) });
  return { ok: true };
});
