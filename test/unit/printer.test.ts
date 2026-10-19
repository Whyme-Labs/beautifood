// Receipt printer: ESC/POS bytes, raster bands, 1-bit packing, and the text-mode fallback
// (column layout per paper width, totals, never raw UTF-8: transliteration or an ASCII alternative).
// The image receipt itself (templates, layout) is covered in receipt.test.ts.
import { describe, it, expect } from "vitest";
import { BAND, COLS, chunks, columns, cut, drawerKick, encodeLines, findBulkOut, imageBytes, init, linesBytes, money, packBitmap, raster, toAscii, txt, wrap } from "../../src/ui/printer";
import { receiptBlocks, receiptLines, type Bill } from "../../src/ui/receipt";
import { DEFAULT_RECEIPT, type ReceiptConfig } from "../../src/shared/receipt";

const hex = (b: ArrayLike<number>) => Array.from(b, (v) => v.toString(16).padStart(2, "0")).join(" ");
/** The printable rows of an encoding: text between commands, split at line feeds. */
const rows = (b: Uint8Array) =>
  String.fromCharCode(...b)
    .replace(/\x1b[@]|\x1b[aEd].|\x1d[!V].|\x1bp.../gs, "")
    .split("\n")
    .filter((r) => r.trim());

const BILL: Bill = {
  restaurant: "Beautifood Demo",
  branch: "Bangsar",
  number: "1042",
  tables: ["T3"],
  closedAt: Date.UTC(2026, 9, 19, 5, 5),
  timezone: "Asia/Kuala_Lumpur",
  currency: "MYR",
  items: [
    { names: { en: "Char Kway Teow", zh: "炒粿条" }, original: "Char Kway Teow", qty: 2, amount: 2580, options: ["Extra prawns"] },
    { names: { en: "Teh Tarik", zh: "拉茶" }, original: "Teh Tarik", qty: 1, amount: 450, options: [] },
  ],
  subtotal: 3030,
  discount: 303,
  serviceCharge: 273,
  tax: 0,
  rounding: 0,
  total: 3000,
  payments: [{ method: "cash", amount: 3000, tendered: 5000, change: 2000 }],
};
const NO_QR: ReceiptConfig = { ...DEFAULT_RECEIPT, show: { ...DEFAULT_RECEIPT.show, receiptQr: false, cashier: false } };
/** The text-mode fallback of a receipt, in a locale. */
const textReceipt = (paper: 58 | 80, locale = "en", bill = BILL) => linesBytes(receiptLines(receiptBlocks(bill, NO_QR, locale)), { paper });

