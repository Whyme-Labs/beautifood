import { describe, it, expect } from "vitest";
import { parseMenuText, parseFloorText } from "../../src/shared/menuParser";
import { inferAllergens, inferDietary } from "../../src/shared/allergens";
import { can, canGrant, inBranchScope, ROLE_PERMISSIONS, GRANTABLE } from "../../src/shared/rbac";

const MENU = `
NOODLES
★ Char Kway Teow - RM12.90 - wok-fried flat rice noodles with prawns, egg and soy sauce
Penang Laksa ......... 14.50
  tamarind fish broth, chilli, mint
Vegetable Mee Goreng | 10.00 | fried yellow noodles, tofu, vegetables

Drinks:
Teh Tarik  4.5
Iced Lemon Tea - 5

Some line with no price
`;

describe("menu parser", () => {
  const parsed = parseMenuText(MENU);
  it("takes the price with its currency, though the name has a number in it", () => {
    const at = (line: string) => parseMenuText(`SETS\n${line}`).items.map((i) => [i.name, i.price]);
    expect(at("Ampang 6-Piece Set - RM11.90 - six pieces in soup")).toEqual([["Ampang 6-Piece Set", 1190]]);
    expect(at("Wings 8 pcs - RM12 - crispy")).toEqual([["Wings 8 pcs", 1200]]);
    expect(at("Ais Kacang - 6.50 - shaved ice, add durian RM1")).toEqual([["Ais Kacang", 650]]);
  });
  it("extracts categories and items with prices in minor units", () => {
    expect(parsed.categories).toEqual(["Noodles", "Drinks"]);
    expect(parsed.items.map((i) => [i.name, i.price])).toEqual([
      ["Char Kway Teow", 1290],
      ["Penang Laksa", 1450],
      ["Vegetable Mee Goreng", 1000],
      ["Teh Tarik", 450],
      ["Iced Lemon Tea", 500],
    ]);
  });
  it("detects signature, allergens, dietary, stations", () => {
    const ckt = parsed.items[0];
    expect(ckt.isSignature).toBe(true);
    expect(ckt.allergens).toEqual(expect.arrayContaining(["gluten", "crustaceans", "egg", "soy"]));
    const laksa = parsed.items[1];
    expect(laksa.description).toMatch(/tamarind/);
    expect(laksa.allergens).toContain("fish");
    expect(laksa.spiceLevel).toBeGreaterThan(0);
    const veg = parsed.items[2];
    expect(veg.dietary).toContain("vegetarian");
    expect(parsed.items[3].station).toBe("bar");
    expect(parsed.items[3].allergens).toContain("milk");
    expect(parsed.warnings.length).toBe(1);
  });
});

