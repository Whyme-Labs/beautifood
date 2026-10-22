import { describe, expect, it } from "vitest";
import { widerAreas, actionsFor, tasteBrief, tasteLocation, type BriefInput } from "../../src/server/taste/brief";
import { items, tasteRunner, type Envelope, type Runner } from "../../src/server/taste/client";
import { likedThing, tasteHint } from "../../src/server/taste/bridge";
import { answerGuest } from "../../src/server/ai/brain";
import { sampleDishes } from "../../src/shared/assistantEval";
import type { AssistantContext } from "../../src/server/ai/local";

const ok = (results: unknown[]): Envelope => ({ status: "ok", results, result_count: results.length });
const input: BriefInput = {
  restaurant: "Ah Seng",
  cuisine: "Malaysian",
  location: "Bangsar, Kuala Lumpur",
  menu: [{ name: "Curry Mee", description: "coconut curry noodles", category: "Noodles" }, { name: "Teh Tarik", category: "Drinks" }],
  bestSellers: [{ name: "Curry Mee", qty: 120 }],
};

/** A fake taste service: answers by workflow and target, and records what it was asked. */
function fakeRunner(known: boolean) {
  const asked: { tool: string; args: Record<string, unknown> }[] = [];
  const run: Runner = async (tool, args) => {
    asked.push({ tool, args });
    if (tool === "qloo_find_tags") return ok([{ id: "urn:tag:genre:place:restaurant:malaysian", name: "Malaysian" }]);
    if (tool === "qloo_describe") return known ? ok([{ entity_id: "E-AHSENG", name: "Ah Seng Kopitiam" }]) : { status: "empty", results: [] };
    if (tool === "qloo_entity_tags") return ok([{ name: "Late night" }, { name: "Family friendly" }]);
    if (args.target_type === "place")
      return ok([
        { entity_id: "P1", name: "Nasi Kandar Pelita", tags: [{ id: "urn:tag:genre:place:restaurant:indian_muslim", name: "Indian Muslim" }, { id: "urn:tag:amenity:place:late_night", name: "Late night" }], affinity: 0.91 },
        { entity_id: "P2", name: "Village Park", tags: [{ id: "urn:tag:genre:place:restaurant:nasi_lemak", name: "Nasi Lemak" }, { id: "urn:tag:genre:place:restaurant:indian_muslim", name: "Indian Muslim" }, { id: "urn:tag:amenity:place:late_night", name: "Late night" }], affinity: 0.88 },
        { entity_id: "P3", name: "Sri Nirwana Maju", tags: ["Banana leaf rice", "Indian Muslim"], affinity: 0.8 },
      ]);
    if (args.target_type === "artist") return ok([{ name: "Yuna" }, { name: "Siti Nurhaliza" }, { name: "Joe Flizzow" }]);
    if (args.target_type === "tv_show") return ok([{ name: "Upin & Ipin" }]);
    return { status: "empty", results: [] };
  };
  return { run, asked };
}

describe("where Qloo should look", () => {
  it("reads the area from a branch's address", () => {
    expect(tasteLocation("Lot G-12, Jalan Telawi 3, Bangsar, 59100 Kuala Lumpur")).toBe("Bangsar, Kuala Lumpur");
    expect(tasteLocation("23 Jalan Sultan, Petaling Jaya, Selangor")).toBe("Petaling Jaya, Selangor");
    expect(tasteLocation("")).toBe("Kuala Lumpur");
  });
});

