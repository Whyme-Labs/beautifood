import { describe, it, expect } from "vitest";
import { parseMenuText, parseFloorText } from "../../src/shared/menuParser";
import { inferAllergens, inferDietary } from "../../src/shared/allergens";
import { can, inBranchScope, ROLE_PERMISSIONS, GRANTABLE } from "../../src/shared/rbac";

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
    expect(inferAllergens("Eggplant with garlic")).toContain("egg"); // conservative: flag for review
    expect(inferAllergens("Coconut rice")).not.toContain("tree_nuts");
    expect(inferAllergens("Satay with peanut sauce")).toContain("peanuts");
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
});
