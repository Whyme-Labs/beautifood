// Table-assignment engine: candidate generation (single, merged, split tables),
// pluggable strategies, fairness bound, and ETA simulation.
// Pure functions — the BranchDO feeds it state and staff confirm suggestions.

import type { BranchConfig, Strategy, Suggestion } from "./types";

export interface AsgTable {
  id: string;
  label: string;
  seatsMin: number;
  seatsMax: number;
  mergeGroup: string | null;
  splitConfig: { suffix: string; seats: number }[] | null;
  parentId: string | null;
  status: string; // only "free" tables are assignable
}

export interface AsgTicket {
  id: string;
  number: string;
  category: string;
  partySize: number;
  createdAt: number;
  skips: number;
  priority: number;
}

export interface AsgBooking {
  tableIds: string[];
  slotStart: number;
}

export interface Candidate {
  tableIds: string[];
  labels: string[];
  capacity: number;
  action: Suggestion["action"];
  split?: { parentId: string; childSuffixes: string[] };
}

export interface EngineInput {
  tables: AsgTable[];
  tickets: AsgTicket[];
  bookings: AsgBooking[];
  config: Pick<BranchConfig, "strategy" | "weights" | "maxSkips">;
  now: number;
  predictTurn: (partySize: number) => number; // minutes
}

const MAX_MERGE = 4;

function fitsSingle(t: AsgTable, p: number) {
  return p >= t.seatsMin && p <= t.seatsMax;
}

/** All ways to seat a party of `p` using currently free tables. */
export function candidatesFor(p: number, free: AsgTable[]): Candidate[] {
  const out: Candidate[] = [];
  for (const t of free) {
    if (fitsSingle(t, p)) out.push({ tableIds: [t.id], labels: [t.label], capacity: t.seatsMax, action: "seat" });
    // split a free parent table into children; seat the party on the smallest child that fits
    if (t.splitConfig && t.splitConfig.length > 1 && !t.parentId && p < t.seatsMax) {
      const fitting = t.splitConfig.filter((c) => c.seats >= p).sort((a, b) => a.seats - b.seats);
      if (fitting.length) {
        const child = fitting[0];
        out.push({
          tableIds: [t.id],
          labels: [`${t.label}${child.suffix}`],
          capacity: child.seats,
          action: "split_seat",
          split: { parentId: t.id, childSuffixes: [child.suffix] },
        });
      }
    }
  }
  // merges: minimal subsets within a merge group
  const groups = new Map<string, AsgTable[]>();
  for (const t of free) if (t.mergeGroup) groups.set(t.mergeGroup, [...(groups.get(t.mergeGroup) ?? []), t]);
  for (const tables of groups.values()) {
    if (tables.length < 2) continue;
    const sorted = [...tables].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
    const combos: AsgTable[][] = [];
    const rec = (start: number, acc: AsgTable[]) => {
      if (acc.length >= 2) combos.push([...acc]);
      if (acc.length === MAX_MERGE) return;
      for (let i = start; i < sorted.length; i++) {
        acc.push(sorted[i]);
        rec(i + 1, acc);
        acc.pop();
      }
    };
    rec(0, []);
    for (const c of combos) {
      const cap = c.reduce((s, t) => s + t.seatsMax, 0);
      if (cap < p) continue;
      // minimal: removing any table must make it not fit (no supersets of a working combo)
      if (c.some((t) => cap - t.seatsMax >= p)) continue;
      // not needed if a single table of the group already fits
      if (c.some((t) => fitsSingle(t, p))) continue;
      out.push({ tableIds: c.map((t) => t.id), labels: c.map((t) => t.label), capacity: cap, action: "merge_seat" });
    }
  }
  return out;
}

function bookingGapMinutes(c: Candidate, bookings: AsgBooking[], now: number): number | null {
  let gap: number | null = null;
  for (const b of bookings) {
    if (b.slotStart < now - 15 * 60_000) continue;
    if (b.tableIds.some((id) => c.tableIds.includes(id))) {
      const g = (b.slotStart - now) / 60_000;
      if (gap === null || g < gap) gap = g;
    }
  }
  return gap;
}

