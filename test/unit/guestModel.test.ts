import { describe, expect, it } from "vitest";
import { answerWithModel, guestModel, readTurn, type AiBinding } from "../../src/server/ai/guestModel";
import { answerLocally, type AssistantContext } from "../../src/server/ai/local";
import { costMicros, limitsFrom } from "../../src/server/ai/usage";
import { sampleDishes } from "../../src/shared/assistantEval";

// guard lives beside customerChat, which needs a database; import it on its own
const { guard } = await import("../../src/server/ai/index");

const dishes = sampleDishes();
const ctx = {
  restaurant: { name: "Ah Seng", cuisine: "", story: "", description: "" },
  branchName: "KLCC",
  currency: "MYR",
  menuLanguage: "en",
  items: dishes.map((d, n) => ({ ...d, categoryId: d.category, imageUrl: null, story: "", tags: [], modifiers: [], active: true, sort: n, soldOut: false, popularity: 0 })),
} as unknown as AssistantContext;

/** A Workers AI binding that plays back turns and records what it was sent. */
function fakeAi(turns: unknown[]) {
  const sent: Record<string, unknown>[] = [];
  const ai: AiBinding = { run: async (_m, input) => (sent.push(input), turns.shift()) };
  return { ai, sent };
}

describe("which questions the rules engine keeps", () => {
  it("keeps the plain asks and hands over the conversational ones", () => {
    for (const q of ["I'm allergic to peanuts, what can I eat?", "something under RM10", "tak pedas", "what's your signature?"]) expect(answerLocally(ctx, q).confident, q).toBe(true);
    for (const q of ["something light, I'm not very hungry", "what drink goes well with curry mee?", "we are 4 people, what should we share?", "which of those is the cheapest?", "difference between curry mee and laksa?", "hello"])
      expect(answerLocally(ctx, q).confident, q).toBe(false);
  });
});

