// Receipt printer: ESC/POS bytes, column layout per paper width, totals, and
// non-ASCII text (never raw UTF-8: ASCII alternative, transliteration or a raster image).
import { describe, it, expect } from "vitest";
import {
  COLS,
  chunks,
  columns,
  cut,
  drawerKick,
  encodeLines,
  findBulkOut,
  init,
  money,
  packBitmap,
  raster,
  receiptBytes,
  toAscii,
  txt,
  wrap,
  type ReceiptData,
} from "../../src/ui/printer";

const hex = (b: ArrayLike<number>) => Array.from(b, (v) => v.toString(16).padStart(2, "0")).join(" ");
/** The printable rows of an encoding: text between commands, split at line feeds. */
const rows = (b: Uint8Array) =>
  String.fromCharCode(...b)
    .replace(/\x1b[@]|\x1b[aEd].|\x1d[!V].|\x1bp.../gs, "")
    .split("\n")
    .filter((r) => r.trim());

const RECEIPT: ReceiptData = {
  restaurant: "Beautifood Demo",
  branch: "Bangsar",
  number: "1042",
  table: "Table T3",
  when: "19 Oct 2026, 1:05 pm",
  currency: "MYR",
  items: [
    { name: txt("炒粿条", "Char Kway Teow"), qty: 2, amount: 2580, options: "Extra prawns" },
    { name: "Teh Tarik", qty: 1, amount: 450 },
  ],
  subtotal: 3030,
  discount: 303,
  serviceCharge: 273,
  tax: 0,
  rounding: 0,
  total: 3000,
  payments: [{ label: "Cash", amount: 3000, tendered: 5000, change: 2000 }],
  labels: {
    bill: "Bill",
    subtotal: "Subtotal",
    discount: "Discount",
    serviceCharge: "Service charge",
    tax: "Tax",
    rounding: "Rounding",
    total: "Total",
    tendered: "Tendered",
    change: "Change",
    thanks: "Thank you, see you again!",
  },
};

describe("ESC/POS commands", () => {
  it("initialises, cuts and kicks the drawer with the standard bytes", () => {
    expect(hex(init())).toBe("1b 40");
    expect(hex(cut())).toBe("1b 64 04 1d 56 01");
    expect(hex(drawerKick())).toBe("1b 70 00 19 fa");
  });

  it("wraps a receipt in init … feed + partial cut, with the kick up front when asked", () => {
    const b = receiptBytes(RECEIPT, { paper: 80, openDrawer: true });
    expect(hex(b.subarray(0, 7))).toBe("1b 40 1b 70 00 19 fa");
    expect(hex(b.subarray(b.length - 6))).toBe("1b 64 04 1d 56 01");
    expect(hex(receiptBytes(RECEIPT, { paper: 80 }).subarray(0, 4))).not.toContain("1b 70");
  });

  it("encodes a raster image as GS v 0 in bands", () => {
    const img = { width: 16, height: 3, data: new Uint8Array([0xff, 0x00, 0x0f, 0xf0, 0xaa, 0x55]) };
    expect(hex(raster(img))).toBe("1d 76 30 00 02 00 03 00 ff 00 0f f0 aa 55");
    expect(raster(img, 2).filter((v, i, a) => v === 0x1d && a[i + 1] === 0x76)).toHaveLength(2);
  });

  it("thresholds canvas pixels into a bitmap, leftmost dot in the high bit", () => {
    const px = [0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 0];
    expect(Array.from(packBitmap(px, 3, 1).data)).toEqual([0x80]);
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

  it("lays every receipt row within the paper width", () => {
    for (const paper of [58, 80] as const) {
      const out = rows(receiptBytes(RECEIPT, { paper }));
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
    const out = rows(receiptBytes(RECEIPT, { paper: 58 }));
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
    const zh: ReceiptData = { ...RECEIPT, restaurant: txt("美食坊", "Beautifood"), labels: { ...RECEIPT.labels, total: txt("合计", "Total") } };
    const b = receiptBytes(zh, { paper: 58 });
    expect(Array.from(b).every((v) => v < 0x80)).toBe(true);
    const out = rows(b);
    expect(out.some((r) => r.includes("2 x Char Kway Teow"))).toBe(true);
    expect(out.some((r) => r.includes("Beautifood"))).toBe(true);
    expect(out.some((r) => r.startsWith("Total"))).toBe(true);
  });

  it("draws lines it can't print as text with the rasterizer", () => {
    const seen: string[] = [];
    const b = encodeLines([{ left: txt("炒粿条", "Char Kway Teow"), right: "25.80" }, { left: "Teh Tarik", right: "4.50" }], {
      paper: 58,
      raster: (line, dots) => (seen.push(`${line.left}|${line.right}|${dots}`), { width: dots, height: 1, data: new Uint8Array(dots / 8) }),
    });
    expect(seen).toEqual(["炒粿条|25.80|384"]);
    expect(hex(b)).toContain("1d 76 30 00 30 00 01 00");
    expect(String.fromCharCode(...b)).toContain("Teh Tarik");
    expect(String.fromCharCode(...b)).not.toContain("Char Kway Teow");
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
