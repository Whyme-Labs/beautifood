// Timed menus and happy hours: what is served when, and at what price, in branch-local time.
import { describe, expect, it } from "vitest";
import { clockAt, daysLabel, endsAt, isOn, menuNow, nextStart, ruledPrice, serving, type PriceRule, type TimedMenu } from "../../src/shared/schedule";
import type { Menu, MenuItem } from "../../src/shared/types";

const MON = 1, TUE = 2, FRI = 5, SAT = 6, SUN = 0;
const at = (weekday: number, hhmm: string) => ({ weekday, minutes: Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)) });

const breakfast: TimedMenu = { id: "tm_b", name: "Breakfast", windows: [{ days: [1, 2, 3, 4, 5], from: "07:00", to: "11:00" }, { days: [6, 0], from: "08:00", to: "12:00" }], branches: ["*"], active: true, sort: 0 };
const supper: TimedMenu = { id: "tm_s", name: "Supper", windows: [{ days: [5, 6], from: "22:00", to: "02:00" }], branches: ["br_klcc"], active: true, sort: 1 };
const happy: PriceRule = { id: "pr_h", name: "Happy hour", kind: "percent", value: 30, categories: ["cat_drinks"], items: [], windows: [{ days: [1, 2, 3, 4, 5], from: "15:00", to: "18:00" }], branches: ["*"], active: true };
const dish = (p: Partial<MenuItem>) => ({ id: "itm", categoryId: "cat_mains", price: 1290, menuIds: [], ...p });

describe("seasons and promotions with dates", () => {
  // Durian season: every day 11:00–22:00, 1 Oct – 30 Nov 2026
  const durian = [{ days: [0, 1, 2, 3, 4, 5, 6], from: "11:00", to: "22:00", start: "2026-10-01", end: "2026-11-30" }];
  const on = (weekday: number, hhmm: string, date: string) => ({ ...at(weekday, hhmm), date });

  it("runs only between its dates", () => {
    expect(isOn(durian, on(MON, "12:00", "2026-10-19"))).toBe(true);
    expect(isOn(durian, on(MON, "12:00", "2026-09-28"))).toBe(false);
    expect(isOn(durian, on(TUE, "12:00", "2026-12-01"))).toBe(false);
    // a clock without a date ignores dates (as before)
    expect(isOn(durian, at(MON, "12:00"))).toBe(true);
  });

  it("starts on its first day, and is over after its last", () => {
    // Monday 28 Sep: the season starts Thursday 1 Oct
    expect(nextStart(durian, on(MON, "12:00", "2026-09-28"))).toEqual({ weekday: 4, time: "11:00", today: false });
    expect(nextStart(durian, on(MON, "23:00", "2026-11-30"))).toBeNull();
  });
});

describe("windows", () => {
  it("are on from the start minute up to (not including) the end", () => {
    expect(isOn(breakfast.windows, at(MON, "06:59"))).toBe(false);
    expect(isOn(breakfast.windows, at(MON, "07:00"))).toBe(true);
    expect(isOn(breakfast.windows, at(MON, "10:59"))).toBe(true);
    expect(isOn(breakfast.windows, at(MON, "11:00"))).toBe(false);
    expect(isOn(breakfast.windows, at(SAT, "11:30"))).toBe(true); // weekend hours are later
  });

  it("run past midnight into the next day, including Saturday night into Sunday", () => {
    expect(isOn(supper.windows, at(FRI, "23:30"))).toBe(true);
    expect(isOn(supper.windows, at(SAT, "01:30"))).toBe(true);
    expect(isOn(supper.windows, at(SUN, "01:59"))).toBe(true);
    expect(isOn(supper.windows, at(SUN, "02:00"))).toBe(false);
    expect(isOn(supper.windows, at(MON, "01:00"))).toBe(false);
  });

  it("say when they next start and when the current one ends", () => {
    expect(nextStart(breakfast.windows, at(MON, "12:00"))).toEqual({ weekday: TUE, time: "07:00", today: false });
    expect(nextStart(breakfast.windows, at(MON, "05:00"))).toEqual({ weekday: MON, time: "07:00", today: true });
    expect(nextStart(breakfast.windows, at(FRI, "12:00"))).toEqual({ weekday: SAT, time: "08:00", today: false });
    expect(nextStart(breakfast.windows, at(SUN, "13:00"))).toEqual({ weekday: MON, time: "07:00", today: false }); // across the week's end
    expect(endsAt(breakfast.windows, at(MON, "08:00"))).toBe("11:00");
    expect(endsAt(supper.windows, at(SAT, "23:00"))).toBe("02:00");
    expect(endsAt(breakfast.windows, at(MON, "12:00"))).toBeNull();
  });

  it("read the branch's own clock", () => {
    // 2026-10-19 is a Monday; 07:30 UTC is 15:30 in Kuala Lumpur and 08:30 in London
    const t = Date.UTC(2026, 9, 19, 7, 30);
    expect(clockAt(t, "Asia/Kuala_Lumpur")).toEqual({ ...at(MON, "15:30"), date: "2026-10-19" });
    expect(clockAt(t, "Europe/London")).toEqual({ ...at(MON, "08:30"), date: "2026-10-19" });
    expect(clockAt(Date.UTC(2026, 9, 18, 17, 0), "Asia/Kuala_Lumpur")).toEqual({ ...at(MON, "01:00"), date: "2026-10-19" }); // Sunday UTC, Monday local
  });
});