describe("the small model", () => {
  it("is off unless a provider is chosen (or an Anthropic key is set, as before)", () => {
    expect(guestModel({})).toBeNull();
    expect(guestModel({ ASSISTANT_PROVIDER: "workers-ai" })).toBeNull(); // no binding
    expect(guestModel({ ASSISTANT_PROVIDER: "workers-ai", AI: { run: async () => ({}) } })).toMatchObject({ provider: "workers-ai", model: "@cf/google/gemma-4-26b-a4b-it" });
    expect(guestModel({ ANTHROPIC_API_KEY: "k" })).toMatchObject({ provider: "anthropic", model: "claude-haiku-5-5" });
    expect(guestModel({ ASSISTANT_PROVIDER: "off", ANTHROPIC_API_KEY: "k" })).toBeNull();
    expect(guestModel({ ASSISTANT_PROVIDER: "openai", ASSISTANT_BASE_URL: "https://api.deepseek.com/", ASSISTANT_API_KEY: "k", ASSISTANT_MODEL: "deepseek-chat" })).toMatchObject({ baseUrl: "https://api.deepseek.com" });
  });

  it("reads both Workers AI's reply shape and the OpenAI one", () => {
    expect(readTurn({ response: "hi", usage: { prompt_tokens: 10, completion_tokens: 2 } })).toEqual({ content: "hi", toolCalls: [], usage: { input: 10, output: 2 } });
    const t = readTurn({ response: null, tool_calls: [{ name: "search_menu", arguments: { query: "drink" } }] });
    expect(t.toolCalls[0].function).toEqual({ name: "search_menu", arguments: '{"query":"drink"}' });
    const o = readTurn({ choices: [{ message: { content: null, tool_calls: [{ id: "c1", function: { name: "get_dish", arguments: '{"id":"d1"}' } }] } }], usage: { prompt_tokens: 5, completion_tokens: 1 } });
    expect(o.toolCalls[0]).toMatchObject({ id: "c1", function: { name: "get_dish" } });
  });

  it("looks dishes up through the menu tools, even with sloppy arguments, and reports usage", async () => {
    const lime = dishes.find((d) => /lime/i.test(d.name))!;
    const { ai, sent } = fakeAi([
      { response: null, tool_calls: [{ name: "search_menu", arguments: { query: "lime" } }], usage: { prompt_tokens: 900, completion_tokens: 20 } },
      { response: `A ${lime.name} cuts through the curry nicely.`, usage: { prompt_tokens: 1200, completion_tokens: 30 } },
    ]);
    const uses: { input: number; output: number }[] = [];
    const r = await answerWithModel({ provider: "workers-ai", model: "@cf/google/gemma-4-26b-a4b-it", ai }, ctx, [{ role: "user", content: "what drink goes well with curry mee?" }], "en", (u) => uses.push(u), { mode: "tools" });
    expect(r).toMatchObject({ engine: "model", items: [{ id: lime.id }] });
    expect(uses).toEqual([
      { model: "@cf/google/gemma-4-26b-a4b-it", input: 900, output: 20 },
      { model: "@cf/google/gemma-4-26b-a4b-it", input: 1200, output: 30 },
    ]);
    // the tool's answer went back to the model, from the real menu data
    const second = sent[1].messages as { role: string; content: string }[];
    expect(second.find((m) => m.role === "tool")!.content).toContain(lime.name);
  });

  it("puts a normal menu in the prompt and answers in one call, without tools", async () => {
    const { ai, sent } = fakeAi([{ response: "Curry Mee is coconut curry; Penang Assam Laksa is sour tamarind fish broth.", usage: { prompt_tokens: 1500, completion_tokens: 40 } }]);
    const r = await answerWithModel({ provider: "workers-ai", model: "m", ai }, ctx, [{ role: "user", content: "curry mee vs laksa?" }], "en", () => {});
    expect(sent).toHaveLength(1);
    expect(sent[0].tools).toBeUndefined();
    const system = (sent[0].messages as { content: string }[])[0].content;
    expect(system).toContain("Penang Assam Laksa | 15.50");
    expect(system).toMatch(/allergens: /);
    expect(r.items.map((i) => i.name)).toEqual(expect.arrayContaining(["Curry Mee", "Penang Assam Laksa"]));
  });

  it("sends broken tool arguments back as valid JSON", async () => {
    const { ai, sent } = fakeAi([
      { choices: [{ message: { content: null, tool_calls: [{ id: "c1", function: { name: "search_menu", arguments: '{"query": "drink"} extra' } }] } }] },
      { response: "Try the lime juice." },
    ]);
    await answerWithModel({ provider: "workers-ai", model: "m", ai }, ctx, [{ role: "user", content: "a drink?" }], "en", () => {}, { mode: "tools" });
    const echoed = (sent[1].messages as { role: string; tool_calls?: { function: { arguments: string } }[] }[]).find((m) => m.tool_calls)!;
    expect(() => JSON.parse(echoed.tool_calls![0].function.arguments)).not.toThrow();
  });

  it("never lets a model put an allergen the guest named in front of them", () => {
    const q = "I'm allergic to peanuts, something light?";
    const safe = answerLocally(ctx, q);
    const peanut = dishes.find((d) => d.allergens.includes("peanuts"))!;
    const bad = guard(ctx, q, { answer: `Try the ${peanut.name}!`, items: [], engine: "model" }, safe, "en");
    expect(bad).toBe(safe);
    const fine = dishes.find((d) => !d.allergens.includes("peanuts"))!;
    const ok = guard(ctx, q, { answer: `Try the ${fine.name}.`, items: [{ id: fine.id, name: fine.name, price: fine.price }], engine: "model" }, safe, "en");
    expect(ok.engine).toBe("model");
    expect(ok.safetyNote).toBeTruthy();
    // asking about a dish that has it is fine: the answer is about that dish
    const about = guard(ctx, `does ${peanut.name} have peanuts?`, { answer: `Yes, ${peanut.name} contains peanuts.`, items: [], engine: "model" }, safe, "en");
    expect(about.engine).toBe("model");
  });
});

describe("what it costs", () => {
  it("prices calls by model, with a cautious guess for unknown ones", () => {
    // 8,000 tokens in and 600 out is a typical guest question
    expect(costMicros({ model: "@cf/google/gemma-4-26b-a4b-it", input: 8000, output: 600 })).toBe(980);
    expect(costMicros({ model: "claude-haiku-5-5", input: 8000, output: 600 })).toBe(1100);
    expect(costMicros({ model: "deepseek-chat", input: 8000, output: 600 }, "0.15,0.6")).toBe(1560);
    expect(costMicros({ model: "mystery", input: 1000, output: 0 })).toBe(4000);
  });

  it("has sensible limits unless set", () => {
    // the daily default stays inside Workers AI's free 10,000 neurons ($0.011 per 1,000 beyond them)
    expect(limitsFrom({})).toEqual({ perBranchDaily: 100, dailyUsd: 0.09, monthlyUsd: 3 });
    expect(limitsFrom({}).dailyUsd).toBeLessThan((10_000 / 1000) * 0.011);
    expect(limitsFrom({ ASSISTANT_DAILY_PER_BRANCH: "0", AI_DAILY_BUDGET_USD: "1", AI_MONTHLY_BUDGET_USD: "50" })).toEqual({ perBranchDaily: 0, dailyUsd: 1, monthlyUsd: 50 });
  });
});
