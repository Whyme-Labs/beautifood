export function categoryFor<T extends { code: string; min: number; max: number }>(cats: T[], partySize: number): T | undefined {
  return cats.find((c) => partySize >= c.min && partySize <= c.max);
}
