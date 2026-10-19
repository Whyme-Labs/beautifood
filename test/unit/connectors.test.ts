// The connectors kit and the storefront template, against Beautifood's own signer and payload shapes.
import { afterEach, describe, expect, it, vi } from "vitest";
import { signature } from "../../src/server/webhookSign";
import { verify, type BeautifoodEvent } from "../../templates/connectors-worker/src/beautifood";
import { handleHook } from "../../templates/connectors-worker/src/index";
import { slackText } from "../../templates/connectors-worker/src/connectors/slack";
import { waNumber, whatsappMessage } from "../../templates/connectors-worker/src/connectors/whatsapp";
import { xeroInvoice } from "../../templates/connectors-worker/src/connectors/xero";
import { matchItems } from "../../templates/connectors-worker/src/connectors/delivery";
import { esc, render, type StorefrontPayload } from "../../templates/storefront-worker/src/render";
import { PRESETS, DEFAULT_SECTIONS } from "../../src/shared/storefront";

const SECRET = "whsec_test";
const event = (type: string, data: BeautifoodEvent["data"]): BeautifoodEvent => ({ id: "evt_1", type, created_at: "2026-10-19T12:41:07.000Z", restaurant: { id: "tn_1", name: "Auntie Lim's", slug: "auntie-lim" }, branch: { id: "br_1", name: "KLCC", slug: "klcc" }, data });
const paid = event("order.paid", {
  order: {
    id: "or_1",
    number: "1042",
    type: "dine_in",
    items: [
      { id: "oi_1", item_id: "itm_1", name: "Char Kway Teow", qty: 2, unit_price: 1690, list_price: null, deal: null, modifiers: [] },
      { id: "oi_2", item_id: "itm_2", name: "Teh Tarik", qty: 1, unit_price: 385, list_price: 550, deal: "Happy hour", modifiers: [{ group: "Temperature", option: "Iced", price: 50 }] },
    ],
    subtotal: 3815,
    discount: 0,
    service_charge: 382,
    tax: 252,
    rounding: 1,
    total: 4450,
    paid: 4450,
    payments: [{ method: "card", amount: 4450, label: null }],
  },
});

describe("signatures", () => {
  it("what Beautifood signs, the kit accepts; anything else it refuses", async () => {
    const body = JSON.stringify(paid);
    const sig = await signature(SECRET, body, Date.now());
    expect(await verify(body, sig, SECRET)).toBe(true);
    expect(await verify(body + " ", sig, SECRET)).toBe(false);
    expect(await verify(body, sig, "whsec_other")).toBe(false);
    expect(await verify(body, await signature(SECRET, body, Date.now() - 10 * 60_000), SECRET)).toBe(false); // too old
    expect(await verify(body, null, SECRET)).toBe(false);
  });
});