describe("serving", () => {
  it("a dish on no menu is served whenever the branch is open, at its price", () => {
    expect(serving(dish({}), [breakfast], [], at(MON, "20:00"))).toMatchObject({ servedNow: true, price: 1290, rule: null });
  });

  it("a breakfast dish is served at breakfast only, and says when breakfast is next", () => {
    const toast = dish({ menuIds: ["tm_b"] });
    expect(serving(toast, [breakfast], [], at(MON, "08:00")).servedNow).toBe(true);
    expect(serving(toast, [breakfast], [], at(MON, "14:00"))).toMatchObject({ servedNow: false, next: { weekday: TUE, time: "07:00", menu: "Breakfast", menuId: "tm_b" } });
  });

  it("a dish on two menus is served while either is on, and the sooner one is named", () => {
    const lunch: TimedMenu = { ...breakfast, id: "tm_l", name: "Lunch", windows: [{ days: [1, 2, 3, 4, 5], from: "11:30", to: "15:00" }] };
    const both = dish({ menuIds: ["tm_b", "tm_l"] });
    expect(serving(both, [breakfast, lunch], [], at(MON, "12:00")).servedNow).toBe(true);
    expect(serving(both, [breakfast, lunch], [], at(MON, "11:10")).next).toMatchObject({ menu: "Lunch", time: "11:30", today: true });
  });

  it("happy hour prices the drinks it covers while it is on, and nothing else", () => {
    const teh = dish({ id: "itm_teh", categoryId: "cat_drinks", price: 450 });
    expect(serving(teh, [], [happy], at(TUE, "16:00"))).toMatchObject({ price: 315, listPrice: 450, rule: { id: "pr_h" } });
    expect(serving(teh, [], [happy], at(TUE, "18:00"))).toMatchObject({ price: 450, rule: null });
    expect(serving(teh, [], [happy], at(SAT, "16:00")).price).toBe(450);
    expect(serving(dish({}), [], [happy], at(TUE, "16:00")).price).toBe(1290);
  });

  it("with two rules on, the guest gets the better price; an amount off never goes below zero", () => {
    const rm2 = { ...happy, id: "pr_rm2", kind: "amount" as const, value: 200 };
    expect(serving(dish({ categoryId: "cat_drinks", price: 450 }), [], [happy, rm2], at(TUE, "16:00"))).toMatchObject({ price: 250, rule: { id: "pr_rm2" } });
    expect(ruledPrice(150, rm2)).toBe(0);
    expect(ruledPrice(999, { kind: "percent", value: 15 })).toBe(849);
  });
});

describe("the menu now at a branch", () => {
  const menu: Menu = {
    version: 1,
    categories: [],
    items: [
      { ...(dish({ id: "itm_toast", menuIds: ["tm_b"] }) as MenuItem), name: "Kaya toast" },
      { ...(dish({ id: "itm_mee", menuIds: ["tm_s"] }) as MenuItem), name: "Maggi goreng" },
      { ...(dish({ id: "itm_teh", categoryId: "cat_drinks", price: 450 }) as MenuItem), name: "Teh tarik" },
    ],
    menus: [breakfast, supper, { ...breakfast, id: "tm_off", name: "Brunch", active: false }],
    rules: [happy],
  };

  it("keeps only this branch's menus and marks each dish", () => {
    const m = menuNow(menu, "br_bangsar", at(MON, "16:00"));
    expect(m.menus?.map((x) => x.id)).toEqual(["tm_b"]); // supper is KLCC-only, brunch is off
    const byId = Object.fromEntries(m.items.map((i) => [i.id, i]));
    expect(byId.itm_toast).toMatchObject({ servedNow: false, nextServed: { time: "07:00", weekday: TUE } });
    expect(byId.itm_mee).toBeUndefined(); // its only menu is KLCC's, so it isn't on Bangsar's menu
    expect(byId.itm_teh).toMatchObject({ price: 315, listPrice: 450, deal: { id: "pr_h", name: "Happy hour" } });
    expect(m.now).toEqual({ menus: [], deals: [{ id: "pr_h", name: "Happy hour", until: "18:00" }], dealsNext: [] });
  });

  it("at KLCC on Friday night, supper is on", () => {
    const m = menuNow(menu, "br_klcc", at(FRI, "23:00"));
    expect(m.now?.menus).toEqual([{ id: "tm_s", name: "Supper", until: "02:00" }]);
    expect(m.items.find((i) => i.id === "itm_mee")?.servedNow).toBe(true);
    expect(m.items.find((i) => i.id === "itm_toast")?.servedNow).toBe(false);
  });
});

it("labels days the way people write them", () => {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  expect(daysLabel([1, 2, 3, 4, 5], names, "Every day")).toBe("Mon–Fri");
  expect(daysLabel([0, 1, 2, 3, 4, 5, 6], names, "Every day")).toBe("Every day");
  expect(daysLabel([6, 0], names, "Every day")).toBe("Sat, Sun");
  expect(daysLabel([5, 6, 0], names, "Every day")).toBe("Fri–Sun");
  expect(daysLabel([1, 3, 5], names, "Every day")).toBe("Mon, Wed, Fri");
});
