import { createServer, type IncomingMessage, type Server } from "node:http";
import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { errorOf, eventually, hire, join, json, menuItems, runPipeline, seatWalkIn, seed, tableIds, uid } from "../helpers";

// A receiver in the test process: records each delivery, answers with whatever `reply` says.
type Got = { headers: IncomingMessage["headers"]; raw: string; body: any };
function receiver() {
  const got: Got[] = [];
  let reply = 200;
  const server: Server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      got.push({ headers: req.headers, raw, body: JSON.parse(raw || "{}") });
      res.writeHead(reply, { "content-type": "text/plain" }).end(reply < 300 ? "ok" : "nope");
    });
  });
  return {
    got,
    setReply: (n: number) => (reply = n),
    start: () => new Promise<string>((ok) => server.listen(0, "127.0.0.1", () => ok(`http://127.0.0.1:${(server.address() as { port: number }).port}/hook`))),
    stop: () => new Promise((ok) => server.close(ok)),
  };
}

/** The receiver-side check a connector does (the brief's verifyBeautifood, in Node). */
function verify(g: Got, secret: string) {
  const parts = Object.fromEntries(String(g.headers["x-beautifood-signature"]).split(",").map((p) => p.split("=")));
  const mac = createHmac("sha256", secret).update(`${parts.t}.${g.raw}`).digest("hex");
  return mac === parts.v1 && Math.abs(Date.now() / 1000 - Number(parts.t)) < 300;
}

