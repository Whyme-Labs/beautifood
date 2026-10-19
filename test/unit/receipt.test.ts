// Image receipts: the blocks each template prints, the layout at 58 and 80 mm (inside the
// paper, wrapped, amounts flush right), the merchant's design (validation, defaults, merging,
// the logo cap) and the text-mode fallback of the same blocks.
import { describe, it, expect } from "vitest";
import { DEFAULT_RECEIPT, LOGO_MAX_BYTES, ReceiptConfigSchema, TEMPLATES, TEMPLATE_IDS, receiptLocale, resolveReceipt, type ReceiptConfig, type TemplateId } from "../../src/shared/receipt";
import { layoutReceipt, logoSize, qrModules, qrRects, receiptBlocks, receiptLines, sampleBill, wrapPx, type Bill, type Block, type DrawOp, type Layout, type Measure } from "../../src/ui/receipt";
import { DOTS, textOf } from "../../src/ui/printer";
import type { Menu } from "../../src/shared/types";

/** A stand-in for canvas text metrics: CJK is square, Latin a little over half the size, bold 5% wider. */
const measure: Measure = (s, size, bold) => Math.ceil([...s].reduce((a, ch) => a + (ch.codePointAt(0)! >= 0x2e80 ? size : size * 0.55), 0) * (bold ? 1.05 : 1));

const BILL: Bill = {
  restaurant: "Beautifood Kopitiam",
  branch: "Bangsar",
  address: "12 Jalan Telawi 3, Bangsar Baru\n59100 Kuala Lumpur",
  number: "1042",
  tables: ["T3"],
  cashier: "Aisyah",
  closedAt: Date.UTC(2026, 9, 19, 5, 5),
  timezone: "Asia/Kuala_Lumpur",
  currency: "MYR",
  items: [
    { names: { en: "Char Kway Teow", zh: "炒粿条" }, original: "Char Kway Teow", qty: 2, amount: 2580, options: ["Extra prawns"], notes: "Less spicy" },
    { names: { en: "Nasi Lemak Ayam Rendang with extra sambal and a fried egg", zh: "仁当鸡椰浆饭加参巴和煎蛋" }, original: "Nasi Lemak Ayam Rendang with extra sambal and a fried egg", qty: 12, amount: 22680, options: [] },
    { names: { en: "Teh Tarik", zh: "拉茶" }, original: "Teh Tarik", qty: 1, amount: 450, options: [] },
  ],
  subtotal: 25710,
  discount: 2571,
  discountReason: "Staff meal",
  serviceCharge: 2314,
  tax: 1527,
  rounding: -0,
  total: 26980,
  payments: [{ method: "cash", amount: 26980, tendered: 30000, change: 3020 }],
  receiptUrl: "https://beautifood.example/receipt/abc123",
  joinUrl: "https://beautifood.example/me?tenant=demo",
};

const design = (template: TemplateId, p: Partial<ReceiptConfig> = {}): ReceiptConfig => ({ ...DEFAULT_RECEIPT, template, ...p, show: { ...DEFAULT_RECEIPT.show, ...p.show } });
const lay = (config: ReceiptConfig, paper: 58 | 80, locale = "en", bill = BILL): Layout =>
  layoutReceipt(receiptBlocks(bill, config, locale), { dots: DOTS[paper], style: TEMPLATES[config.template].style, textSize: config.textSize, measure, logo: config.logo });
const texts = (l: Layout) => l.ops.filter((o): o is Extract<DrawOp, { op: "text" }> => o.op === "text");
const find = (l: Layout, text: string) => texts(l).find((o) => o.text === text);
const MONEY = /^-?(RM )?[\d,]+\.\d\d$/;