describe("ESC/POS commands", () => {
  it("initialises, cuts and kicks the drawer with the standard bytes", () => {
    expect(hex(init())).toBe("1b 40");
    expect(hex(cut())).toBe("1b 64 04 1d 56 01");
    expect(hex(drawerKick())).toBe("1b 70 00 19 fa");
  });

  it("wraps a receipt in init … feed + partial cut, with the kick up front when asked", () => {
    const img = { width: 8, height: 1, data: new Uint8Array([0x81]) };
    for (const b of [imageBytes(img, { openDrawer: true }), linesBytes([{ left: "Hi" }], { paper: 80, openDrawer: true })]) {
      expect(hex(b.subarray(0, 7))).toBe("1b 40 1b 70 00 19 fa");
      expect(hex(b.subarray(b.length - 6))).toBe("1b 64 04 1d 56 01");
    }
    expect(hex(imageBytes(img).subarray(0, 4))).not.toContain("1b 70");
    // the whole image receipt: init, left align, one band, cut
    expect(hex(imageBytes(img))).toBe("1b 40 1b 61 00 1d 76 30 00 01 00 01 00 81 1b 64 04 1d 56 01");
  });

  it("encodes a raster image as GS v 0 in bands", () => {
    const img = { width: 16, height: 3, data: new Uint8Array([0xff, 0x00, 0x0f, 0xf0, 0xaa, 0x55]) };
    expect(hex(raster(img))).toBe("1d 76 30 00 02 00 03 00 ff 00 0f f0 aa 55");
    // two bands: 2 rows, then 1, each with its own header (xL xH = 2 bytes across, yL yH = rows)
    expect(hex(raster(img, 2))).toBe("1d 76 30 00 02 00 02 00 ff 00 0f f0 1d 76 30 00 02 00 01 00 aa 55");
  });

  it("never sends a band taller than 255 rows", () => {
    const img = { width: 8, height: 600, data: new Uint8Array(600) };
    const heights: number[] = [];
    const b = raster(img, 1000);
    for (let i = 0; i < b.length; i++) if (b[i] === 0x1d && b[i + 1] === 0x76 && b[i + 2] === 0x30) (heights.push(b[i + 6] | (b[i + 7] << 8)), (i += 7 + (b[i + 6] | (b[i + 7] << 8))));
    expect(heights).toEqual([255, 255, 90]);
    expect(BAND).toBeLessThanOrEqual(255);
  });

  it("packs pixels into a bitmap, leftmost dot in the high bit; transparent is paper", () => {
    const px = [0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 0];
    expect(Array.from(packBitmap(px, 3, 1).data)).toEqual([0x80]);
    // 10 dots across round up to 2 bytes; the 9th dot is the high bit of the second byte
    const row = Array.from({ length: 10 }, (_, x) => (x === 0 || x === 8 ? [0, 0, 0, 255] : [255, 255, 255, 255])).flat();
    expect(packBitmap(row, 10, 1)).toEqual({ width: 16, height: 1, data: new Uint8Array([0x80, 0x80]) });
  });

  it("thresholds mid grey as paper, but dithers it inside a logo region", () => {
    const w = 16;
    const h = 16;
    const grey = Array.from({ length: w * h }, () => [140, 140, 140, 255]).flat();
    const ones = (d: Uint8Array) => Array.from(d).reduce((a, v) => a + v.toString(2).replace(/0/g, "").length, 0);
    expect(ones(packBitmap(grey, w, h).data)).toBe(0);
    const dithered = packBitmap(grey, w, h, [{ x: 0, y: 0, w: 8, h: h }]);
    // about 45% ink (140/255 is 55% bright), and only inside the region (the left byte of each row)
    expect(ones(dithered.data) / (8 * h)).toBeGreaterThan(0.35);
    expect(ones(dithered.data) / (8 * h)).toBeLessThan(0.55);
    for (let y = 0; y < h; y++) expect(dithered.data[y * 2 + 1]).toBe(0);
  });
});

