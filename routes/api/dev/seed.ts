// "Load the demo restaurant": make the signed-in user the owner of a new demo restaurant with
// two branches, a full menu (via the onboarding copilot), tables, a promo code and members.
// ?history=1 also gives it two weeks of trading (see src/server/dev/history.ts), a team and a
// finished setup checklist, so it looks like a restaurant that has been open for years.
// Safe in production: it only ever creates a new restaurant owned by the caller.
import { getUser } from "void/auth";
import { api } from "../../../src/server/http";
import { appEnv } from "../../../src/server/appenv";
import { fail } from "../../../src/server/errors";
import { onboardingDraft } from "../../../src/server/ai";
import { addBranch, createTenant, updateTenant } from "../../../src/server/domain/tenants";
import { importMenu } from "../../../src/server/domain/menu";
import { saveTables } from "../../../src/server/domain/floor";
import { getBranch } from "../../../src/server/domain/context";
import { ensureMember } from "../../../src/server/domain/loyalty";
import { SAMPLE_ABOUT, SAMPLE_FLOOR, SAMPLE_MENU, sampleProfile } from "../../../src/server/dev/sample";
import { translateMenu } from "../../../src/server/domain/translations";
import { seedHistory } from "../../../src/server/dev/history";
import { newId } from "../../../src/server/ids";

export const POST = api(async (c) => {
  const user = getUser();
  if (!user) fail(401, "unauthorized", "Sign in first");
  const q = c.req.query("name") || "Beautifood Demo";
  const profile = sampleProfile(q, c.req.query("lang") ?? "en");
  const { tenantId, branchId, slug } = await createTenant(c.env.DB, user, { name: q, cuisine: profile.cuisine, branchName: "KLCC", address: "Level 2, Suria KLCC, Kuala Lumpur" });
  const actor = `staff:${user.id}`;
  await updateTenant(c.env.DB, tenantId, actor, { story: profile.story, description: profile.description });
  const second = await addBranch(c.env.DB, tenantId, actor, { name: "Bangsar", address: "Jalan Telawi, Bangsar" });
  const draft = await onboardingDraft(appEnv(), { restaurantName: q, about: SAMPLE_ABOUT, menuText: SAMPLE_MENU, floorText: SAMPLE_FLOOR, currency: "MYR" });
  await importMenu(c.env.DB, tenantId, actor, draft.items, true);
  // satay & curry mee get a spice modifier, teh tarik a sugar level to exercise modifiers
  await c.env.DB.prepare("UPDATE menu_items SET modifiers = ? WHERE tenant_id = ? AND name = 'Teh Tarik'")
    .bind(JSON.stringify([{ name: "Sugar", min: 0, max: 1, options: [{ name: "Less sugar", price: 0 }, { name: "No sugar", price: 0 }] }, { name: "Temperature", min: 1, max: 1, options: [{ name: "Hot", price: 0 }, { name: "Iced", price: 50 }] }]), tenantId)
    .run();
  for (const b of [branchId, second.id]) await saveTables(c.env.DB, await getBranch(c.env.DB, b), actor, draft.tables, true);
  await c.env.DB.prepare("INSERT INTO promo_codes (tenant_id, code, kind, value, min_spend, max_uses, description) VALUES (?, 'WELCOME10', 'percent', 10, 3000, 100, '10% off first visit')").bind(tenantId).run();
  // Bilingual out of the box (Claude/Workers AI when available, else the built-in glossary).
  await translateMenu(c.env.DB, { ...appEnv(), AI: (c.env as { AI?: never }).AI }, tenantId, actor);
  for (const [email, name] of [["ali@example.com", "Ali"], ["mei@example.com", "Mei"], ["sam@example.com", "Sam"]]) await ensureMember(c.env.DB, tenantId, email, { name });
  if (c.req.query("history")) {
    const branches = await Promise.all(
      [branchId, second.id].map(async (id, i) => ({
        ctx: await getBranch(c.env.DB, id),
        tables: (await c.env.DB.prepare("SELECT id, seats_max AS seatsMax FROM floor_tables WHERE branch_id = ? AND active = 1 AND parent_id IS NULL").bind(id).all<{ id: string; seatsMax: number }>()).results,
        scale: i === 0 ? 1 : 0.65,
      })),
    );
    const items = (
      await c.env.DB.prepare("SELECT i.id, i.name, i.price, i.station, c.name AS category FROM menu_items i JOIN menu_categories c ON c.id = i.category_id WHERE i.tenant_id = ? AND i.active = 1")
        .bind(tenantId)
        .all<{ id: string; name: string; price: number; station: string; category: string }>()
    ).results;
    await seedHistory(c.env.DB, { tenantId, branches, items });
    // a team that runs the floor, and a setup that was finished long ago
    const team: [string, string, string[]][] = [["Mei Chen", "waiter", [branchId]], ["Rizal Omar", "kitchen", [branchId]], ["Priya Nair", "branch_manager", [second.id]], ["Farid Hassan", "waiter", [second.id]]];
    for (const [name, role, ids] of team)
      await c.env.DB.prepare("INSERT INTO staff (user_id, tenant_id, email, name, role, branch_ids, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(newId("demo_"), tenantId, `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`, name, role, JSON.stringify(ids), Date.now() - 300 * 86_400_000)
        .run();
    await c.env.DB.prepare("UPDATE tenants SET onboarding = ? WHERE id = ?").bind(JSON.stringify({ allergensReviewed: true, queueReviewed: true, qrPrinted: true, loyaltyReviewed: true }), tenantId).run();
  }
  return c.json({ tenantId, slug, branches: [{ id: branchId, ref: `${slug}~klcc` }, { id: second.id, ref: `${slug}~${second.slug}` }], items: draft.items.length, tables: draft.tables.length }, 201);
});
