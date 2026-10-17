const B32 = "0123456789abcdefghjkmnpqrstvwxyz";

/** Time-sortable id (ULID-like, lowercase Crockford base32) with an optional prefix. */
export function newId(prefix = ""): string {
  let t = Date.now();
  let time = "";
  for (let i = 0; i < 10; i++) {
    time = B32[t % 32] + time;
    t = Math.floor(t / 32);
  }
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let rand = "";
  for (const b of bytes) rand += B32[b % 32];
  return prefix + time + rand;
}

/** Unguessable URL-safe secret. */
export function token(bytes = 18): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Short human-friendly code (no ambiguous chars). */
export function shortCode(len = 6): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const b = crypto.getRandomValues(new Uint8Array(len));
  return [...b].map((x) => alphabet[x % alphabet.length]).join("");
}

export function localDay(at: number, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at));
  } catch {
    return new Date(at).toISOString().slice(0, 10);
  }
}

export function localHourOf(at: number, timezone: string): number {
  try {
    return Number(new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hourCycle: "h23" }).format(new Date(at)));
  } catch {
    return new Date(at).getUTCHours();
  }
}

/** Epoch ms for a local wall-clock time in a timezone (DST-safe via offset probing). */
export function zonedTime(day: string, hour: number, minute: number, timezone: string): number {
  const [y, m, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  const offset = tzOffsetMinutes(guess, timezone);
  const first = guess - offset * 60_000;
  const offset2 = tzOffsetMinutes(first, timezone);
  return guess - offset2 * 60_000;
}

function tzOffsetMinutes(at: number, timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(at));
    const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
    return Math.round((asUtc - at) / 60_000);
  } catch {
    return 0;
  }
}