export function scoreCandidate(t: AsgTicket, c: Candidate, input: EngineInput): { score: number; reasons: string[] } {
  const w = input.config.weights;
  const waitMin = Math.max(0, (input.now - t.createdAt) / 60_000);
  const reasons: string[] = [];
  let score = w.wait * (waitMin + 0.02 * waitMin * waitMin);
  reasons.push(`waiting ${Math.round(waitMin)} min`);
  const waste = c.capacity - t.partySize;
  score -= w.waste * waste * 3;
  reasons.push(waste === 0 ? "perfect fit" : `${waste} empty seat${waste > 1 ? "s" : ""}`);
  if (c.action === "merge_seat") {
    score -= w.merge * 5 * (c.tableIds.length - 1);
    reasons.push(`merges ${c.labels.join("+")}`);
  }
  if (c.action === "split_seat") {
    score -= w.merge * 3;
    reasons.push(`splits table to free the other half`);
  }
  if (t.priority > 0) {
    score += w.priority * 10 * t.priority;
    reasons.push("priority guest");
  }
  if (t.skips > 0) reasons.push(`skipped ${t.skips}×`);
  const gap = bookingGapMinutes(c, input.bookings, input.now);
  if (gap !== null) {
    const turn = input.predictTurn(t.partySize);
    if (gap < turn) {
      score -= w.booking * (turn - gap) / 5;
      reasons.push(`booking on this table in ${Math.max(0, Math.round(gap))} min`);
    }
  }
  return { score: Math.round(score * 100) / 100, reasons };
}

function preferenceOrder(a: Candidate, b: Candidate, p: number) {
  // simplest seating first: single > split > merge, then least waste
  const rank = (c: Candidate) => (c.action === "seat" ? 0 : c.action === "split_seat" ? 1 : 2);
  return rank(a) - rank(b) || a.capacity - p - (b.capacity - p);
}

function overlaps(c: Candidate, used: Set<string>) {
  return c.tableIds.some((id) => used.has(id));
}

function toSuggestion(t: AsgTicket, c: Candidate, input: EngineInput, extra?: string): Suggestion {
  const { score, reasons } = scoreCandidate(t, c, input);
  return {
    ticketId: t.id,
    ticketNumber: t.number,
    partySize: t.partySize,
    tableIds: c.tableIds,
    tableLabels: c.labels,
    action: c.action,
    split: c.split,
    score,
    reasons: extra ? [extra, ...reasons] : reasons,
  };
}

