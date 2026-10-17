export function formatMoney(minor: number, currency = "MYR"): string {
  const sym: Record<string, string> = { MYR: "RM", USD: "$", SGD: "S$", EUR: "€", GBP: "£", AUD: "A$", IDR: "Rp", THB: "฿" };
  const s = (Math.abs(minor) / 100).toFixed(2);
  return `${minor < 0 ? "-" : ""}${sym[currency] ?? currency + " "}${s}`;
}

export function minutesLabel(m: number | null | undefined): string {
  if (m == null) return "—";
  if (m <= 0) return "now";
  if (m < 60) return `~${m} min`;
  return `~${Math.floor(m / 60)}h ${m % 60}m`;
}
