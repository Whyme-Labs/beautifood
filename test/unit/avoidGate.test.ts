// The model's reading is kept only when the message says something is avoided (src/shared/brain/avoidGate.ts).
import { describe, expect, it } from "vitest";
import { gateHint } from "../../src/shared/brain/avoidGate";
import { hintItems, type AvoidHint } from "../../src/shared/brain/avoidHint";

const h = (p: Partial<AvoidHint>): AvoidHint => ({ allergens: [], diets: [], meats: [], alcohol: false, ...p });
const kept = (msg: string, hint: AvoidHint) => hintItems(gateHint(msg, hint));

describe("the model's reading, checked against what the message says", () => {
  it.each([
    ["two plates of the chilli crab, it's so good", h({ allergens: ["crustaceans"] })],
    ["can I add a fried egg to my mee goreng?", h({ allergens: ["egg"] })],
    ["ada bir sejuk tak?", h({ alcohol: true })],
    ["is the rendang made with beef or chicken?", h({ meats: ["beef", "chicken"] })],
    ["我要一碗鸡饭，多点姜蓉", h({ meats: ["chicken"] })],
    ["I'm allergic to dust, can we sit outside?", h({ allergens: ["celery"] })],
    ["no MSG please, I'm sensitive to MSG", h({ allergens: ["soy"] })],
    ["I don't drink coffee, give me a barley", h({ alcohol: true })],
    ["anak saya tak makan sayur", h({ diets: ["vegetarian"] })],
    ["I'm not vegan, just curious about the tempeh", h({ diets: ["vegan"] })],
  ])("drops a reading when %j says nothing is avoided", (msg, hint) => expect(kept(msg, hint)).toEqual([]));

  it.each([
    ["doctor says no ocean stuff for me", h({ allergens: ["fish", "crustaceans", "molluscs"] })],
    ["my wife reacts badly to anything with a shell", h({ allergens: ["crustaceans", "molluscs"] })],
    ["saya tak boleh sentuh benda bersusu", h({ allergens: ["milk"] })],
    ["我老婆碰到带壳的海产就不行", h({ allergens: ["crustaceans", "molluscs"] })],
    ["We're Hindu, no cow please", h({ meats: ["beef"] })],
    ["i don't do dairy or eggs", h({ allergens: ["milk", "egg"] })],
    ["x mkn babi ya, 3 pax", h({ meats: ["pork"] })],
    ["none of us drink, so nothing with wine", h({ alcohol: true })],
    ["sotong makes my boy throw up", h({ allergens: ["molluscs"] })],
    ["kami makan halal sahaja", h({ diets: ["halal"] })],
  ])("keeps the reading of %j", (msg, hint) => expect(kept(msg, hint)).toEqual(hintItems(hint)));

  it("keeps the diet that is said, not one only read into it", () => {
    expect(kept("we're vegetarian and my son can't eat peanuts", h({ allergens: ["peanuts"], diets: ["vegetarian", "vegan"] }))).toEqual(["allergen:peanuts", "diet:vegetarian"]);
    expect(kept("I'm not vegetarian but my wife is vegetarian", h({ diets: ["vegetarian"] }))).toEqual(["diet:vegetarian"]);
  });
});