/** Produce seating suggestions according to the configured strategy. */
export function suggest(input: EngineInput): Suggestion[] {
  const free = input.tables.filter((t) => t.status === "free");
  const tickets = [...input.tickets].sort((a, b) => a.createdAt - b.createdAt);
  const strategy: Strategy = input.config.strategy;
  const used = new Set<string>();
  const out: Suggestion[] = [];
  const avail = () => free.filter((t) => !used.has(t.id));
  const take = (t: AsgTicket, c: Candidate, why?: string) => {
    c.tableIds.forEach((id) => used.add(id));
    out.push(toSuggestion(t, c, input, why));
  };

  if (strategy === "fifo") {
    for (const t of tickets) {
      const cands = candidatesFor(t.partySize, avail()).sort((a, b) => preferenceOrder(a, b, t.partySize));
      if (!cands.length) break; // strict: nobody overtakes the head of the line
      take(t, cands[0], "strict first-come-first-served");
    }
    return out;
  }

  if (strategy === "category_fifo") {
    // round-robin over the heads of each size class, so one class can't starve another
    const lines = new Map<string, AsgTicket[]>();
    for (const t of tickets) lines.set(t.category, [...(lines.get(t.category) ?? []), t]);
    const blocked = new Set<string>();
    while ([...lines.entries()].some(([c, l]) => l.length && !blocked.has(c))) {
      const heads = [...lines.entries()]
        .filter(([c, l]) => l.length && !blocked.has(c))
        .map(([, l]) => l[0])
        .sort((a, b) => a.createdAt - b.createdAt);
      for (const t of heads) {
        lines.get(t.category)!.shift();
        const cands = candidatesFor(t.partySize, avail()).sort((a, b) => preferenceOrder(a, b, t.partySize));
        if (!cands.length) {
          blocked.add(t.category);
          continue;
        }
        take(t, cands[0], `first in line for ${t.category}`);
      }
    }
    return out;
  }

  // best_fit and smart share the fairness pre-pass: starved tickets go first.
  const starved = tickets.filter((t) => t.skips >= input.config.maxSkips);
  const reservedFor = new Map<string, number>(); // ticketId -> party size that must not be overtaken
  for (const t of starved) {
    const cands = candidatesFor(t.partySize, avail()).sort((a, b) => preferenceOrder(a, b, t.partySize));
    if (cands.length) take(t, cands[0], `fairness: skipped ${t.skips}× already`);
    else reservedFor.set(t.id, t.partySize);
  }
  const done = new Set(out.map((s) => s.ticketId));
  const rest = tickets.filter((t) => !done.has(t.id) && !reservedFor.has(t.id));
  // a starved ticket that couldn't be seated holds back later tickets from tables big enough for it
  const minHeld = reservedFor.size ? Math.min(...reservedFor.values()) : Infinity;
  const isHeld = (c: Candidate) => c.capacity >= minHeld;

  type Pair = { t: AsgTicket; c: Candidate; score: number; waste: number };
  const pairs: Pair[] = [];
  for (const t of rest) {
    for (const c of candidatesFor(t.partySize, avail())) {
      if (isHeld(c) && t.partySize < minHeld) continue;
      pairs.push({ t, c, score: scoreCandidate(t, c, input).score, waste: c.capacity - t.partySize });
    }
  }
  if (strategy === "best_fit") pairs.sort((a, b) => a.waste - b.waste || a.t.createdAt - b.t.createdAt || preferenceOrder(a.c, b.c, a.t.partySize));
  else pairs.sort((a, b) => b.score - a.score || a.t.createdAt - b.t.createdAt);

  const seated = new Set<string>();
  for (const p of pairs) {
    if (seated.has(p.t.id) || overlaps(p.c, used)) continue;
    seated.add(p.t.id);
    take(p.t, p.c, strategy === "best_fit" ? "best seat fit" : undefined);
  }
  return out;
}

export interface BusyTable {
  tableIds: string[];
  freeAt: number; // predicted
}

/**
 * Estimate minutes until each waiting ticket is seated by replaying the strategy
 * forward in time against predicted table release times.
 */
export function estimateWaits(input: EngineInput, busy: BusyTable[]): Record<string, number> {
  const etas: Record<string, number> = {};
  let tables = input.tables.map((t) => ({ ...t }));
  let pending = [...input.tickets];
  const releases = busy.map((b) => ({ ...b, freeAt: Math.max(b.freeAt, input.now + 5 * 60_000) }));
  let t = input.now;
  for (let iter = 0; iter < 200 && pending.length; iter++) {
    const sugg = suggest({ ...input, tables, tickets: pending, now: t, bookings: [] });
    for (const s of sugg) {
      etas[s.ticketId] = Math.round((t - input.now) / 60_000);
      const turn = input.predictTurn(s.partySize) * 60_000;
      const ids = s.tableIds;
      tables = tables.map((x) => (ids.includes(x.id) ? { ...x, status: "busy" } : x));
      releases.push({ tableIds: ids, freeAt: t + turn });
    }
    const seatedIds = new Set(sugg.map((s) => s.ticketId));
    pending = pending.filter((p) => !seatedIds.has(p.id));
    if (!pending.length) break;
    const future = releases.filter((r) => r.freeAt > t && Number.isFinite(r.freeAt)).sort((a, b) => a.freeAt - b.freeAt);
    if (!future.length) {
      // nothing will ever free up (e.g. party bigger than any table/merge): unknown ETA
      break;
    }
    const next = future[0];
    t = next.freeAt;
    const freeing = new Set(releases.filter((r) => r.freeAt <= t).flatMap((r) => r.tableIds));
    tables = tables.map((x) => (freeing.has(x.id) && (x.status === "busy" || x.status === "seated" || x.status === "dirty") ? { ...x, status: "free" } : x));
    for (const r of releases) if (r.freeAt <= t) r.freeAt = Number.POSITIVE_INFINITY;
  }
  return etas;
}

export function categoryFor<T extends { code: string; min: number; max: number }>(cats: T[], partySize: number): T | undefined {
  return cats.find((c) => partySize >= c.min && partySize <= c.max);
}