test.describe("webhooks", () => {
  test("subscribed events reach the endpoint signed, with the record they're about; failures retry and can be resent", async () => {
    const r = receiver();
    const url = await r.start();
    try {
      const s = await seed();
      const hook = await json(s.owner.post("/api/m/webhooks", { data: { url, description: "test receiver", events: ["queue.joined", "order.paid"], branches: [s.klcc.id] } }), 201);
      expect(hook.secret).toMatch(/^whsec_[0-9a-f]{48}$/);
      expect((await json(s.owner.get(`/api/m/webhooks/${hook.id}/secret`))).secret).toBe(hook.secret);

      // a guest joins at KLCC (subscribed) and at Bangsar (not this endpoint's branch)
      await join(s.klcc.ref, 2, "Wei Ling");
      await join(s.bangsar.ref, 3, "Arif");
      await runPipeline(s.owner);
      const joined = await eventually(async () => (await runPipeline(s.owner), r.got.find((g) => g.body.type === "queue.joined")));
      expect(joined.headers["x-beautifood-event"]).toBe("queue.joined");
      expect(String(joined.headers["x-beautifood-delivery"])).toMatch(/^whd_/);
      expect(verify(joined, hook.secret)).toBe(true);
      expect(verify(joined, "whsec_wrong")).toBe(false);
      expect(joined.body).toMatchObject({ type: "queue.joined", restaurant: { id: s.tenantId }, branch: { id: s.klcc.id }, data: { partySize: 2, ticket: { name: "Wei Ling", party_size: 2, status: "waiting" } } });
      expect(r.got.filter((g) => g.body.type === "queue.joined")).toHaveLength(1); // Bangsar's join isn't sent

      // a paid bill carries the order with its lines and totals
      const t = await tableIds(s.owner, s.klcc.id);
      const st = await seatWalkIn(s.owner, s.klcc.id, [t.T1.id], 2);
      const m = await menuItems(s.owner);
      const o = await json(s.owner.post(`/api/m/branches/${s.klcc.id}/orders`, { data: { seatingId: st.seatingId, items: [{ itemId: m.byName("Char Kway Teow").id, qty: 2 }] } }), 201);
      await json(s.owner.post(`/api/m/branches/${s.klcc.id}/orders/${o.id}/pay`, { data: { method: "card", amount: o.total, msgId: uid() } }));
      await runPipeline(s.owner);
      const paid = await eventually(async () => (await runPipeline(s.owner), r.got.find((g) => g.body.type === "order.paid")));
      expect(paid.body.data.order).toMatchObject({ id: o.id, total: o.total, paid: o.total, items: [{ name: "Char Kway Teow", qty: 2 }] });
      expect(verify(paid, hook.secret)).toBe(true);
      // events it didn't subscribe to (the seating, the payment itself) aren't sent
      expect(r.got.every((g) => ["queue.joined", "order.paid"].includes(g.body.type))).toBe(true);

      // the receiver goes down: the delivery is kept for a retry and the log says why
      r.setReply(500);
      await join(s.klcc.ref, 4, "Siew Mei");
      await runPipeline(s.owner);
      const failing = await eventually(async () => (await runPipeline(s.owner), await json(s.owner.get(`/api/m/webhooks/${hook.id}/deliveries`))).find((d: any) => d.payload.data.ticket?.name === "Siew Mei" && d.attempts === 1));
      expect(failing).toMatchObject({ status: "pending", responseStatus: 500, error: "HTTP 500", responseBody: "nope" });
      expect(failing.nextAt).toBeGreaterThan(Date.now() + 30_000); // backs off (first retry after a minute)
      // back up: resend from the log
      r.setReply(200);
      expect(await json(s.owner.post(`/api/m/webhooks/deliveries/${failing.id}/resend`))).toMatchObject({ status: "delivered", response_status: 200 });
      expect(r.got.filter((g) => g.body.data?.ticket?.name === "Siew Mei")).toHaveLength(2);

      // a test ping, and the endpoint's week of stats
      expect(await json(s.owner.post(`/api/m/webhooks/${hook.id}/test`))).toMatchObject({ status: "delivered", response_status: 200 });
      expect(r.got.some((g) => g.body.type === "webhook.ping")).toBe(true);
      const [listed] = await json(s.owner.get("/api/m/webhooks"));
      expect(listed.stats).toMatchObject({ delivered: 4, failed: 0, pending: 0 });

      // rotating the secret: new deliveries are signed with the new one only
      const { secret: rotated } = await json(s.owner.post(`/api/m/webhooks/${hook.id}/secret`));
      expect(rotated).not.toBe(hook.secret);
      await json(s.owner.post(`/api/m/webhooks/${hook.id}/test`));
      const last = r.got[r.got.length - 1];
      expect(verify(last, rotated)).toBe(true);
      expect(verify(last, hook.secret)).toBe(false);

      // paused: nothing more goes out
      await json(s.owner.patch(`/api/m/webhooks/${hook.id}`, { data: { active: false } }));
      const before = r.got.length;
      await join(s.klcc.ref, 2, "Paused");
      await runPipeline(s.owner);
      await new Promise((ok) => setTimeout(ok, 500));
      expect(r.got.length).toBe(before);
    } finally {
      await r.stop();
    }
  });

  test("an endpoint only sees its own restaurant, and only what happens after it was added", async () => {
    const r = receiver();
    const url = await r.start();
    try {
      const a = await seed();
      await join(a.klcc.ref, 2, "Before");
      await runPipeline(a.owner);
      await json(a.owner.post("/api/m/webhooks", { data: { url, events: ["*"] } }), 201);
      const b = await seed();
      await join(b.klcc.ref, 2, "Other restaurant");
      await join(a.klcc.ref, 2, "After");
      await runPipeline(a.owner);
      await eventually(async () => (await runPipeline(a.owner), r.got.find((g) => g.body.data?.ticket?.name === "After")));
      const names = r.got.map((g) => g.body.data?.ticket?.name).filter(Boolean);
      expect(names).not.toContain("Before");
      expect(names).not.toContain("Other restaurant");
      expect(r.got.every((g) => g.body.restaurant.id === a.tenantId)).toBe(true);
    } finally {
      await r.stop();
    }
  });

  test("only integration managers can set them up; bad addresses and empty subscriptions are refused; the brief is generated", async () => {
    const s = await seed();
    const manager = await hire(s.owner, "branch_manager", [s.klcc.id]);
    await errorOf(manager.api.get("/api/m/webhooks"), 403);
    await errorOf(manager.api.post("/api/m/webhooks", { data: { url: "https://example.com/hook", events: ["*"] } }), 403);
    expect((await errorOf(s.owner.post("/api/m/webhooks", { data: { url: "ftp://example.com/hook", events: ["*"] } }), 400)).code).toBe("invalid_url");
    expect((await errorOf(s.owner.post("/api/m/webhooks", { data: { url: "https://user:pw@example.com/hook", events: ["*"] } }), 400)).code).toBe("invalid_url");
    expect((await errorOf(s.owner.post("/api/m/webhooks", { data: { url: "https://example.com/hook", events: ["not.an.event"] } }), 400)).code).toBe("no_events");

    const md = await (await s.owner.get("/api/m/integrations/brief")).text();
    expect(md).toContain(`Restaurant id \`${s.tenantId}\``);
    expect(md).toContain(`\`${s.klcc.ref}\``);
    for (const e of ["queue.called", "order.paid", "menu.sold_out", "x-beautifood-signature", "verifyBeautifood", "Authorization: Bearer bf_pat_"]) expect(md).toContain(e);
    await errorOf(manager.api.get("/api/m/integrations/brief"), 403);
  });
});
