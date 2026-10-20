import { expect, test } from "@playwright/test";
import { errorOf, guestClient, hire, json, menuItems, seatWalkIn, seed, tableIds, uid } from "../helpers";

test("custom fields: defined per record type, typed values, public dish fields on the guest menu only", async () => {
  const s = await seed();
  const m = await menuItems(s.owner);
  const rojak = m.byName("Rojak");

  const halal = await json(s.owner.post("/api/m/fields", { data: { entity: "dish", label: { en: "Halal certified", zh: "清真认证" }, type: "boolean", public: true } }), 201);
  expect(halal).toMatchObject({ key: "halal_certified", type: "boolean", public: true, required: false });
  const supplier = await json(s.owner.post("/api/m/fields", { data: { entity: "dish", label: { en: "Supplier" }, type: "text" } }), 201);
  const spice = await json(s.owner.post("/api/m/fields", { data: { entity: "dish", label: { en: "Heat" }, type: "select", options: ["Mild", "Hot", "Very hot"], public: true } }), 201);
  // names are unique per record type; a choice needs choices; only dishes have public fields
  expect((await errorOf(s.owner.post("/api/m/fields", { data: { entity: "dish", label: { en: "supplier" }, type: "text" } }), 409)).code).toBe("field_exists");
  expect((await errorOf(s.owner.post("/api/m/fields", { data: { entity: "dish", label: { en: "Size" }, type: "select", options: ["One"] } }), 400)).code).toBe("invalid_field");
  expect((await json(s.owner.post("/api/m/fields", { data: { entity: "member", label: { en: "Birthday" }, type: "date", public: true } }), 201)).public).toBe(false);

  // values are typed and checked
  const set = await json(s.owner.put(`/api/m/fields/values/dish/${rojak.id}`, { data: { values: { halal_certified: "true", supplier: "  Pak Ali  ", heat: "hot", nope: "ignored" } } }));
  expect(set).toEqual({ halal_certified: true, supplier: "Pak Ali", heat: "Hot" });
  const bad = await errorOf(s.owner.put(`/api/m/fields/values/dish/${rojak.id}`, { data: { values: { heat: "Volcanic" } } }), 400);
  expect(bad.code).toBe("invalid_fields");
  expect(bad.data).toEqual({ heat: "must be one of: Mild, Hot, Very hot" });
  expect(await json(s.owner.get(`/api/m/fields/values/dish?ids=${rojak.id},nothing`))).toEqual({ [rojak.id]: set });

  // guests see the public fields and values, never the supplier
  const guest = await guestClient();
  const menu = await json(guest.get(`/api/public/branches/${s.klcc.ref}/menu?n=${uid()}`));
  expect(menu.fields.map((f: any) => f.key)).toEqual(["halal_certified", "heat"]);
  const item = menu.items.find((i: any) => i.id === rojak.id);
  expect(item.custom).toEqual({ halal_certified: true, heat: "Hot" });
  expect(JSON.stringify(menu)).not.toContain("Pak Ali");

  // making a field private takes it off the guest menu; clearing a value removes it
  await json(s.owner.patch(`/api/m/fields/${spice.id}`, { data: { public: false, label: { en: "Heat level" } } }));
  await json(s.owner.put(`/api/m/fields/values/dish/${rojak.id}`, { data: { values: { halal_certified: null } } }));
  const after = await json(guest.get(`/api/public/branches/${s.klcc.ref}/menu?n=${uid()}`));
  expect(after.fields.map((f: any) => f.key)).toEqual(["halal_certified"]);
  expect(after.items.find((i: any) => i.id === rojak.id).custom).toBeUndefined();

  // a required field must be set; removing a field removes its values
  await json(s.owner.patch(`/api/m/fields/${supplier.id}`, { data: { required: true } }));
  expect((await errorOf(s.owner.put(`/api/m/fields/values/dish/${rojak.id}`, { data: { values: { supplier: "" } } }), 400)).data).toEqual({ supplier: "is required" });
  await json(s.owner.delete(`/api/m/fields/${supplier.id}`));
  expect(await json(s.owner.get(`/api/m/fields/values/dish/${rojak.id}`))).toEqual({ heat: "Hot" });
  expect((await json(s.owner.get("/api/m/fields?entity=dish"))).map((f: any) => f.label.en)).toEqual(["Halal certified", "Heat level"]);

  // another restaurant can't see or touch these
  const other = await seed();
  await errorOf(other.owner.put(`/api/m/fields/values/dish/${rojak.id}`, { data: { values: { heat: "Mild" } } }), 404);
  await errorOf(other.owner.patch(`/api/m/fields/${spice.id}`, { data: { public: true } }), 404);
  expect(await json(other.owner.get(`/api/m/fields/values/dish?ids=${rojak.id}`))).toEqual({});
});

