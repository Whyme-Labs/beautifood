const B32 = "0123456789abcdefghjkmnpqrstvwxyz";

/** Time-sortable id (ULID-like, lowercase Crockford base32) with a prefix. */
export function newId(prefix = ""): string {
  let t = Date.now();
  let time = "";
  for (let i = 0; i < 10; i++) {
    time = B32[t % 32] + time;
    t = Math.floor(t / 32);
  }
  let rand = "";
  for (const b of crypto.getRandomValues(new Uint8Array(10))) rand += B32[b % 32];
  return prefix + time + rand;
}

/** Unguessable URL-safe secret. */
export function randomToken(bytes = 18): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Short human-friendly code (no ambiguous characters). */
export function shortCode(len = 6): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  return [...crypto.getRandomValues(new Uint8Array(len))].map((x) => alphabet[x % alphabet.length]).join("");
}

export function localParts(at: number, timezone: string): { day: string; hour: number; weekend: boolean } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(new Date(at));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wd = g("weekday");
  return { day: `${g("year")}-${g("month")}-${g("day")}`, hour: Number(g("hour")) % 24, weekend: wd === "Sat" || wd === "Sun" };
}

export const localDay = (at: number, timezone: string) => localParts(at, timezone).day;

/** Epoch ms of a branch-local wall-clock time (DST-safe via offset probing). */
export function zonedTime(day: string, hour: number, minute: number, timezone: string): number {
  const [y, m, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  const off1 = tzOffsetMinutes(guess, timezone);
  const off2 = tzOffsetMinutes(guess - off1 * 60_000, timezone);
  return guess - off2 * 60_000;
}

function tzOffsetMinutes(at: number, timezone: string): number {
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
  return Math.round((Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - at) / 60_000);
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_-]+/g, "-")
      .slice(0, 40) || "x"
  );
}
