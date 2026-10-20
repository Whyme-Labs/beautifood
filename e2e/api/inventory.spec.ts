import { createServer, type Server } from "node:http";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { errorOf, eventually, hire, json, menuItems, runPipeline, seed } from "../helpers";

/** A webhook receiver in the test process. */
function receiver() {
  const got: any[] = [];
  const server: Server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => (got.push(JSON.parse(raw || "{}")), res.writeHead(200).end("ok")));
  });
  return {
    got,
    start: () => new Promise<string>((ok) => server.listen(0, "127.0.0.1", () => ok(`http://127.0.0.1:${(server.address() as { port: number }).port}/hook`))),
    stop: () => new Promise((ok) => server.close(ok)),
  };
}

test("inventory: orders use recipes' stock, running out sells dishes out, restocking brings back only what inventory sold out", async () => {
  const r = receiver();
  const url = await r.start();
  try {
    const s = await seed();
    const m = await menuItems(s.owner);
    const rojak = m.byName("Rojak");
    const cendol = m.byName("Cendol");
    await json(s.owner.post("/api/m/webhooks", { data: { url, events: ["inventory.low", "menu.sold_out", "menu.back_in_stock"], branches: [s.klcc.id] } }), 201);

    const peanut = await json(s.owner.post("/api/m/inventory/ingredients", { data: { name: "Peanut sauce", nameZh: "花生酱", unit: "g", cost: 3 } }), 201);
    const sugar = await json(s.owner.post("/api/m/inventory/ingredients", { data: { name: "Palm sugar", unit: "g" } }), 201);
    expect(peanut).toMatchObject({ name: "Peanut sauce", nameZh: "花生酱", unit: "g", cost: 3 });
    expect((await errorOf(s.owner.post("/api/m/inventory/ingredients", { data: { name: "peanut SAUCE", unit: "g" } }), 409)).code).toBe("ingredient_exists");
    await errorOf(s.owner.post("/api/m/inventory/ingredients", { data: { name: "Ice", unit: "bags" } }), 400);

    // recipes: Rojak uses both, Cendol only palm sugar
    expect(await json(s.owner.put(`/api/m/inventory/recipes/${rojak.id}`, { data: { lines: [{ ingredientId: peanut.id, qty: 100 }, { ingredientId: sugar.id, qty: 20 }] } }))).toMatchObject({
      itemId: rojak.id,
      lines: [
        { ingredientId: sugar.id, qty: 20 },
        { ingredientId: peanut.id, qty: 100 },
      ],
    });
    await json(s.owner.put(`/api/m/inventory/recipes/${cendol.id}`, { data: { lines: [{ ingredientId: sugar.id, qty: 50 }] } }));
    expect((await errorOf(s.owner.put(`/api/m/inventory/recipes/${cendol.id}`, { data: { lines: [{ ingredientId: "ing_nope", qty: 1 }] } }), 400)).code).toBe("unknown_ingredient");

    const order = (branch: string, items: { itemId: string; qty: number }[]) => json(s.owner.post(`/api/m/branches/${branch}/orders`, { data: { takeaway: true, items } }), 201);
    const stock = async (branch = s.klcc.id) => {
      const st = await json(s.owner.get(`/api/m/branches/${branch}/inventory`));
      return Object.fromEntries(st.items.map((i: any) => [i.name, i])) as Record<string, any>;
    };
    const soldOut = async (branch = s.klcc.id) => (await json(s.owner.get(`/api/m/menu?branch=${branch}`))).items.filter((i: any) => i.soldOut).map((i: any) => i.name).sort();

    // nothing is tracked yet: orders go through and use nothing
    await order(s.klcc.id, [{ itemId: rojak.id, qty: 1 }]);
    expect((await stock())["Peanut sauce"]).toMatchObject({ tracked: false, onHand: null, status: "untracked" });

    // a delivery starts tracking at KLCC; a low mark only once tracked
    expect((await errorOf(s.owner.patch(`/api/m/branches/${s.klcc.id}/inventory/stock/${peanut.id}`, { data: { lowAt: 150 } }), 409)).code).toBe("not_tracked");
    expect(await json(s.owner.post(`/api/m/branches/${s.klcc.id}/inventory`, { data: { ingredientId: peanut.id, kind: "received", qty: 250, cost: 750 } }), 201)).toMatchObject({ onHand: 250, status: "ok" });
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/inventory`, { data: { ingredientId: sugar.id, kind: "received", qty: 200 } }), 201);
    await json(s.owner.patch(`/api/m/branches/${s.klcc.id}/inventory/stock/${peanut.id}`, { data: { lowAt: 150 } }));

    // one Rojak takes peanut sauce down to its low mark
    await order(s.klcc.id, [{ itemId: rojak.id, qty: 1 }]);
    let st = await stock();
    expect(st["Peanut sauce"]).toMatchObject({ onHand: 150, lowAt: 150, status: "low" });
    expect(st["Palm sugar"]).toMatchObject({ onHand: 180, status: "ok" });
    expect((await json(s.owner.get(`/api/m/branches/${s.klcc.id}/inventory`))).low).toEqual([peanut.id]);

    // two more run it out (below zero: a sale is never refused for stock); Rojak sells out at KLCC only
    const big = await order(s.klcc.id, [{ itemId: rojak.id, qty: 2 }]);
    st = await stock();
    expect(st["Peanut sauce"]).toMatchObject({ onHand: -50, status: "out" });
    expect(st["Peanut sauce"].dishes).toEqual([{ id: rojak.id, name: "Rojak", soldOut: true, byInventory: true }]);
    expect(await soldOut()).toEqual(["Rojak"]);
    expect(await soldOut(s.bangsar.id)).toEqual([]);
    expect((await errorOf(s.owner.post(`/api/m/branches/${s.klcc.id}/orders`, { data: { takeaway: true, items: [{ itemId: rojak.id, qty: 1 }] } }), 409)).code).toBe("sold_out");
    // Bangsar doesn't track these: its orders use nothing
    await order(s.bangsar.id, [{ itemId: rojak.id, qty: 3 }]);
    expect((await stock(s.bangsar.id))["Peanut sauce"].tracked).toBe(false);

    // a manager sells Cendol out by hand
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/availability`, { data: { itemId: cendol.id, soldOut: true } }));

    // voiding the two Rojak puts their peanut sauce back: Rojak is on again
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/orders/${big.id}/void`, { data: { itemIds: [big.items[0].id], reason: "Wrong order" } }));
    st = await stock();
    expect(st["Peanut sauce"]).toMatchObject({ onHand: 150, status: "low" });
    expect(st["Palm sugar"].onHand).toBe(180);
    expect(await soldOut()).toEqual(["Cendol"]);

    // palm sugar thrown away (a reason is required) runs out: Rojak sells out again, Cendol was already out
    expect((await errorOf(s.owner.post(`/api/m/branches/${s.klcc.id}/inventory`, { data: { ingredientId: sugar.id, kind: "wastage", qty: 180 } }), 400)).code).toBe("reason_required");
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/inventory`, { data: { ingredientId: sugar.id, kind: "wastage", qty: 180, reason: "Ants" } }), 201);
    expect(await soldOut()).toEqual(["Cendol", "Rojak"]);
    // a delivery brings back what inventory sold out, not the manager's own sold-out
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/inventory`, { data: { ingredientId: sugar.id, kind: "received", qty: 1000 } }), 201);
    expect(await soldOut()).toEqual(["Cendol"]);

    // a count sets on hand outright; an adjustment needs a reason and a tracked ingredient
    expect(await json(s.owner.post(`/api/m/branches/${s.klcc.id}/inventory`, { data: { ingredientId: peanut.id, kind: "counted", qty: 80 } }), 201)).toMatchObject({ onHand: 80, status: "low" });
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/inventory`, { data: { ingredientId: peanut.id, kind: "adjusted", qty: 0.5, reason: "Found a tub" } }), 201);
    expect((await stock())["Peanut sauce"].onHand).toBe(80.5);
    expect((await errorOf(s.owner.post(`/api/m/branches/${s.bangsar.id}/inventory`, { data: { ingredientId: peanut.id, kind: "wastage", qty: 1, reason: "x" } }), 409)).code).toBe("not_tracked");

    // the ledger has every movement, newest first, with on hand after each
    const ledger = await json(s.owner.get(`/api/m/branches/${s.klcc.id}/inventory/movements?ingredient=${peanut.id}`));
    expect(ledger.map((x: any) => [x.kind, x.delta, x.onHand])).toEqual([
      ["adjusted", 0.5, 80.5],
      ["counted", -70, 80],
      ["returned", 200, 150],
      ["used", -200, -50],
      ["used", -100, 150],
      ["received", 250, 250],
    ]);
    expect(ledger.find((x: any) => x.kind === "received").cost).toBe(750);

    // connectors hear about it: low stock (with the ingredient as it stands), and dishes selling out and back
    await runPipeline(s.owner);
    const low = await eventually(async () => (await runPipeline(s.owner), r.got.find((g) => g.type === "inventory.low" && g.data.ingredientId === peanut.id)));
    expect(low).toMatchObject({ branch: { id: s.klcc.id }, data: { name: "Peanut sauce", unit: "g", ingredient: { id: peanut.id, name: "Peanut sauce", unit: "g" } } });
    expect(typeof low.data.ingredient.on_hand).toBe("number");
    await eventually(async () => (await runPipeline(s.owner), r.got.filter((g) => g.type === "menu.back_in_stock" && g.data.itemId === rojak.id).length === 2));
    const out = r.got.filter((g) => g.type === "menu.sold_out");
    // Rojak twice by inventory, Cendol once by hand
    expect(out.filter((g) => g.data.itemId === rojak.id).map((g) => g.data.by)).toEqual(["inventory", "inventory"]);
    expect(out.filter((g) => g.data.itemId === cendol.id).map((g) => g.data.by ?? "staff")).toEqual(["staff"]);
    expect(r.got.filter((g) => g.type === "inventory.low").map((g) => g.data.name)).toEqual(["Peanut sauce", "Palm sugar"]);
  } finally {
    await r.stop();
  }
});

