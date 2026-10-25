// The AI onboarding copilot.
//   GET  → setup checklist with progress and the recommended next step
//   POST { about, menuText, floorText } → a reviewable draft (nothing saved)
//   PUT  { draft, branchId, replaceMenu, replaceTables } → apply the reviewed draft
import { z } from "zod";
import { api, body, requirePerm } from "../../../../src/server/http";
import { actorOf, staffTenant } from "../../../../src/server/routing";
import { appEnv } from "../../../../src/server/appenv";
import { onboardingDraft, onboardingStatus } from "../../../../src/server/ai";
import { getBranch, getTenant } from "../../../../src/server/domain/context";
import { importMenu } from "../../../../src/server/domain/menu";
import { saveTables } from "../../../../src/server/domain/floor";
import { updateTenant } from "../../../../src/server/domain/tenants";
import { ItemInput } from "../../../../src/server/menuSchemas";
import { translateMenu } from "../../../../src/server/domain/translations";
import { fail } from "../../../../src/server/errors";

export const GET = api(async (c) => {
  const s = await staffTenant(c, null);
  return onboardingStatus(c.env.DB, s.tenantId);
});

export const POST = api(async (c) => {
  const s = await staffTenant(c, "menu.manage");
  const input = await body(c, z.object({ about: z.string().max(4000).default(""), menuText: z.string().max(40_000).default(""), floorText: z.string().max(4000).default("") }));
  if (!input.about && !input.menuText && !input.floorText) fail(400, "empty", "Paste your menu, describe your floor, or tell us about your restaurant");
  const t = await getTenant(c.env.DB, s.tenantId);
  return onboardingDraft({ ...appEnv(), AI: (c.env as { AI?: never }).AI }, { ...input, restaurantName: t.name, currency: t.currency });
});

const Table = z.object({
  label: z.string().min(1).max(12),
  zone: z.string().max(30).optional(),
  seatsMin: z.number().int().min(1),
  seatsMax: z.number().int().min(1),
  mergeGroup: z.string().nullable().optional(),
  splitConfig: z.array(z.object({ suffix: z.string(), seats: z.number().int() })).nullable().optional(),
});

export const PUT = api(async (c) => {
  const s = await staffTenant(c, "menu.manage");
  const input = await body(
    c,
    z.object({
      branchId: z.string(),
      cuisine: z.string().max(60).optional(),
      story: z.string().max(2000).optional(),
      items: z.array(ItemInput.omit({ categoryId: true }).extend({ category: z.string().min(1).max(40) })).max(300).default([]),
      tables: z.array(Table).max(200).default([]),
      replaceMenu: z.boolean().default(true),
      replaceTables: z.boolean().default(true),
    }),
  );
  const actor = actorOf(s);
  const out: Record<string, unknown> = {};
  if (input.cuisine || input.story) await updateTenant(c.env.DB, s.tenantId, actor, { cuisine: input.cuisine, story: input.story });
  if (input.items.length) out.menu = await importMenu(c.env.DB, s.tenantId, actor, input.items, input.replaceMenu);
  if (input.tables.length) {
    const ctx = await getBranch(c.env.DB, input.branchId);
    if (ctx.tenant.id !== s.tenantId) fail(403, "forbidden", "Not your branch");
    requirePerm(s, "table.manage", ctx.branch.id);
    out.tables = (await saveTables(c.env.DB, ctx, actor, input.tables, input.replaceTables)).length;
  }
  if (input.items.length) {
    // Translate the new menu for guests in every language; a failure here never blocks setup.
    out.translations = await translateMenu(c.env.DB, { ...appEnv(), AI: (c.env as { AI?: never }).AI }, s.tenantId, actor).catch(() => null);
  }
  return { applied: out, status: await onboardingStatus(c.env.DB, s.tenantId) };
});