describe("layout", () => {
  it("knows the columns of 58 and 80 mm paper", () => {
    expect(COLS).toEqual({ 58: 32, 80: 48 });
  });

  for (const w of [32, 48]) {
    it(`fills two-column rows to exactly ${w} characters`, () => {
      const r = columns("Subtotal", "1,234.50", w);
      expect(r).toHaveLength(1);
      expect(r[0]).toHaveLength(w);
      expect(r[0]).toMatch(/^Subtotal \.+ 1,234\.50$/);
      const long = columns("Nasi Lemak Ayam Rendang with extra sambal and a fried egg", "18.90", w);
      expect(long.length).toBeGreaterThan(1);
      for (const row of long) expect(row.length).toBeLessThanOrEqual(w);
      expect(long.at(-1)!.endsWith(" 18.90")).toBe(true);
      expect(long.at(-1)).toHaveLength(w);
    });
  }

  it("word-wraps and hard-splits words longer than a line", () => {
    expect(wrap("a bb ccc", 4)).toEqual(["a bb", "ccc"]);
    expect(wrap("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
  });

  it("lays every text-mode receipt row within the paper width", () => {
    for (const paper of [58, 80] as const) {
      const out = rows(textReceipt(paper));
      // the restaurant name is double width: half the columns, same paper
      for (const r of out) expect(r.length, r).toBeLessThanOrEqual(COLS[paper]);
      expect(out.find((r) => r.startsWith("Total"))).toHaveLength(COLS[paper]);
    }
  });
});

describe("totals", () => {
  it("formats minor units as ASCII money", () => {
    expect(money(123456, "MYR")).toBe("RM 1,234.56");
    expect(money(-50)).toBe("-0.50");
    expect(money(900, "THB")).toBe("THB 9.00");
  });

  it("prints every total, the discount as negative, and cash tendered with change", () => {
    const out = rows(textReceipt(58));
    const amountOf = (label: string) => out.find((r) => r.trimStart().startsWith(label))?.split(" ").at(-1);
    expect(amountOf("Subtotal")).toBe("30.30");
    expect(amountOf("Discount")).toBe("-3.03");
    expect(amountOf("Service charge")).toBe("2.73");
    expect(out.find((r) => r.startsWith("Total"))!.endsWith("RM 30.00")).toBe(true);
    expect(amountOf("Tendered")).toBe("50.00");
    expect(amountOf("Change")).toBe("20.00");
    // zero lines are left out
    expect(out.some((r) => r.startsWith("Tax") || r.startsWith("Rounding"))).toBe(false);
    expect(out).toContain(columns("Bill #1042", "Table T3", 32)[0]);
    expect(out.some((r) => r.startsWith("2 x Char Kway Teow"))).toBe(true);
    expect(out.at(-1)!.trim()).toBe("Thank you, see you again!");
  });
});

describe("non-ASCII text", () => {
  it("transliterates accents, fullwidth forms and typography", () => {
    expect(toAscii("Café “Teh” – 2×")).toEqual({ text: 'Cafe "Teh" - 2x', printable: true });
    expect(toAscii("ＡＢＣ１２３")).toEqual({ text: "ABC123", printable: true });
  });

  it("marks CJK as not printable and collapses it to a single ?", () => {
    expect(toAscii("炒粿条")).toEqual({ text: "?", printable: false });
    expect(toAscii("（大）")).toEqual({ text: "(?)", printable: false });
  });

  it("never sends bytes above 0x7f, falling back to the ASCII alternative", () => {
    const b = textReceipt(58, "zh", { ...BILL, restaurant: "美食坊" });
    expect(Array.from(b).every((v) => v < 0x80)).toBe(true);
    const out = rows(b);
    // dish names and labels in Chinese print from their English alternatives
    expect(out.some((r) => r.includes("2 x Char Kway Teow"))).toBe(true);
    expect(out.some((r) => r.startsWith("Total"))).toBe(true);
    expect(out.some((r) => r.trim() === "?")).toBe(true);
  });

  it("keeps text mode to plain lines: no image commands", () => {
    const b = encodeLines([{ left: txt("炒粿条", "Char Kway Teow"), right: "25.80" }, { left: "Teh Tarik", right: "4.50" }], { paper: 58 });
    expect(hex(b)).not.toContain("1d 76 30");
    expect(String.fromCharCode(...b)).toContain("Char Kway Teow");
    expect(String.fromCharCode(...b)).toContain("Teh Tarik");
  });
});

describe("transport helpers", () => {
  it("splits writes into chunks", () => {
    expect(chunks(new Uint8Array(10), 4).map((c) => c.length)).toEqual([4, 4, 2]);
  });

  it("finds the bulk OUT endpoint, preferring the printer class", () => {
    const ifaces = [
      { interfaceNumber: 0, alternates: [{ alternateSetting: 0, interfaceClass: 255, endpoints: [{ endpointNumber: 1, direction: "out" as const, type: "bulk" }] }] },
      {
        interfaceNumber: 1,
        alternates: [{ alternateSetting: 0, interfaceClass: 7, endpoints: [{ endpointNumber: 2, direction: "in" as const, type: "bulk" }, { endpointNumber: 3, direction: "out" as const, type: "bulk" }] }],
      },
    ];
    expect(findBulkOut(ifaces)).toEqual({ iface: 1, alt: 0, ep: 3 });
    expect(findBulkOut([ifaces[0]])).toEqual({ iface: 0, alt: 0, ep: 1 });
    expect(findBulkOut([])).toBeNull();
  });
});