test("inventory: who may do what, per branch and per restaurant; removing an ingredient takes it out of recipes", async () => {
  const s = await seed();
  const m = await menuItems(s.owner);
  const rojak = m.byName("Rojak");
  const rice = await json(s.owner.post("/api/m/inventory/ingredients", { data: { name: "Rice", unit: "kg" } }), 201);
  await json(s.owner.put(`/api/m/inventory/recipes/${rojak.id}`, { data: { lines: [{ ingredientId: rice.id, qty: 0.15 }] } }));

  // the kitchen sees stock and records deliveries and wastage at its own branch
  const kitchen = await hire(s.owner, "kitchen", [s.klcc.id]);
  const entry = (who: { api: APIRequestContext }, branch: string, data: Record<string, unknown>) => who.api.post(`/api/m/branches/${branch}/inventory`, { data: { ingredientId: rice.id, ...data } });
  await json(entry(kitchen, s.klcc.id, { kind: "received", qty: 10 }), 201);
  await json(entry(kitchen, s.klcc.id, { kind: "wastage", qty: 0.25, reason: "Burnt pot" }), 201);
  expect((await json(kitchen.api.get(`/api/m/branches/${s.klcc.id}/inventory`))).items[0]).toMatchObject({ name: "Rice", onHand: 9.75 });
  expect((await json(kitchen.api.get("/api/m/inventory/ingredients"))).map((i: any) => i.name)).toEqual(["Rice"]);
  // ...but not counts, corrections, low marks, ingredients or recipes; nor another branch
  await errorOf(entry(kitchen, s.klcc.id, { kind: "counted", qty: 3 }), 403);
  await errorOf(entry(kitchen, s.klcc.id, { kind: "adjusted", qty: 1, reason: "x" }), 403);
  await errorOf(kitchen.api.patch(`/api/m/branches/${s.klcc.id}/inventory/stock/${rice.id}`, { data: { lowAt: 2 } }), 403);
  await errorOf(kitchen.api.post("/api/m/inventory/ingredients", { data: { name: "Salt", unit: "g" } }), 403);
  await errorOf(kitchen.api.put(`/api/m/inventory/recipes/${rojak.id}`, { data: { lines: [] } }), 403);
  await errorOf(entry(kitchen, s.bangsar.id, { kind: "received", qty: 1 }), 403);
  await errorOf(kitchen.api.get(`/api/m/branches/${s.bangsar.id}/inventory`), 403);

  // a waiter doesn't work with stock at all
  const waiter = await hire(s.owner, "waiter", [s.klcc.id]);
  await errorOf(waiter.api.get(`/api/m/branches/${s.klcc.id}/inventory`), 403);
  await errorOf(waiter.api.get("/api/m/inventory/ingredients"), 403);

  // a branch manager runs it at their branch
  const manager = await hire(s.owner, "branch_manager", [s.klcc.id]);
  await json(entry(manager, s.klcc.id, { kind: "counted", qty: 9 }), 201);
  await json(manager.api.patch(`/api/m/branches/${s.klcc.id}/inventory/stock/${rice.id}`, { data: { lowAt: 2 } }));
  const salt = await json(manager.api.post("/api/m/inventory/ingredients", { data: { name: "Salt", unit: "g" } }), 201);
  await errorOf(entry(manager, s.bangsar.id, { kind: "counted", qty: 1 }), 403);

  // a unit can't change once the ingredient is in a recipe or stock
  expect((await errorOf(s.owner.patch(`/api/m/inventory/ingredients/${rice.id}`, { data: { unit: "g" } }), 409)).code).toBe("unit_in_use");
  expect(await json(s.owner.patch(`/api/m/inventory/ingredients/${salt.id}`, { data: { unit: "kg", cost: 120 } }))).toMatchObject({ unit: "kg", cost: 120 });

  // another restaurant sees and touches none of it
  const other = await seed();
  await errorOf(other.owner.patch(`/api/m/inventory/ingredients/${rice.id}`, { data: { name: "Mine" } }), 404);
  await errorOf(other.owner.get(`/api/m/inventory/recipes/${rojak.id}`), 404);
  await errorOf(other.owner.put(`/api/m/inventory/recipes/${rojak.id}`, { data: { lines: [] } }), 404);
  await errorOf(other.owner.get(`/api/m/branches/${s.klcc.id}/inventory`), 403);
  expect(await json(other.owner.get("/api/m/inventory/ingredients"))).toEqual([]);

  // rice runs out and Rojak sells out; removing rice from the restaurant puts Rojak back on
  await json(entry({ api: s.owner }, s.klcc.id, { kind: "counted", qty: 0 }), 201);
  expect((await json(s.owner.get(`/api/m/menu?branch=${s.klcc.id}`))).items.find((i: any) => i.id === rojak.id).soldOut).toBe(true);
  await json(s.owner.delete(`/api/m/inventory/ingredients/${rice.id}`));
  expect((await json(s.owner.get(`/api/m/menu?branch=${s.klcc.id}`))).items.find((i: any) => i.id === rojak.id).soldOut).toBe(false);
  expect(await json(s.owner.get(`/api/m/inventory/recipes/${rojak.id}`))).toEqual({ itemId: rojak.id, lines: [] });
  expect((await json(s.owner.get(`/api/m/branches/${s.klcc.id}/inventory`))).items.map((i: any) => i.name)).toEqual(["Salt"]);
});
