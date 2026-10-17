import { expect, test } from "@playwright/test";
import { guestClient, seed, uid } from "../helpers";

// Runs after the functional projects: on a local dev box the whole Worker is one
// workerd process with one SQLite file, so a surge would starve concurrent tests.
test.describe("load", () => {
  test("surge: 300 simultaneous joins produce gap-free, duplicate-free numbers", async () => {
    test.setTimeout(120_000);
    const s = await seed();
    const N = 300;
    const started = Date.now();
    const results = await Promise.all(
      Array.from({ length: N }, async (_, i) => {
        const g = await guestClient(`surge-${i}-${uid()}`);
        const r = await g.post(`/api/public/branches/${s.klcc.ref}/queue`, { data: { partySize: 2, name: `S${i}` } });
        const status = r.status();
        const body = await r.json();
        await g.dispose();
        return { status, number: body.ticket?.number as string | undefined };
      }),
    );
    const elapsed = Date.now() - started;
    const ok = results.filter((r) => r.status === 201);
    expect(ok).toHaveLength(N);
    const nums = ok.map((r) => Number(r.number!.slice(1))).sort((a, b) => a - b);
    expect(new Set(nums).size).toBe(N);
    expect(nums[0]).toBe(1);
    expect(nums[N - 1]).toBe(N);
    test.info().annotations.push({ type: "surge", description: `${N} concurrent joins in ${elapsed} ms (${Math.round((N / elapsed) * 1000)} joins/s on a local dev box)` });
  });
});