test("custom fields: orders, members and staff follow who may change them", async () => {
  const s = await seed();
  await json(s.owner.post("/api/m/fields", { data: { entity: "order", label: { en: "Delivery platform" }, type: "select", options: ["GrabFood", "foodpanda"] } }), 201);
  await json(s.owner.post("/api/m/fields", { data: { entity: "member", label: { en: "Birthday" }, type: "date" } }), 201);
  await json(s.owner.post("/api/m/fields", { data: { entity: "staff", label: { en: "Emergency contact" }, type: "text" } }), 201);

  // an order at KLCC: a KLCC waiter may tag it, a Bangsar waiter may not
  const t = await tableIds(s.owner, s.klcc.id);
  const m = await menuItems(s.owner);
  const st = await seatWalkIn(s.owner, s.klcc.id, [t.T3.id], 2);
  const o = await json(s.owner.post(`/api/m/branches/${s.klcc.id}/orders`, { data: { seatingId: st.seatingId, items: [{ itemId: m.byName("Rojak").id, qty: 1 }] } }), 201);
  const klccWaiter = await hire(s.owner, "waiter", [s.klcc.id]);
  const bangsarWaiter = await hire(s.owner, "waiter", [s.bangsar.id]);
  expect(await json(klccWaiter.api.put(`/api/m/fields/values/order/${o.id}`, { data: { values: { delivery_platform: "grabfood" } } }))).toEqual({ delivery_platform: "GrabFood" });
  await errorOf(bangsarWaiter.api.put(`/api/m/fields/values/order/${o.id}`, { data: { values: { delivery_platform: "foodpanda" } } }), 403);
  expect(await json(bangsarWaiter.api.get(`/api/m/fields/values/order?ids=${o.id}`))).toEqual({});
  expect(await json(klccWaiter.api.get(`/api/m/fields/values/order?ids=${o.id}`))).toEqual({ [o.id]: { delivery_platform: "GrabFood" } });

  // members: only people who manage members; dates are real dates
  const member = (await json(s.owner.get("/api/m/members"))).members[0];
  expect(member).toBeTruthy();
  expect((await errorOf(s.owner.put(`/api/m/fields/values/member/${member.id}`, { data: { values: { birthday: "2026-02-30" } } }), 400)).data).toEqual({ birthday: "must be a date (YYYY-MM-DD)" });
  expect(await json(s.owner.put(`/api/m/fields/values/member/${member.id}`, { data: { values: { birthday: "1990-05-17" } } }))).toEqual({ birthday: "1990-05-17" });
  await errorOf(klccWaiter.api.put(`/api/m/fields/values/member/${member.id}`, { data: { values: { birthday: "1990-05-18" } } }), 403);
  await errorOf(klccWaiter.api.get(`/api/m/fields/values/member?ids=${member.id}`), 403);

  // staff: managers record details for the people they manage, not for those above them
  const manager = await hire(s.owner, "branch_manager", [s.klcc.id]);
  expect(await json(manager.api.put(`/api/m/fields/values/staff/${klccWaiter.userId}`, { data: { values: { emergency_contact: "Mum 012-3456789" } } }))).toEqual({ emergency_contact: "Mum 012-3456789" });
  const ownerId = (await json(s.owner.get("/api/m/staff"))).staff.find((p: any) => p.role === "owner").userId;
  await errorOf(manager.api.put(`/api/m/fields/values/staff/${ownerId}`, { data: { values: { emergency_contact: "x" } } }), 403);
  await errorOf(klccWaiter.api.put(`/api/m/fields/values/staff/${klccWaiter.userId}`, { data: { values: { emergency_contact: "x" } } }), 403);

  // defining fields is for people who manage settings
  await errorOf(klccWaiter.api.post("/api/m/fields", { data: { entity: "order", label: { en: "Note" }, type: "text" } }), 403);
  expect((await json(klccWaiter.api.get("/api/m/fields"))).length).toBe(3);
});
