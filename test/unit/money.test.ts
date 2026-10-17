import { describe, it, expect } from "vitest";
import { computeTotals, splitEqually, formatMoney } from "../../src/shared/money";

describe("money", () => {
  it("computes subtotal, service, tax and cash rounding", () => {
    const t = computeTotals({
      lines: [
        { unitPrice: 1290, modifiers: [], qty: 2 },
        { unitPrice: 450, modifiers: [{ group: "Size", option: "Large", price: 100 }], qty: 1 },
      ],
      discount: null,
      serviceChargePct: 10,
      taxPct: 6,
      taxInclusive: false,
      cashRounding: 5,
    });
    expect(t.subtotal).toBe(3130);
    expect(t.serviceCharge).toBe(313);
    expect(t.tax).toBe(207); // 6% of 3443 = 206.58
    expect(t.total % 5).toBe(0);
    expect(t.total).toBe(3650); // 3650 = round(3650/5)*5
    expect(t.rounding).toBe(t.total - (3130 + 313 + 207));
  });

  it("applies percent and amount discounts before service charge", () => {
    const pct = computeTotals({ lines: [{ unitPrice: 10000, modifiers: [], qty: 1 }], discount: { kind: "percent", value: 10 }, serviceChargePct: 10, taxPct: 0, taxInclusive: false, cashRounding: 1 });
    expect(pct.discount).toBe(1000);
    expect(pct.serviceCharge).toBe(900);
    expect(pct.total).toBe(9900);
    const amt = computeTotals({ lines: [{ unitPrice: 500, modifiers: [], qty: 1 }], discount: { kind: "amount", value: 99999 }, serviceChargePct: 0, taxPct: 0, taxInclusive: false, cashRounding: 1 });
    expect(amt.discount).toBe(500); // capped at subtotal
    expect(amt.total).toBe(0);
  });

  it("handles inclusive tax without inflating total", () => {
    const t = computeTotals({ lines: [{ unitPrice: 1060, modifiers: [], qty: 1 }], discount: null, serviceChargePct: 0, taxPct: 6, taxInclusive: true, cashRounding: 1 });
    expect(t.total).toBe(1060);
    expect(t.tax).toBe(60);
  });

  it("splits equally with exact sum", () => {
    expect(splitEqually(1000, 3)).toEqual([334, 333, 333]);
    expect(splitEqually(1000, 3).reduce((a, b) => a + b)).toBe(1000);
    expect(() => splitEqually(10, 0)).toThrow();
  });

  it("formats", () => {
    expect(formatMoney(1290)).toBe("RM12.90");
    expect(formatMoney(-50, "USD")).toBe("-$0.50");
  });
});