describe("layout of every template", () => {
  for (const id of TEMPLATE_IDS)
    for (const paper of [58, 80] as const) {
      it(`${id} at ${paper} mm keeps every op on the paper and every amount flush right`, () => {
        const W = DOTS[paper];
        const l = lay(design(id, { show: { joinQr: true } as ReceiptConfig["show"] }), paper);
        expect(l.width).toBe(W);
        for (const o of l.ops) {
          if (o.op === "text") {
            const [x0, x1] = o.align === "left" ? [o.x, o.x + o.width] : o.align === "right" ? [o.x - o.width, o.x] : [o.x - o.width / 2, o.x + o.width / 2];
            expect(x0, o.text).toBeGreaterThanOrEqual(0);
            expect(x1, o.text).toBeLessThanOrEqual(W);
            expect(o.y).toBeLessThan(l.height);
          } else {
            expect(o.x).toBeGreaterThanOrEqual(0);
            expect(o.x + o.w).toBeLessThanOrEqual(W);
            expect(o.y + o.h).toBeLessThanOrEqual(l.height);
          }
        }
        const amounts = texts(l).filter((o) => MONEY.test(o.text));
        expect(amounts.length).toBeGreaterThan(0);
        for (const a of amounts) expect([a.align, a.x], a.text).toEqual(["right", W]);
        // the grand total, with the currency, on the same line as its label
        const total = find(l, "RM 269.80")!;
        expect(total.bold).toBe(true);
        expect(texts(l).find((o) => o.text.endsWith("Total"))!.y).toBe(total.y);
        // ops run top to bottom (QR codes side by side share a row)
        const ys = texts(l).map((o) => o.y);
        expect(ys.slice(0, 10)).toEqual([...ys.slice(0, 10)].sort((a, b) => a - b));
      });

      it(`${id} at ${paper} mm wraps a long dish name in its column, the amount on the first line`, () => {
        const W = DOTS[paper];
        const l = lay(design(id), paper);
        const qty = find(l, "12×")!;
        const amount = find(l, "226.80")!;
        expect(amount.y).toBe(qty.y);
        const next = find(l, "1×")!;
        const name = texts(l).filter((o) => o.align === "left" && o.y >= qty.y && o.y < next.y && o.x > 0 && o.size === qty.size);
        expect(name.length).toBeGreaterThan(1);
        expect(name.map((o) => o.text).join(" ")).toBe("Nasi Lemak Ayam Rendang with extra sambal and a fried egg");
        for (const o of name) expect(o.x).toBe(name[0].x);
        // beside the amount on the first line, the full width under it
        expect(name[0].x + name[0].width).toBeLessThanOrEqual(amount.x - amount.width);
        for (const o of name) expect(o.x + o.width).toBeLessThanOrEqual(W);
        // every dish starts in the same column, past the widest quantity
        expect(find(l, "Char Kway Teow")!.x).toBe(name[0].x);
        expect(name[0].x).toBeGreaterThanOrEqual(qty.width);
      });
    }

  it("prints Compact smaller and shorter than Classic", () => {
    for (const paper of [58, 80] as const) {
      const classic = lay(design("classic"), paper);
      const compact = lay(design("compact"), paper);
      expect(compact.height).toBeLessThan(classic.height * 0.85);
      expect(find(compact, "Char Kway Teow")!.size).toBeLessThan(find(classic, "Char Kway Teow")!.size);
    }
  });

  it("scales the type with the merchant's text size", () => {
    const size = (textSize: ReceiptConfig["textSize"]) => find(lay(design("classic", { textSize }), 80), "Teh Tarik")!.size;
    expect([size("s"), size("m"), size("l")]).toEqual([20, 24, 28]);
  });

  it("centres the Classic header and draws a dashed rule; Minimal draws solid rules", () => {
    const l = lay(design("classic"), 80);
    expect(find(l, "Beautifood Kopitiam")).toMatchObject({ align: "center", x: 288, bold: true });
    const rule = (x: Layout) => x.ops.filter((o) => o.op === "rect" && o.h === 2);
    expect(rule(l).some((o) => o.op === "rect" && o.w < 10)).toBe(true);
    expect(rule(lay(design("minimal"), 80)).every((o) => o.op === "rect" && o.w === 576)).toBe(true);
  });

  it("fits a logo to the paper and the template's tallest logo, centred, and dithers only it", () => {
    const logo = { src: "data:image/png;base64,AAAA", width: 576, height: 288 };
    const l58 = lay(design("classic", { logo }), 58);
    const img = l58.ops.find((o) => o.op === "image")!;
    expect(img).toEqual({ op: "image", x: 32, y: 4, w: 320, h: 160 });
    expect(lay(design("compact", { logo }), 80).ops.find((o) => o.op === "image")).toMatchObject({ w: 160, h: 80 });
    expect(logoSize({ width: 200, height: 50 }, 576, 160)).toEqual({ w: 200, h: 50 });
    expect(logoSize({ width: 576, height: 100 }, 384, 160)).toEqual({ w: 384, h: 67 });
  });

  it("draws QR codes inside the paper, side by side when there are two", () => {
    const one = lay(design("classic"), 58).ops.filter((o) => o.op === "rect" && o.h > 2);
    const two = lay(design("classic", { show: { joinQr: true } as ReceiptConfig["show"] }), 58).ops.filter((o) => o.op === "rect" && o.h > 2);
    expect(one.length).toBeGreaterThan(50);
    const xs = (r: DrawOp[]) => r.map((o) => (o.op === "rect" ? o.x : 0));
    expect(Math.min(...xs(two))).toBeLessThan(192);
    expect(Math.max(...xs(two))).toBeGreaterThan(192);
    const m = qrModules("https://beautifood.example/receipt/abc123");
    const rects = qrRects(m, 10, 20, 4);
    for (const r of rects) expect(r.x >= 10 && r.y >= 20 && r.x + r.w <= 10 + m.size * 4 && r.y + r.h <= 20 + m.size * 4).toBe(true);
  });

  it("wraps CJK between characters and Latin at spaces", () => {
    const m = (s: string) => measure(s, 10, false);
    expect(wrapPx("仁当鸡椰浆饭加参巴", 40, m)).toEqual(["仁当鸡椰", "浆饭加参", "巴"]);
    expect(wrapPx("aaa bbb ccc", 40, m)).toEqual(["aaa bbb", "ccc"]);
  });
});

