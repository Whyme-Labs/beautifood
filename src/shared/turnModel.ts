// Online-learning dining-duration ("turn time") model.
// Keyed by party-size bucket × daypart × weekend flag. Each key keeps an EWMA with
// a Bayesian-style shrinkage toward a prior, so early predictions are sensible and
// the model adapts as the restaurant's real behaviour accumulates.

export interface TurnStat {
  mean: number; // minutes
  n: number;
}
export type TurnModelState = Record<string, TurnStat>;

export function sizeBucket(partySize: number): string {
  if (partySize <= 2) return "1-2";
  if (partySize <= 4) return "3-4";
  if (partySize <= 6) return "5-6";
  if (partySize <= 8) return "7-8";
  return "9+";
}

export function localHour(at: number, timezone: string): { hour: number; weekend: boolean } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hourCycle: "h23", weekday: "short" }).formatToParts(new Date(at));
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
    return { hour, weekend: wd === "Sat" || wd === "Sun" };
  } catch {
    const d = new Date(at);
    return { hour: d.getUTCHours(), weekend: d.getUTCDay() === 0 || d.getUTCDay() === 6 };
  }
}

export function daypart(hour: number): string {
  if (hour >= 6 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 18) return "tea";
  if (hour >= 18 && hour < 23) return "dinner";
  return "late";
}

export function turnKey(partySize: number, at: number, timezone: string): string {
  const { hour, weekend } = localHour(at, timezone);
  return `${sizeBucket(partySize)}|${daypart(hour)}|${weekend ? "we" : "wd"}`;
}

export function priorMinutes(partySize: number): number {
  return 35 + 6 * Math.min(partySize, 12);
}

const PRIOR_WEIGHT = 3;

export function predictTurn(state: TurnModelState, partySize: number, at: number, timezone: string): number {
  const s = state[turnKey(partySize, at, timezone)];
  const prior = priorMinutes(partySize);
  if (!s || s.n === 0) return prior;
  return (prior * PRIOR_WEIGHT + s.mean * s.n) / (PRIOR_WEIGHT + s.n);
}

/** Update with one observed seating duration. Returns a new state (pure). */
export function observeTurn(state: TurnModelState, partySize: number, startedAt: number, minutes: number, timezone: string): TurnModelState {
  if (!(minutes > 2 && minutes < 600)) return state; // ignore junk (mis-taps, forgotten tables)
  const key = turnKey(partySize, startedAt, timezone);
  const prev = state[key];
  let next: TurnStat;
  if (!prev) next = { mean: minutes, n: 1 };
  else {
    const alpha = Math.max(0.1, 1 / (prev.n + 1)); // running mean at first, EWMA once warm
    next = { mean: prev.mean + alpha * (minutes - prev.mean), n: Math.min(prev.n + 1, 1000) };
  }
  return { ...state, [key]: next };
}
