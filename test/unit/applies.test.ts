// What a guest says they avoid counts only when it applies to this meal: not an allergy outgrown,
// someone who isn't here, a denial or a hypothetical. And a dish's own leave-off is not an allergy.
import { describe, expect, it } from "vitest";
import { applicable } from "../../src/server/ai/brain/applies";
import { understand } from "../../src/server/ai/brain/understand";
import { contextAt, DEMO_MENUS } from "../../src/server/ai/demoMenus";
import { hintItems } from "../../src/shared/brain/avoidHint";

const items = contextAt(DEMO_MENUS[0], { weekday: 3, minutes: 12 * 60 + 30, date: "2026-10-21" } as never).items;
const reads = (text: string) => {
  const u = understand(items as never, text);
  return hintItems({ allergens: u.stated.filter((a) => !u.leaveOff.includes(a)), diets: u.statedDiet, meats: u.noMeat, alcohol: u.saysNoAlcohol });
};

describe("what doesn't apply to this meal", () => {
  it.each([
    "I was allergic to milk when I was small, these days no problem",
    "dulu saya vegetarian, sekarang dah makan semua",
    "我以前不吃牛肉，现在吃了",
    "my uncle can't take shellfish but he isn't joining us tonight",
    "kakak saya alah udang, tapi dia tak ikut",
    "我女儿对花生过敏，不过她今天没来",
    "not a vegetarian, just want something light",
    "saya bukan Muslim, apa yang paling sedap?",
    "我不是过敏，就想知道里面有没有芝麻",
    "if a guest was allergic to nuts, would the kitchen know? just curious",
    "could I get a baby chair please",
    "fried rice no egg please, I don't like it",
    "mee goreng saya tanpa telur",
    "炒饭不要放蛋",
  ])("reads nothing to avoid in %j", (text) => expect(reads(text)).toEqual([]));

  it.each([
    ["I'm allergic to peanuts, my husband isn't coming", "allergen:peanuts"],
    ["last time I ate prawns my lips swelled, please no prawns", "allergen:crustaceans"],
    ["I'm not vegetarian but my son is allergic to egg", "allergen:egg"],
    ["fried rice no egg, I'm allergic", "allergen:egg"],
    ["tak nak telur dalam mee, saya tak boleh makan telur", "allergen:egg"],
    ["炒饭不要加花生，我吃了会肿", "allergen:peanuts"],
    ["we don't drink, no alcohol please", "alcohol"],
    ["mak saya tak makan daging lembu", "meat:beef"],
    // what must not be taken out: a present allergy beside curiosity, "can't make it" about spice, "still"
    ["does the laksa have prawns? just asking because I'm allergic", "allergen:crustaceans"],
    ["my wife is allergic to prawns, can't make it too spicy", "allergen:crustaceans"],
    ["我儿子对花生过敏，辣度不在意", "allergen:peanuts"],
    ["next time please don't put peanuts, I'm allergic", "allergen:peanuts"],
    ["小时候就对花生过敏，现在也是", "allergen:peanuts"],
    ["as a kid I was allergic to peanuts, now it's worse", "allergen:peanuts"],
    ["kalau orang alah kacang macam saya, boleh makan apa?", "allergen:peanuts"],
    ["I'm not vegetarian but my wife is vegetarian", "diet:vegetarian"],
    ["saya bukan Muslim tapi suami saya Muslim", "diet:halal"],
    ["my son was allergic to egg as a baby and still is, now 5 years old", "allergen:egg"],
    ["dulu saya alah udang, sekarang pun masih alah", "allergen:crustaceans"],
    ["I'm allergic to shellfish, my friend couldn't come so table for one", "allergen:crustaceans"],
    ["my husband is vegetarian, he's not here yet, coming later", "diet:vegetarian"],
    ["no peanuts, I'm allergic. not vegetarian though", "allergen:peanuts"],
  ])("still reads %j", (text, item) => expect(reads(text)).toContain(item));

  it("doesn't read a meat-named beef as vegetarian, or squid as fish", () => {
    expect(reads("mak saya tak makan daging lembu")).not.toContain("diet:vegetarian");
    expect(reads("我对鱿鱼过敏")).toEqual(["allergen:molluscs"]);
  });

  it("leaves a message that all applies as it is", () => {
    expect(applicable("I'm allergic to prawns, what's safe?")).toBe("I'm allergic to prawns, what's safe?");
  });
});