describe("connectors", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("Slack: plain words for the moments that matter", () => {
    expect(slackText(event("menu.sold_out", { item: { id: "i", name: "Cendol", price: 850 } }))).toBe(":no_entry: *Cendol* is sold out at Auntie Lim's · KLCC.");
    expect(slackText(event("shift.closed", { expected: 50000, counted: 49500, variance: -500 }))).toMatch(/\(\*-RM\s?5\.00\*\)/);
    expect(slackText(event("order.paid", {}))).toBeNull();
  });

  it("WhatsApp: the template to the guest's number, in their language", () => {
    expect(waNumber("012-345 6789")).toBe("60123456789");
    expect(waNumber("+65 9123 4567")).toBe("6591234567");
    expect(waNumber("abc")).toBeNull();
    const m = whatsappMessage(event("queue.called", { ticket: { id: "tk", number: "A013", name: "Ben", phone: "012-345 6789", locale: "zh", party_size: 2, status: "called" } }), { BEAUTIFOOD_URL: "x" });
    expect(m).toMatchObject({ to: "60123456789", template: { name: "table_ready", language: { code: "zh_CN" }, components: [{ parameters: [{ text: "Ben" }, { text: "A013" }, { text: "Auntie Lim's" }] }] } });
    expect(whatsappMessage(event("queue.called", { ticket: { id: "tk", number: "A014", name: "Ann", phone: null, locale: null, party_size: 2, status: "called" } }), { BEAUTIFOOD_URL: "x" })).toBeNull();
  });

  it("Xero: an invoice whose total is the bill's, deals and options named", () => {
    const inv = xeroInvoice(paid, { BEAUTIFOOD_URL: "x", XERO_ACCOUNT_CODE: "201" })!;
    const total = inv.LineItems.reduce((s, l) => s + l.Quantity * l.UnitAmount, 0);
    expect(Math.round(total * 100)).toBe(4450);
    expect(inv.LineItems[1].Description).toBe("Teh Tarik · Iced · (Happy hour)");
    expect(inv).toMatchObject({ Type: "ACCREC", Status: "AUTHORISED", Reference: "Beautifood KLCC #1042", Date: "2026-10-19" });
    expect(inv.LineItems.every((l) => l.AccountCode === "201")).toBe(true);
  });

  it("delivery: lines matched to the menu by name in any language, never guessed", () => {
    const menu = [
      { id: "itm_1", name: "Char Kway Teow", active: true, translations: { zh: { name: "炒粿条" } } },
      { id: "itm_2", name: "Teh Tarik", active: true },
      { id: "itm_3", name: "Old dish", active: false },
    ];
    const ok = matchItems({ platform: "grabfood", externalId: "GF-1", branch: "br_1", items: [{ name: "char kway teow", qty: 2 }, { name: "炒粿条", qty: 1, notes: "no chilli" }] }, menu);
    expect(ok.missing).toEqual([]);
    expect(ok.items).toEqual([
      { itemId: "itm_1", qty: 2, notes: "grabfood GF-1" },
      { itemId: "itm_1", qty: 1, notes: "grabfood GF-1 · no chilli" },
    ]);
    expect(matchItems({ platform: "g", externalId: "2", branch: "b", items: [{ name: "Old dish", qty: 1 }, { name: "Pizza", qty: 1 }] }, menu).missing).toEqual(["Old dish", "Pizza"]);
  });

  it("the hook: verifies, runs each enabled connector for its events, and fails loudly so Beautifood retries", async () => {
    const calls: { url: string; body: string }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), body: String(init.body) });
      return new Response("ok", { status: String(url).includes("fail") ? 500 : 200 });
    });
    const body = JSON.stringify(event("menu.sold_out", { item: { id: "i", name: "Cendol", price: 850 } }));
    const req = async (b: string, secret = SECRET) => new Request("https://x/hooks", { method: "POST", body: b, headers: { "x-beautifood-signature": await signature(secret, b, Date.now()), "x-beautifood-delivery": "whd_1" } });
    const env = { BEAUTIFOOD_URL: "x", BEAUTIFOOD_WEBHOOK_SECRET: SECRET, SLACK_WEBHOOK_URL: "https://hooks.slack.test/ok" };
    const r = await handleHook(await req(body), env);
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ event: "menu.sold_out", results: { slack: "done" } });
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0].body).text).toContain("Cendol");
    expect((await handleHook(await req(body, "whsec_wrong"), env)).status).toBe(401);
    expect((await handleHook(await req(body), { ...env, SLACK_WEBHOOK_URL: "https://hooks.slack.test/fail" })).status).toBe(500);
  });
});

describe("storefront template", () => {
  const payload: StorefrontPayload = {
    design: { theme: PRESETS.kopitiam.theme, hero: { tagline: { en: "Penang classics", zh: "槟城经典" }, intro: {}, layout: "split", image: null }, sections: DEFAULT_SECTIONS, gallery: [] },
    published: true,
    restaurant: { name: "Auntie <Lim>'s", slug: "auntie-lim", cuisine: "Malaysian", description: "", story: "Since 1998.", translations: {} },
    branches: [{ id: "br_1", ref: "auntie-lim~klcc", name: "KLCC", address: "Suria KLCC", phone: "03-2382 0118", modules: { bookings: true }, hours: { open: 10, close: 22 } }],
    currency: "MYR",
    menuLanguage: "en",
    menu: { now: { menus: [], deals: [{ id: "pr", name: "Happy hour", until: "18:00" }] }, signatures: [{ id: "i1", name: "Char Kway Teow", description: "wok-fried", price: 1690 }], deals: [{ id: "i2", name: "Teh Tarik", description: "", price: 385, listPrice: 550 }] },
  };

  it("renders the design with escaped text and Beautifood links", () => {
    const html = render(payload, { locale: "zh", base: "https://bf.test" });
    expect(html).toContain("--accent:#1f6b45");
    expect(html).toContain("Auntie &lt;Lim&gt;&#39;s");
    expect(html).not.toContain("Auntie <Lim>");
    expect(html).toContain("槟城经典");
    expect(html).toContain('href="https://bf.test/r/auntie-lim~klcc"');
    expect(html).toContain('href="https://bf.test/r/auntie-lim~klcc/book"');
    expect(html).toContain("<s>");
    expect(html.indexOf('id="queue"')).toBeLessThan(html.indexOf('id="story"'));
    expect(esc('"><script>')).toBe("&quot;&gt;&lt;script&gt;");
  });
});