describe("allergen inference", () => {
  it("word-boundary matching avoids false positives", () => {
    expect(inferAllergens("Eggplant with garlic")).not.toContain("egg");
    expect(inferAllergens("Butterfly pea lemonade")).not.toContain("milk");
    expect(inferAllergens("Toasted coconut sorbet")).not.toContain("gluten");
    expect(inferAllergens("Two soft eggs")).toContain("egg");
    expect(inferAllergens("Coconut rice")).not.toContain("tree_nuts");
    expect(inferAllergens("Satay with peanut sauce")).toContain("peanuts");
  });
  it("reads what a dish leaves out, and what only sounds like an allergen", () => {
    expect(inferAllergens("black coffee, no milk")).not.toContain("milk");
    expect(inferAllergens("red curry made without shrimp paste or fish sauce, tofu")).toEqual(expect.not.arrayContaining(["crustaceans", "fish"]));
    expect(inferAllergens("served with or without egg")).toContain("egg");
    expect(inferAllergens("eggless vegan mayo, cashew-based vegan cheese")).toEqual(["tree_nuts"]);
    expect(inferAllergens("chicken in coconut milk")).not.toContain("milk");
    expect(inferAllergens("espresso, oat milk")).toEqual(["gluten"]);
    expect(inferAllergens("house-made soya bean milk")).toEqual(["soy"]);
    expect(inferAllergens("flat rice noodles, bean sprouts")).not.toContain("gluten");
    expect(inferAllergens("flat rice noodles, dark soy sauce")).toEqual(expect.arrayContaining(["gluten", "soy"]));
    expect(inferAllergens("fried fish cakes, kaffir lime")).toEqual(["fish"]);
    expect(inferAllergens("glutinous rice flour balls")).not.toContain("gluten");
    expect(inferAllergens("mushroom-based vegetarian oyster sauce")).not.toContain("molluscs");
  });
  it("knows ingredients a merchant won't spell out", () => {
    expect(inferAllergens("grilled freshwater eel")).toContain("fish");
    expect(inferAllergens("on an English muffin")).toContain("gluten");
    expect(inferAllergens("semolina sweet")).toContain("gluten");
    expect(inferAllergens("iced Milo")).toEqual(expect.arrayContaining(["gluten", "milk"]));
    expect(inferAllergens("hollandaise")).toEqual(expect.arrayContaining(["egg", "milk"]));
    expect(inferAllergens("chicken skewers, soy tare")).toEqual(expect.arrayContaining(["soy", "gluten"]));
    expect(inferDietary("grilled freshwater eel on rice").dietary).not.toContain("vegetarian");
  });
  it("knows the region's fish, soy words and hidden wheat", () => {
    expect(inferDietary("whole tilapia steamed with ginger").dietary).not.toContain("vegetarian");
    expect(inferAllergens("silken tauhu, taucu gravy")).toEqual(["soy"]);
    expect(inferAllergens("kailan with garlic and oyster sauce")).toEqual(expect.arrayContaining(["molluscs", "gluten"]));
    expect(inferAllergens("chana masala with asafoetida")).toContain("gluten");
    expect(inferAllergens("mint chutney made with curd")).toContain("milk");
    expect(inferAllergens("braised bean curd")).toEqual(["soy"]);
    expect(inferAllergens("onion fritters in gram flour and rice flour batter")).not.toContain("gluten");
    expect(inferAllergens("Bun Bo Hue - spicy beef broth with rice vermicelli")).not.toContain("gluten");
    expect(inferAllergens("Gluten-Free Chicken Ramen - rice noodles, gluten-free tamari, no wheat")).toEqual(["soy"]);
    expect(inferAllergens("Tonkotsu Ramen - thin wheat noodles")).toContain("gluten");
  });
  it("calls a dish vegan only when nothing suggests otherwise", () => {
    expect(inferDietary("rice, three vegetables, rasam (vegetarian)").dietary).not.toContain("vegan");
    expect(inferDietary("Roti canai with dhal").dietary).not.toContain("vegan");
    expect(inferDietary("Fresh lime juice").dietary).toContain("vegan");
    expect(inferDietary("Coconut sorbet (vegan)").dietary).toContain("vegan");
    expect(inferDietary("chicken, not spicy").spiceLevel).toBe(0);
  });
  it("dietary flags", () => {
    expect(inferDietary("Nasi lemak with ayam rendang").dietary).not.toContain("vegetarian");
    expect(inferDietary("Pork belly").dietary).not.toContain("halal_friendly");
    expect(inferDietary("Garden salad").dietary).toEqual(expect.arrayContaining(["vegetarian", "vegan"]));
  });
});

describe("floor parser", () => {
  it("parses counts, seats, zones, merge and split hints", () => {
    const t = parseFloorText("10 two-seaters, 6 tables of 4 in the patio that can be pushed together, 2 round tables of 10 that can split into 6 and 4");
    expect(t).toHaveLength(18);
    expect(t.filter((x) => x.seatsMax === 2)).toHaveLength(10);
    const patio = t.filter((x) => x.zone === "Patio");
    expect(patio).toHaveLength(6);
    expect(new Set(patio.map((x) => x.mergeGroup)).size).toBe(1);
    const round = t.filter((x) => x.seatsMax === 10);
    expect(round[0].splitConfig).toEqual([{ suffix: "a", seats: 6 }, { suffix: "b", seats: 4 }]);
    expect(new Set(t.map((x) => x.label)).size).toBe(18);
  });

  it("reads Chinese floor descriptions", () => {
    const t = parseFloorText("4张两人桌，2张四人桌可以拼桌和2张十人圆桌可以分成6和4");
    expect(t).toHaveLength(8);
    expect(t.filter((x) => x.seatsMax === 2)).toHaveLength(4);
    const fours = t.filter((x) => x.seatsMax === 4);
    expect(fours).toHaveLength(2);
    expect(fours[0].mergeGroup).not.toBeNull();
    expect(t.filter((x) => x.seatsMax === 10)[0].splitConfig).toEqual([{ suffix: "a", seats: 6 }, { suffix: "b", seats: 4 }]);
  });
});

