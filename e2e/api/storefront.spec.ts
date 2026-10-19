import { expect, test } from "@playwright/test";
import { errorOf, guestClient, hire, json, seed } from "../helpers";

test("storefront: designed from a description, saved as a draft, live only once published", async () => {
  const s = await seed();
  const guest = await guestClient();
  const before = await json(guest.get(`/api/public/storefronts/${s.slug}`));
  expect(before).toMatchObject({ published: false, restaurant: { slug: s.slug }, branches: [{ ref: s.klcc.ref }, { ref: s.bangsar.ref }] });
  expect(before.design.sections.map((x: any) => x.type)).toContain("queue");

  const d = await json(s.owner.post("/api/m/storefront/design", { data: { prompt: "A 1960s kopitiam feel, green and cream, put our story first", refine: false } }));
  expect(d.design.sections[0].type).toBe("story");
  await json(s.owner.put("/api/m/storefront", { data: { design: d.design } }));
  // a draft isn't public
  expect((await json(guest.get(`/api/public/storefronts/${s.slug}?n=1`))).published).toBe(false);
  await json(s.owner.post("/api/m/storefront/publish"));
  const live = await json(guest.get(`/api/public/storefronts/${s.slug}?n=2`));
  expect(live.published).toBe(true);
  expect(live.design.theme).toEqual(d.design.theme);
  // the page itself renders it
  const page = await (await guest.get(`/at/${s.slug}`)).text();
  expect(page).toContain('data-testid="storefront"');
  expect(page).toContain(d.design.theme.bg);

  // invalid designs are refused; unreadable colours are fixed on save
  expect((await errorOf(s.owner.put("/api/m/storefront", { data: { design: { ...d.design, sections: [...d.design.sections, d.design.sections[0]] } } }), 400)).code).toBe("invalid_storefront");
  const fixed = await json(s.owner.put("/api/m/storefront", { data: { design: { ...d.design, theme: { ...d.design.theme, bg: "#222222", surface: "#2a2a2a", ink: "#333333" } } } }));
  expect(fixed.draft.theme.ink).toBe("#ffffff");

  // only people who manage settings can change it
  const waiter = await hire(s.owner, "waiter", [s.klcc.id]);
  await errorOf(waiter.api.put("/api/m/storefront", { data: { design: d.design } }), 403);
  await errorOf(waiter.api.post("/api/m/storefront/publish"), 403);
});