describe("what each template prints", () => {
  const all = (blocks: Block[]) => blocks.flatMap((b) => (b.k === "text" ? [textOf(b.text)] : b.k === "row" ? [textOf(b.left), ...(b.right ? [textOf(b.right)] : []), ...(b.subs ?? []).map(textOf)] : b.k === "qr" ? b.codes.map((c) => textOf(c.caption)) : []));

  it("Classic: header, meta, every dish detail, totals, payments, thank-you and the e-receipt QR", () => {
    const blocks = receiptBlocks(BILL, design("classic", { phone: "03-2201 8888", taxId: "W10-1808-32000123" }), "en");
    const t = all(blocks);
    for (const s of ["Beautifood Kopitiam", "Bangsar", "59100 Kuala Lumpur", "Tel 03-2201 8888", "SST / tax reg. no. W10-1808-32000123", "Bill #1042", "Table T3", "Cashier: Aisyah", "Extra prawns", "“Less spicy”", "Subtotal", "Discount (Staff meal)", "-25.71", "Service charge", "Tax", "Total", "Cash", "Tendered", "Change", "Thank you, see you again!", "Scan for your e-receipt"])
      expect(t, s).toContain(s);
    expect(blocks.find((b) => b.k === "qr")).toEqual({ k: "qr", codes: [{ url: BILL.receiptUrl, caption: "Scan for your e-receipt" }] });
  });

  it("Minimal: the name (no logo), dishes, the total and the thank-you only", () => {
    const t = all(receiptBlocks(BILL, design("minimal", { show: { receiptQr: false } as ReceiptConfig["show"] }), "en"));
    expect(t).toEqual(["Beautifood Kopitiam", "Char Kway Teow", "25.80", "Extra prawns", "“Less spicy”", "Nasi Lemak Ayam Rendang with extra sambal and a fried egg", "226.80", "Teh Tarik", "4.50", "Total", "RM 269.80", "Thank you, see you again!"]);
    const withLogo = receiptBlocks(BILL, design("minimal", { logo: { src: "data:image/png;base64,AAAA", width: 10, height: 10 } }), "en");
    expect(withLogo[0]).toEqual({ k: "logo" });
    expect(all(withLogo)).not.toContain("Beautifood Kopitiam");
  });

  it("Bilingual: labels in 中文 + English, each dish with its other name underneath", () => {
    const en = receiptBlocks(BILL, design("bilingual"), "en");
    const t = all(en);
    for (const s of ["小计 Subtotal", "合计 Total", "现金 Cash", "找零 Change", "谢谢光临，欢迎再来！", "Thank you, see you again!"]) expect(t, s).toContain(s);
    const ckt = en.find((b) => b.k === "row" && textOf(b.left) === "Char Kway Teow");
    expect(ckt && ckt.k === "row" && ckt.subs?.map(textOf)).toEqual(["炒粿条", "Extra prawns", "“Less spicy”"]);
    // in Chinese, the dish in Chinese with the menu's original underneath
    const zh = receiptBlocks(BILL, design("bilingual"), "zh").find((b) => b.k === "row" && textOf(b.left) === "炒粿条");
    expect(zh && zh.k === "row" && zh.subs?.map(textOf)[0]).toBe("Char Kway Teow");
  });

  it("the bilingual language setting makes any template bilingual", () => {
    expect(all(receiptBlocks(BILL, design("classic", { language: "bilingual" }), "en"))).toContain("小计 Subtotal");
    expect(all(receiptBlocks(BILL, design("classic"), "zh"))).toContain("小计");
  });

  it("leaves out what the merchant turned off, without doubled dividers", () => {
    const off = { number: false, table: false, dateTime: false, cashier: false, itemOptions: false, payments: false, receiptQr: false, joinQr: false };
    const blocks = receiptBlocks(BILL, design("classic", { show: off }), "en");
    const t = all(blocks);
    for (const s of ["Bill #1042", "Table T3", "Cashier: Aisyah", "Extra prawns", "Cash", "Tendered", "Scan for your e-receipt"]) expect(t, s).not.toContain(s);
    blocks.forEach((b, i) => {
      if (b.k === "rule") expect(blocks[i + 1]?.k).not.toBe("rule");
    });
    expect(blocks[0].k).not.toBe("rule");
    expect(blocks.at(-1)!.k).not.toBe("rule");
    // one of number / table left: on its own
    const only = receiptBlocks(BILL, design("classic", { show: { ...off, table: true } }), "en").find((b) => b.k === "row" && textOf(b.left) === "Table T3");
    expect(only).toMatchObject({ right: undefined });
  });

  it("uses the business name, address and footer the merchant wrote", () => {
    const t = all(receiptBlocks(BILL, design("classic", { businessName: "BF Kopitiam Sdn Bhd", address: "Lot 5, Jalan Maarof", footer: "Wi-Fi: kopitiam123\n\nFollow us @beautifood" }), "en"));
    expect(t).toContain("BF Kopitiam Sdn Bhd");
    expect(t).not.toContain("Beautifood Kopitiam");
    expect(t).toContain("Lot 5, Jalan Maarof");
    expect(t).not.toContain("59100 Kuala Lumpur");
    expect(t).toContain("Wi-Fi: kopitiam123");
    expect(t).toContain("Follow us @beautifood");
    expect(t).not.toContain("Thank you, see you again!");
  });

  it("falls back to text mode from the same blocks: QR codes as caption and link, no logo", () => {
    const lines = receiptLines(receiptBlocks(BILL, design("minimal", { logo: { src: "data:image/png;base64,AAAA", width: 10, height: 10 } }), "en"));
    const left = lines.map((l) => (l === "rule" ? "-" : textOf(l.left)));
    expect(left).toContain("2 x Char Kway Teow");
    expect(left).toContain(BILL.receiptUrl);
    expect(left).toContain("Scan for your e-receipt");
  });
});

