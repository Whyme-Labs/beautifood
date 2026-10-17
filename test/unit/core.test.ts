// Contract tests for the TS ↔ Rust/WASM boundary (the Rust crate has its own unit tests).
import { describe, it, expect } from "vitest";
import { core } from "../../src/core/node";
import { CoreError } from "../../src/core/api";

const c = core();
const NOW = Date.UTC(2026, 9, 17, 4, 0);
const min = (m: number) => m * 60_000;

describe("WASM core boundary", () => {
  it("prices a bill with camelCase I/O", () => {
    const t = c.computeTotals({
      lines: [{ unitPrice: 1290, qty: 2 }, { unitPrice: 450, qty: 1, modifiers: [{ group: "Size", option: "Large", price: 100 }] }],
      serviceChargePct: 10,
      taxPct: 6,
      cashRounding: 5,
    });
    expect(t).toEqual({ subtotal: 3130, discount: 0, serviceCharge: 313, tax: 207, rounding: 0, total: 3650 });
  });

  it("splits and reports errors as CoreError", () => {
    expect(c.splitEqually(1000, 3)).toEqual([334, 333, 333]);
    expect(() => c.splitEqually(10, 0)).toThrow(CoreError);
    expect(() => c.computeTotals({} as never)).toThrow(/invalid input/);
  });

  it("suggests a merged seating with reasons and snake_case actions", () => {
    const s = c.suggest({
      tables: [
        { id: "t1", label: "P1", seatsMin: 2, seatsMax: 4, mergeGroup: "patio", status: "free" },
        { id: "t2", label: "P2", seatsMin: 2, seatsMax: 4, mergeGroup: "patio", status: "free" },
      ],
      tickets: [{ id: "k1", number: "C001", category: "L", partySize: 7, createdAt: NOW - min(12) }],
      strategy: "smart",
      now: NOW,
    });
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ ticketId: "k1", ticketNumber: "C001", action: "merge_seat", tableLabels: ["P1", "P2"] });
    expect(s[0].reasons.join(" ")).toContain("waiting 12 min");
  });

  it("estimates waits and learns turn times", () => {
    const etas = c.estimateWaits(
      {
        tables: [{ id: "t1", label: "T1", seatsMin: 1, seatsMax: 2, status: "seated" }],
        tickets: [{ id: "a", number: "A001", category: "S", partySize: 2, createdAt: NOW }],
        strategy: "smart",
        now: NOW,
        turn: { 2: 45 },
      },
      [{ tableIds: ["t1"], freeAt: NOW + min(30) }],
    );
    expect(etas).toEqual({ a: 30 });
    let model = {};
    for (let i = 0; i < 20; i++) model = c.observeTurn(model, 2, 12, false, 30);
    expect(c.predictTurn(model, 2, 12, false)).toBeLessThan(35);
    expect(c.predictTurn({}, 2, 12, false)).toBe(47);
  });
});