describe("the taste brief", () => {
  it("chains the Qloo workflows: the cuisine as a tag, then the area's restaurants, music and TV", async () => {
    const { run, asked } = fakeRunner(false);
    const b = await tasteBrief(run, input);
    expect(asked.map((a) => a.tool)).toEqual(expect.arrayContaining(["qloo_find_tags", "qloo_describe", "qloo_recommend"]));
    const cuisine = asked.find((a) => a.args.include_tags)!;
    expect(cuisine.args).toMatchObject({ target_type: "place", filter_location: "Bangsar, Kuala Lumpur", include_tags: ["urn:tag:genre:place:restaurant:malaysian"] });
    expect(b.findings.map((f) => f.key)).toEqual(["nearby", "cuisine", "music", "tv"]);
    // every finding says where it came from
    for (const f of b.findings) expect(f.source.asked).toBeTruthy();
    expect(b.limits.length).toBeGreaterThan(0);
  });

  it("asks the wider area when Qloo knows nothing for the branch's own (a mall, a street)", async () => {
    const { run: inner, asked } = fakeRunner(false);
    // as on the hackathon server: "Suria KLCC, Kuala Lumpur" has no results, "Kuala Lumpur" does
    const run: Runner = async (tool, args) => (String(args.signal_location ?? "").includes("Suria KLCC") ? (asked.push({ tool, args }), { status: "ok", results: [] }) : inner(tool, args));
    const b = await tasteBrief(run, { ...input, location: "Suria KLCC, Kuala Lumpur" });
    expect(b.location).toBe("Kuala Lumpur");
    expect(b.findings.map((f) => f.key)).toEqual(expect.arrayContaining(["nearby", "music", "tv"]));
    expect(b.findings.every((f) => !f.source.asked.includes("Suria KLCC"))).toBe(true);
    expect(b.gaps.some((g) => g.asked.includes("Suria KLCC"))).toBe(true);
    expect(widerAreas("Suria KLCC, Kuala Lumpur")).toEqual(["Suria KLCC, Kuala Lumpur", "Kuala Lumpur"]);
  });

  it("uses the restaurant itself as the signal when Qloo knows it", async () => {
    const { run, asked } = fakeRunner(true);
    const b = await tasteBrief(run, input);
    expect(asked.find((a) => a.args.target_type === "artist")!.args).toMatchObject({ signals: ["E-AHSENG"] });
    expect(b.findings.map((f) => f.key)).toContain("audience");
  });

  it("turns findings into things to try, each with its reason", async () => {
    const { run } = fakeRunner(false);
    const b = await tasteBrief(run, input);
    const kinds = b.actions.map((a) => a.kind);
    expect(kinds).toEqual(expect.arrayContaining(["special", "promo", "playlist", "theme_night"]));
    // a tag the area's favourites share that the menu doesn't serve
    expect(b.actions.find((a) => a.kind === "special")!.vars.tag).toBe("Indian Muslim");
    // each place counts once, though it's in two findings; "late night" is about hours, not a dish
    expect(b.actions.find((a) => a.kind === "special")!.vars.count).toBe(3);
    expect(b.actions.filter((a) => a.kind === "special").map((a) => a.vars.tag)).not.toContain("Late night");
    expect(b.actions.find((a) => a.kind === "hours")!.vars.tag).toBe("Late night");
    expect(b.actions.find((a) => a.kind === "playlist")!.text).toContain("Yuna");
    for (const a of b.actions) expect(a.why).toBeTruthy();
  });

  it("asks what the area's favourite places are known for when Qloo's results carry no tags, and suggests a special from it", async () => {
    const asked: { tool: string; args: Record<string, unknown> }[] = [];
    const uuid = (n: number) => `0000000${n}-aaaa-bbbb-cccc-dddddddddddd`;
    const run: Runner = async (tool, args) => {
      asked.push({ tool, args });
      if (tool === "qloo_find_tags") return ok([{ id: "urn:tag:genre:place:restaurant:malaysian", name: "Malaysian" }]);
      if (tool === "qloo_describe") return { status: "needs_input", results: [] };
      if (tool === "qloo_entity_tags") return ok([{ id: "urn:tag:genre:place:restaurant:indian_muslim", name: "Indian Muslim" }, { id: "urn:tag:amenity:place:late_night", name: "Late night" }, { id: "urn:tag:genre:place:restaurant:malaysian", name: "Malaysian" }]);
      if (args.target_type === "place") return ok([1, 2, 3].map((n) => ({ entity_id: uuid(n), name: `Place ${n}` })));
      if (args.target_type === "artist") return ok([{ name: "Yuna" }]);
      return ok([{ name: "Upin & Ipin" }]);
    };
    const b = await tasteBrief(run, { ...input, location: "Kuala Lumpur" });
    const call = asked.find((a) => a.tool === "qloo_entity_tags")!;
    expect(call.args).toMatchObject({ entity_type: "place", entities: [uuid(1), uuid(2), uuid(3)] });
    expect(b.findings.map((f) => f.key)).toContain("known_for");
    const special = b.actions.find((a) => a.kind === "special")!;
    expect(special.vars.tag).toBe("Indian Muslim");
    expect(special.why).toMatch(/3 places people around Kuala Lumpur love most/);
    expect(b.actions.find((a) => a.kind === "hours")!.vars.tag).toBe("Late night");
    // the menu's own cuisine isn't suggested as a special
    expect(b.actions.filter((a) => a.kind === "special").map((a) => a.vars.tag)).not.toContain("Malaysian");
  });

  it("doesn't ask for tags when the places already have them", async () => {
    const { run, asked } = fakeRunner(false);
    await tasteBrief(run, input);
    expect(asked.some((a) => a.tool === "qloo_entity_tags")).toBe(false);
  });

  it("names each artist once in a playlist, though Qloo holds some twice", () => {
    const music = items(ok([{ name: "Dato' Sri Siti Nurhaliza" }, { name: "Siti Nurhaliza" }, { name: "YOONA" }]));
    const a = actionsFor(input, [{ key: "music", items: music, source: { tool: "qloo_recommend", asked: "artists loved around Kuala Lumpur" } }]);
    expect(a.find((x) => x.kind === "playlist")!.vars.artists).toBe("Dato' Sri Siti Nurhaliza, YOONA");
  });

  it("doesn't suggest a special for what the menu already serves", () => {
    const actions = actionsFor({ ...input, menu: [{ name: "Indian Muslim mee goreng" }] }, [
      { key: "nearby", items: items(ok([{ name: "A", tags: ["Indian Muslim"] }, { name: "B", tags: ["Indian Muslim"] }])), source: { tool: "qloo_recommend", asked: "x" } },
    ]);
    expect(actions.some((a) => a.kind === "special")).toBe(false);
  });

  it("says what it couldn't find instead of failing", async () => {
    const b = await tasteBrief(async () => ({ status: "error", summary: "down", error: { code: "TASTE_UNREACHABLE", retryable: true, recovery: "" } }), input);
    expect(b.findings).toEqual([]);
    expect(b.gaps.length).toBeGreaterThan(0);
  });
});