describe("the merchant's receipt design", () => {
  it("validates the defaults and every built-in template", () => {
    expect(ReceiptConfigSchema.parse(DEFAULT_RECEIPT)).toEqual(DEFAULT_RECEIPT);
    for (const id of TEMPLATE_IDS) expect(ReceiptConfigSchema.safeParse(design(id)).success).toBe(true);
    expect(TEMPLATE_IDS).toEqual(["classic", "compact", "bilingual", "minimal"]);
  });

  it("prints a good receipt with no setup: Classic, cashier's language, details on, e-receipt QR", () => {
    expect(resolveReceipt()).toEqual(DEFAULT_RECEIPT);
    expect(DEFAULT_RECEIPT).toMatchObject({ template: "classic", language: "cashier", textSize: "m", logo: null });
    expect(DEFAULT_RECEIPT.show).toEqual({ number: true, table: true, dateTime: true, cashier: true, itemOptions: true, payments: true, receiptQr: true, joinQr: false });
  });

  it("rejects unknown templates, fields and over-long text", () => {
    expect(ReceiptConfigSchema.safeParse({ ...DEFAULT_RECEIPT, template: "fancy" }).success).toBe(false);
    expect(ReceiptConfigSchema.safeParse({ ...DEFAULT_RECEIPT, colour: "red" }).success).toBe(false);
    expect(ReceiptConfigSchema.safeParse({ ...DEFAULT_RECEIPT, show: { ...DEFAULT_RECEIPT.show, wifi: true } }).success).toBe(false);
    expect(ReceiptConfigSchema.safeParse({ ...DEFAULT_RECEIPT, businessName: "x".repeat(81) }).success).toBe(false);
    expect(ReceiptConfigSchema.safeParse({ ...DEFAULT_RECEIPT, footer: "a\nb\nc\nd\ne\nf\ng" }).success).toBe(false);
    expect(ReceiptConfigSchema.safeParse({ ...DEFAULT_RECEIPT, language: "fr" }).success).toBe(false);
    expect(ReceiptConfigSchema.parse({ ...DEFAULT_RECEIPT, phone: "  03-2201 8888 " }).phone).toBe("03-2201 8888");
  });

  it("caps the logo at 64 KB, as a PNG, JPEG or WebP data URL of a sane size", () => {
    expect(LOGO_MAX_BYTES).toBe(65536);
    const head = "data:image/png;base64,";
    const logo = (src: string, width = 576, height = 200) => ReceiptConfigSchema.safeParse({ ...DEFAULT_RECEIPT, logo: { src, width, height } }).success;
    expect(logo(head + "A".repeat(LOGO_MAX_BYTES - head.length))).toBe(true);
    expect(logo(head + "A".repeat(LOGO_MAX_BYTES - head.length + 1))).toBe(false);
    expect(logo("data:image/svg+xml;base64,AAAA")).toBe(false);
    expect(logo("https://example.com/logo.png")).toBe(false);
    expect(logo(head + "AAAA", 577)).toBe(false);
    expect(logo(head + "AAAA", 576, 321)).toBe(false);
  });

  it("merges the branch's override over the restaurant's, field by field", () => {
    const r = resolveReceipt({ template: "minimal", footer: "Selamat datang" }, { template: "compact", show: { joinQr: true } as ReceiptConfig["show"] });
    expect(r.template).toBe("compact");
    expect(r.footer).toBe("Selamat datang");
    expect(r.show).toEqual({ ...DEFAULT_RECEIPT.show, joinQr: true });
  });

  it("keeps a stored design printable when part of it is no longer valid", () => {
    const stored = { template: "retro", footer: "Terima kasih", textSize: "xl", show: { table: false, wifi: true } } as unknown as Partial<ReceiptConfig>;
    const r = resolveReceipt(stored);
    expect(r.template).toBe("classic");
    expect(r.textSize).toBe("m");
    expect(r.footer).toBe("Terima kasih");
    expect(r.show).toEqual({ ...DEFAULT_RECEIPT.show, table: false });
  });

  it("prints in the cashier's language, the guest's when known, English, or bilingual", () => {
    expect(receiptLocale("cashier", "zh", "en")).toBe("zh");
    expect(receiptLocale("guest", "en", "zh")).toBe("zh");
    expect(receiptLocale("guest", "zh", null)).toBe("zh");
    expect(receiptLocale("en", "zh", "zh")).toBe("en");
    expect(receiptLocale("bilingual", "zh")).toBe("zh");
  });
});

