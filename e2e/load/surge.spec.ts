import { expect, test } from "@playwright/test";
import { guestClient, seed, uid } from "../helpers";

// Runs after the functional projects: on a local dev box the whole Worker is one
// workerd process with one SQLite file, so a surge would starve concurrent tests.
test.describe("load", () => {
  test("surge: 300 simultaneous joins produce gap-free, duplicate-free numbers, even when phones retry", async () => {
    test.setTimeout(120_000);
    const s = await seed();
    const N = 300;
    const started = Date.now();
    const results = await Promise.all(
      Array.from({ length: N }, async (_, i) => {
        const g = await guestClient(`surge-${i}-${uid()}`);
        // Like a real phone, retry once on a server/network error. Joins are idempotent per
        // device, so a retry after a commit returns the same ticket instead of a second one.
        let tries = 0;
        let status = 0;
        let body: any = {};
        while (tries++ < 2) {
          const r = await g.post(`/api/public/branches/${s.klcc.ref}/queue`, { data: { partySize: 2, name: `S${i}` } });
          status = r.status();
          body = status < 500 ? await r.json() : {};
          if (status < 500) break;
        }
        await g.dispose();
        return { status, retried: tries > 1, existing: !!body.existing, number: body.ticket?.number as string | undefined };
      }),
    );
    const elapsed = Date.now() - started;
    const ok = results.filter((r) => r.status === 201);
    expect(ok).toHaveLength(N);
    const nums = ok.map((r) => Number(r.number!.slice(1))).sort((a, b) => a - b);
    expect(new Set(nums).size).toBe(N);
    expect(nums[0]).toBe(1);
    expect(nums[N - 1]).toBe(N);
    const retried = results.filter((r) => r.retried).length;
    test.info().annotations.push({
      type: "surge",
      description: `${N} concurrent joins in ${elapsed} ms (${Math.round((N / elapsed) * 1000)} joins/s on a local dev box); ${retried} retried after a local socket reset, ${results.filter((r) => r.existing).length} of those had already committed`,
    });
  });
});