describe("the taste service client", () => {
  it("is off without its address and secret", async () => {
    expect((await tasteRunner({})("qloo_recommend", {})).error?.code).toBe("TASTE_OFF");
  });

  it("calls the service with the secret and passes the envelope back", async () => {
    let seen: { url: string; auth: string | null; body: unknown } | null = null;
    const fetcher = (async (url: string, init: RequestInit) => {
      seen = { url, auth: new Headers(init.headers).get("authorization"), body: JSON.parse(String(init.body)) };
      return new Response(JSON.stringify(ok([{ name: "Yuna" }])));
    }) as unknown as typeof fetch;
    const e = await tasteRunner({ TASTE_URL: "https://taste.example/", TASTE_SECRET: "s3cret" }, fetcher)("qloo_recommend", { target_type: "artist" });
    expect(seen).toEqual({ url: "https://taste.example/v1/run", auth: "Bearer s3cret", body: { tool: "qloo_recommend", args: { target_type: "artist" } } });
    expect(items(e)[0].name).toBe("Yuna");
  });

  it("reads results tolerantly", () => {
    expect(items(ok([{ entity_id: "x", name: "N", tags: [{ name: "t" }, "u"], affinity: 0.5, properties: { address: "KL" } }, { nope: 1 }]))).toEqual([
      { id: "x", name: "N", type: undefined, score: 0.5, popularity: undefined, tags: ["t", "u"], tagIds: [undefined, undefined], place: "KL", description: undefined },
    ]);
  });
});

