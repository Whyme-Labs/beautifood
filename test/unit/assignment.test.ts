import { describe, it, expect } from "vitest";
import { suggest, candidatesFor, estimateWaits, type AsgTable, type AsgTicket, type EngineInput } from "../../src/shared/assignment";
import { DEFAULT_BRANCH_CONFIG } from "../../src/shared/types";

const NOW = Date.UTC(2026, 9, 17, 4, 0); // 12:00 KL
const min = (m: number) => m * 60_000;

function table(id: string, seats: number, extra: Partial<AsgTable> = {}): AsgTable {
  return { id, label: id, seatsMin: seats <= 2 ? 1 : seats - 2, seatsMax: seats, mergeGroup: null, splitConfig: null, parentId: null, status: "free", ...extra };
}
function ticket(id: string, size: number, waitedMin: number, extra: Partial<AsgTicket> = {}): AsgTicket {
  const cat = size <= 2 ? "S" : size <= 4 ? "M" : "L";
  return { id, number: id, category: cat, partySize: size, createdAt: NOW - min(waitedMin), skips: 0, priority: 0, ...extra };
}
function input(tables: AsgTable[], tickets: AsgTicket[], strategy: EngineInput["config"]["strategy"] = "smart", extra: Partial<EngineInput> = {}): EngineInput {
  return { tables, tickets, bookings: [], config: { strategy, weights: DEFAULT_BRANCH_CONFIG.weights, maxSkips: 3 }, now: NOW, predictTurn: (p) => 40 + 5 * p, ...extra };
}

describe("candidate generation", () => {
  it("finds single, merged and split candidates", () => {
    const tables = [
      table("T1", 4, { mergeGroup: "g" }),
      table("T2", 4, { mergeGroup: "g" }),
      table("T3", 4, { mergeGroup: "g" }),
      table("R1", 10, { seatsMin: 6, splitConfig: [{ suffix: "a", seats: 6 }, { suffix: "b", seats: 4 }] }),
    ];
    const big = candidatesFor(8, tables);
    expect(big.some((c) => c.action === "seat" && c.tableIds[0] === "R1")).toBe(true);
    const merges = big.filter((c) => c.action === "merge_seat");
    expect(merges.length).toBe(3); // T1+T2, T1+T3, T2+T3 (minimal pairs only, no triple)
    expect(merges.every((c) => c.tableIds.length === 2)).toBe(true);
    const small = candidatesFor(3, tables);
    expect(small.some((c) => c.action === "split_seat" && c.labels[0] === "R1b")).toBe(true);
  });

  it("party bigger than everything has no candidates", () => {
    expect(candidatesFor(30, [table("T1", 4), table("T2", 4)])).toEqual([]);
  });
});

describe("strategies", () => {
  it("fifo never lets anyone overtake the head of the line", () => {
    const s = suggest(input([table("T1", 2)], [ticket("A1", 6, 30), ticket("A2", 2, 5)], "fifo"));
    expect(s).toEqual([]);
  });

  it("category_fifo serves each size class in order independently", () => {
    const s = suggest(input([table("T1", 2), table("T2", 4)], [ticket("C1", 6, 30), ticket("A1", 2, 10), ticket("A2", 2, 20), ticket("B1", 4, 1)], "category_fifo"));
    const byTicket = Object.fromEntries(s.map((x) => [x.ticketId, x.tableIds]));
    expect(byTicket.A2).toEqual(["T1"]); // A2 has waited longest among smalls
    expect(byTicket.B1).toEqual(["T2"]);
    expect(byTicket.C1).toBeUndefined();
  });

  it("best_fit minimises empty seats", () => {
    const s = suggest(input([table("T6", 6, { seatsMin: 1 }), table("T2", 2)], [ticket("A1", 2, 20), ticket("C1", 6, 5)], "best_fit"));
    const byTicket = Object.fromEntries(s.map((x) => [x.ticketId, x.tableIds[0]]));
    expect(byTicket).toEqual({ A1: "T2", C1: "T6" });
  });

  it("smart merges tables for a big party and explains why", () => {
    const tables = [table("T1", 4, { mergeGroup: "patio" }), table("T2", 4, { mergeGroup: "patio" })];
    const s = suggest(input(tables, [ticket("C1", 7, 15)]));
    expect(s).toHaveLength(1);
    expect(s[0].action).toBe("merge_seat");
    expect(s[0].tableIds.sort()).toEqual(["T1", "T2"]);
    expect(s[0].reasons.join(" ")).toMatch(/merges T1\+T2/);
  });

  it("smart prefers the longer-waiting party when both fit (aging)", () => {
    const s = suggest(input([table("T1", 4)], [ticket("B1", 4, 5), ticket("B2", 4, 40)]));
    expect(s.map((x) => x.ticketId)).toEqual(["B2"]);
  });

  it("smart avoids a table with an imminent booking", () => {
    const tables = [table("T1", 4), table("T2", 4)];
    const s = suggest(input(tables, [ticket("B1", 4, 10)], "smart", { bookings: [{ tableIds: ["T1"], slotStart: NOW + min(20) }] }));
    expect(s[0].tableIds).toEqual(["T2"]);
  });

  it("fairness: a ticket skipped maxSkips times is served first and holds back big tables", () => {
    // only a 6-top is free. A starved 6-pax ticket that fits must win over a fresh priority 2-pax.
    const s = suggest(input([table("T6", 6, { seatsMin: 1 })], [ticket("C1", 6, 50, { skips: 3 }), ticket("A1", 2, 60, { priority: 1 })]));
    expect(s.map((x) => x.ticketId)).toEqual(["C1"]);
    // if the starved ticket can't fit anywhere yet, smaller parties may not take tables it would need
    const held = suggest(input([table("T4", 4), table("T2", 2)], [ticket("C1", 4, 50, { skips: 3 }), ticket("A1", 2, 60)]));
    expect(held.find((x) => x.ticketId === "C1")?.tableIds).toEqual(["T4"]);
  });

  it("never double-books a table across suggestions", () => {
    const tables = [table("T1", 4, { mergeGroup: "g" }), table("T2", 4, { mergeGroup: "g" }), table("T3", 2)];
    const tickets = [ticket("C1", 8, 30), ticket("B1", 4, 29), ticket("B2", 3, 28), ticket("A1", 2, 27)];
    for (const strat of ["fifo", "category_fifo", "best_fit", "smart"] as const) {
      const s = suggest(input(tables, tickets, strat));
      const ids = s.flatMap((x) => x.tableIds);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe("ETA simulation", () => {
  it("free table → 0 min; second in line waits for predicted turn", () => {
    const etas = estimateWaits(
      input([table("T1", 2), table("T2", 2, { status: "seated" })], [ticket("A1", 2, 10), ticket("A2", 2, 5), ticket("A3", 2, 1)]),
      [{ tableIds: ["T2"], freeAt: NOW + min(20) }],
    );
    expect(etas.A1).toBe(0);
    expect(etas.A2).toBe(20);
    expect(etas.A3).toBeGreaterThan(20); // waits for T1 to turn (predicted 50 min)
    expect(etas.A3).toBe(50);
  });

  it("returns no ETA for an impossible party", () => {
    const etas = estimateWaits(input([table("T1", 2)], [ticket("X", 20, 1)]), []);
    expect(etas.X).toBeUndefined();
  });
});