describe("sample bill", () => {
  it("adds up, and uses the restaurant's own dishes when it has some", () => {
    const b = sampleBill({ restaurant: "Demo", currency: "MYR", origin: "https://x.test", tenantSlug: "demo" });
    expect(b.subtotal).toBe(b.items.reduce((a, i) => a + i.amount, 0));
    expect(b.total).toBe(b.subtotal + b.serviceCharge + b.tax + b.rounding);
    expect(b.total % 5).toBe(0);
    expect(b.payments[0].tendered! - b.payments[0].change).toBe(b.total);
    expect(b.joinUrl).toBe("https://x.test/me?tenant=demo");
    const menu = {
      language: "en",
      categories: [],
      items: [{ id: "i1", categoryId: "c", name: "Laksa", description: "", price: 1500, active: true, modifiers: [{ name: "Size", min: 1, max: 1, options: [{ name: "Large", price: 200 }] }], translations: { zh: { name: "叻沙" } } }],
    } as unknown as Menu;
    const own = sampleBill({ restaurant: "Demo", currency: "MYR", origin: "", menu });
    expect(own.items).toEqual([{ names: { en: "Laksa", zh: "叻沙" }, original: "Laksa", qty: 2, amount: 3400, options: ["Large"], notes: "Less spicy" }]);
  });
});