describe("the taste bridge for guests", () => {
  const dishes = sampleDishes();
  const ctx = {
    restaurant: { name: "Ah Seng", cuisine: "Malaysian", story: "", description: "" },
    branchName: "KLCC",
    currency: "MYR",
    menuLanguage: "en",
    items: dishes.map((d, n) => ({ ...d, categoryId: d.category, imageUrl: null, story: "", tags: [], modifiers: [], active: true, sort: n, soldOut: false, popularity: 0 })),
  } as never as AssistantContext;
  // fans of a K-pop group near KLCC: fried chicken and milk-tea places
  const kpop: Runner = async (tool, args) =>
    tool === "qloo_recommend" && Array.isArray(args.signals)
      ? ok([
          { entity_id: "K1", name: "Chicken Hof", tags: [{ name: "Korean Fried Chicken" }, { name: "Late night" }] },
          { entity_id: "K2", name: "Tealive", tags: [{ name: "Bubble Tea" }, { name: "Milk Tea" }] },
          { entity_id: "K3", name: "Seoul Garden", tags: [{ name: "Korean Fried Chicken" }] },
        ])
      : { status: "empty", results: [] };

  it("hears a taste in what guests say, but not a dish or a flavour", () => {
    expect(likedThing("I love BTS, what should I eat?")).toBe("BTS");
    expect(likedThing("big fan of Studio Ghibli, anything for me?")).toBe("Studio Ghibli");
    expect(likedThing("I'm really into K-pop")).toBe("K-pop");
    expect(likedThing("saya suka Siti Nurhaliza, cadangkan makanan")).toBe("Siti Nurhaliza");
    expect(likedThing("我喜欢周杰伦，推荐什么？")).toBe("周杰伦");
    expect(likedThing("I love spicy food")).toBeNull();
    expect(likedThing("I like the curry mee", ["Curry Mee"])).toBeNull();
    expect(likedThing("what's good here?")).toBeNull();
  });

  it("asks Qloo with only the name the guest typed, and boosts the dishes fans' places are known for", async () => {
    const asked: Record<string, unknown>[] = [];
    const h = await tasteHint(async (t, a) => (asked.push(a), kpop(t, a)), ctx.items, "BTS", "Kuala Lumpur");
    expect(asked[0]).toEqual({ target_type: "place", signals: ["BTS"], filter_location: "Kuala Lumpur", limit: 10 });
    const boosted = Object.keys(h!.boost).map((id) => dishes.find((d) => d.id === id)!.name);
    expect(boosted).toEqual(expect.arrayContaining(["Nasi Lemak Ayam Rempah", "Teh Tarik"]));
    expect(h!.because[0]).toBe("Korean Fried Chicken");
  });

  it("shapes the brain's picks, says where it came from, and never overrides an allergy", async () => {
    const h = await tasteHint(kpop, ctx.items, "BTS", "Kuala Lumpur");
    const r = answerGuest(ctx, [{ role: "user", content: "I love BTS, what should I get?" }], "en", h);
    expect(r.answer).toMatch(/Fans of BTS around here lean towards Korean Fried Chicken/);
    expect(r.answer).toMatch(/not a guess about you/);
    expect(r.taste).toMatchObject({ liked: "BTS", source: "Qloo" });
    expect(r.items.map((i) => i.name)).toContain("Nasi Lemak Ayam Rempah");
    // nasi lemak has peanuts: a guest who said so never gets it, Qloo or not
    const safe = answerGuest(ctx, [{ role: "user", content: "I'm allergic to peanuts" }, { role: "assistant", content: "Noted." }, { role: "user", content: "I love BTS, what should I get?" }], "en", h);
    expect(safe.items.map((i) => i.name)).not.toContain("Nasi Lemak Ayam Rempah");
    for (const x of safe.items) expect(dishes.find((d) => d.id === x.id)!.allergens).not.toContain("peanuts");
    expect(safe.safetyNote).toBeTruthy();
  });
});