describe("RBAC", () => {
  it("permission matrix", () => {
    expect(can({ role: "owner" }, "tenant.manage")).toBe(true);
    expect(can({ role: "admin" }, "tenant.manage")).toBe(false);
    expect(can({ role: "kitchen" }, "payment.take")).toBe(false);
    expect(can({ role: "kitchen" }, "kds.operate")).toBe(true);
    expect(can({ role: "cashier" }, "payment.refund")).toBe(false);
    expect(can({ role: "branch_manager" }, "payment.refund")).toBe(true);
    expect(can({ role: "marketing" }, "campaign.manage")).toBe(true);
    expect(can({ role: "waiter" }, "report.view")).toBe(false);
  });
  it("branch scoping", () => {
    expect(inBranchScope({ role: "cashier", branches: ["b1"] }, "b2")).toBe(false);
    expect(inBranchScope({ role: "cashier", branches: ["b1"] }, "b1")).toBe(true);
    expect(inBranchScope({ role: "owner", branches: [] }, "b2")).toBe(true);
  });
  it("no privilege escalation via grants", () => {
    for (const [role, grantable] of Object.entries(GRANTABLE)) {
      for (const g of grantable) {
        const mine = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS];
        for (const p of ROLE_PERMISSIONS[g]) expect(mine.has(p), `${role} granting ${g} (${p})`).toBe(true);
      }
    }
  });
  it("the general grant rule (only what you hold, tenant-wide only from tenant-wide) gives exactly the built-in table", () => {
    const roles = Object.keys(ROLE_PERMISSIONS) as (keyof typeof ROLE_PERMISSIONS)[];
    for (const by of roles) for (const target of roles) expect(canGrant({ role: by }, { role: target }), `${by} → ${target}`).toBe(GRANTABLE[by].includes(target));
  });
  it("custom roles: permissions as listed, scope as set, and never more than the grantor holds", () => {
    const supervisor = { role: "rl_sup", perms: ["queue.operate", "order.create", "order.void", "payment.refund"] as const, tenantWide: false };
    expect(can(supervisor, "order.void")).toBe(true);
    expect(can(supervisor, "report.view")).toBe(false);
    expect(inBranchScope({ ...supervisor, branches: ["b1"] }, "b2")).toBe(false);
    expect(inBranchScope({ ...supervisor, tenantWide: true, branches: [] }, "b2")).toBe(true);
    expect(canGrant({ role: "branch_manager" }, supervisor)).toBe(true);
    expect(canGrant({ role: "cashier" }, supervisor)).toBe(false); // can't manage staff
    expect(canGrant({ role: "branch_manager" }, { ...supervisor, perms: [...supervisor.perms, "member.manage"] })).toBe(false); // BM lacks member.manage
    expect(canGrant({ role: "branch_manager" }, { ...supervisor, tenantWide: true })).toBe(false);
    expect(canGrant({ role: "rl_mgr", perms: ["staff.manage", "queue.operate"] }, { role: "waiter" })).toBe(false); // waiter can do more than this manager
    expect(canGrant({ role: "rl_mgr", perms: ["staff.manage", "queue.operate", "order.create", "booking.manage", "kds.operate"] }, { role: "waiter" })).toBe(true);
  });
});

describe("what a dish usually has that its text doesn't say", () => {
  it("suggests it for the merchant to confirm, with the reason", async () => {
    const { likelyAllergens } = await import("../../src/shared/dishKnowledge");
    const pho = likelyAllergens("Pho Bo", "beef broth, rice noodles, basil");
    expect(pho.map((l) => l.allergen)).toEqual(["fish"]);
    expect(pho[0].because.en).toMatch(/fish sauce/);
    expect(likelyAllergens("Kangkung Sambal", "water spinach with chilli").map((l) => l.allergen)).toContain("crustaceans");
  });
  it("not what the text already says, rules out, or a vegan dish can't have", async () => {
    const { likelyAllergens } = await import("../../src/shared/dishKnowledge");
    expect(likelyAllergens("Vegan Pho", "mushroom broth, rice noodles (vegan)")).toEqual([]);
    expect(likelyAllergens("Pho Ga", "chicken broth with fish sauce")).toEqual([]);
    expect(likelyAllergens("Tom Yum Soup", "no fish sauce, no shrimp paste").map((l) => l.allergen)).toEqual([]);
    expect(likelyAllergens("Sesame Glutinous Rice Balls", "glutinous rice dumplings with black sesame")).toEqual([]);
  });
});

describe("Workers AI's reading of a menu at onboarding", () => {
  it("adds what a cook would know as suggestions, keeping only real allergens the text doesn't rule out", async () => {
    const { aiLikelyAllergens } = await import("../../src/server/ai/likelyAi");
    const ai = {
      run: async () => ({
        response: 'Sure: {"dishes":[{"n":1,"likely":[{"allergen":"fish","because":"fish sauce in the broth"},{"allergen":"msg","because":"x"}]},{"n":2,"likely":[{"allergen":"fish","because":"anchovy stock"}]},{"n":9,"likely":[{"allergen":"egg"}]}]}',
      }),
    };
    const out = await aiLikelyAllergens(ai, [
      { name: "Pho Bo", description: "beef broth, rice noodles" },
      { name: "Vegan Laksa", description: "tofu, no fish sauce (vegan)" },
    ]);
    expect(out![0]).toEqual([{ allergen: "fish", because: { en: "fish sauce in the broth", zh: "fish sauce in the broth" } }]);
    expect(out![1]).toEqual([]);
  });
  it("gives nothing, and never fails setup, when the model can't be reached", async () => {
    const { aiLikelyAllergens } = await import("../../src/server/ai/likelyAi");
    expect(await aiLikelyAllergens({ run: async () => { throw new Error("down"); } }, [{ name: "Pho Bo" }])).toBeNull();
  });
});
