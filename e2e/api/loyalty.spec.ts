import { expect, test } from "@playwright/test";
import { BASE, errorOf, eventually, guestClient, inbox, join, json, menuItems, runPipeline, seatWalkIn, seed, tableIds, uid } from "../helpers";

async function paidBill(s: Awaited<ReturnType<typeof seed>>, label: string, email: string, dishes: [string, number][]) {
  const t = await tableIds(s.owner, s.klcc.id);
  const m = await menuItems(s.owner);
  const st = await seatWalkIn(s.owner, s.klcc.id, [t[label].id], 2);
  const o = await json(s.owner.post(`/api/m/branches/${s.klcc.id}/orders`, { data: { seatingId: st.seatingId, items: dishes.map(([n, qty]) => ({ itemId: m.byName(n).id, qty })) } }), 201);
  await json(s.owner.post(`/api/m/branches/${s.klcc.id}/orders/${o.id}/contact`, { data: { email, name: "Lin" } }));
  return o;
}

test.describe("loyalty, e-receipts, campaigns, notifications", () => {
  test("paying a bill emails an e-receipt and credits points exactly once, even if the pipeline runs again", async () => {
    const s = await seed();
    const email = `${uid("lin")}@example.com`;
    const o = await paidBill(s, "T1", email, [["Hainanese Chicken Rice", 2], ["Cendol", 1]]);
    const pay = await json(s.owner.post(`/api/m/branches/${s.klcc.id}/orders/${o.id}/pay`, { data: { method: "card", amount: o.total, msgId: uid() } }));
    expect(pay.payment.receiptToken).toBeTruthy();
    await runPipeline(s.owner);
    await runPipeline(s.owner); // at-least-once delivery must not double-credit or double-send
    const mail = await eventually(async () => {
      const r = await inbox(s.owner, email, "receipt");
      return r.length ? r : null;
    });
    expect(mail).toHaveLength(1);
    // delivered through the Cloudflare SEND_EMAIL binding, exactly once
    expect(mail[0]).toMatchObject({ status: "sent", attempts: 1, error: null });
    expect(mail[0].message_id).toBeTruthy();
    expect(mail[0].subject).toContain("Your receipt from");
    expect(mail[0].html).toContain("Hainanese Chicken Rice");
    const expected = Math.floor(o.total / 100);
    expect(mail[0].text).toContain(`${expected}`);
    const receipt = await json((await guestClient()).get(`/api/public/receipts/${pay.payment.receiptToken}`));
    expect(receipt.total).toBe(o.total);
    expect(receipt.points.earned).toBe(expected);
    const members = await json(s.owner.get(`/api/m/members?q=${encodeURIComponent(email)}`));
    expect(members.members[0].points).toBe(expected);
    expect(members.members[0].visits).toBe(1);
  });

  test("members sign in with an emailed one-time code, see their points, and can pay with them; balances never go negative", async () => {
    const s = await seed();
    const email = `${uid("mem")}@example.com`;
    const g = await guestClient();
    await json(g.post("/api/public/members/otp", { data: { email, tenant: s.slug } }));
    const otpMail = await eventually(async () => (await inbox(s.owner, email, "otp"))[0]);
    const code = otpMail.subject.match(/^(\d{6})/)![1];
    expect((await errorOf(g.post("/api/public/members/verify", { data: { email, tenant: s.slug, code: code === "000000" ? "111111" : "000000" } }), 401)).code).toBe("wrong_code");
    const { token, member } = await json(g.post("/api/public/members/verify", { data: { email, tenant: s.slug, code, name: "Mia" } }));
    // codes are single-use
    expect((await errorOf(g.post("/api/public/members/verify", { data: { email, tenant: s.slug, code } }), 401)).code).toBe("code_expired");

    const goodwill = await json(s.owner.post(`/api/m/members/${member.id}`, { data: { delta: 250, reason: "Welcome gift" } }));
    expect(goodwill.points).toBe(250);
    const me = await json(g.get("/api/public/members/me", { headers: { authorization: `Member ${token}` } }));
    expect(me.member.points).toBe(250);
    expect(me.tier.name).toBe("Bronze");
    expect(me.nextTier).toEqual({ name: "Silver", pointsNeeded: 1000 });

    const o = await paidBill(s, "T2", email, [["Nasi Kerabu", 2]]);
    const url = `/api/m/branches/${s.klcc.id}/orders/${o.id}/pay`;
    expect((await errorOf(s.owner.post(url, { data: { method: "points", amount: 50, msgId: uid() } }), 400)).code).toBe("below_min_redeem");
    const p = await json(s.owner.post(url, { data: { method: "points", amount: 200, msgId: uid() } }));
    expect(p.payment.points).toBe(200);
    // only 50 left: a 100-point redemption is refused by the database constraint, atomically
    expect((await errorOf(s.owner.post(url, { data: { method: "points", amount: 100, msgId: uid() } }), 409)).code).toBe("insufficient_points");
    const bill = await json(s.owner.get(`/api/m/branches/${s.klcc.id}/orders/${o.id}`));
    expect(bill.paid).toBe(200);
    await json(s.owner.post(url, { data: { method: "card", amount: o.total - 200, msgId: uid() } }));
    await runPipeline(s.owner);
    const after = await eventually(async () => {
      const x = await json(g.get("/api/public/members/me", { headers: { authorization: `Member ${token}` } }));
      return x.ledger.some((l: any) => l.kind === "earn") ? x : null;
    });
    // points are earned only on the part not paid with points
    expect(after.member.points).toBe(50 + Math.floor((o.total - 200) / 100));
    expect(after.ledger.map((l: any) => l.kind).sort()).toEqual(["adjust", "earn", "redeem"]);
    // staff can't adjust below zero either
    expect((await errorOf(s.owner.post(`/api/m/members/${member.id}`, { data: { delta: -100000, reason: "oops" } }), 409)).code).toBe("insufficient_points");
  });

  test("promo broadcast: segment preview, queue fan-out to opted-in members, one email each, unsubscribe link works", async () => {
    const s = await seed();
    const preview = await json(s.owner.get(`/api/m/campaigns?preview=${encodeURIComponent(JSON.stringify({ type: "all" }))}`));
    expect(preview.count).toBe(3);
    const subject = `Durian season ${uid()}`;
    const { id } = await json(s.owner.post("/api/m/campaigns", { data: { name: "Durian", subject, body: "Hi {name}, Musang King cendol is back!", segment: { type: "all" }, promoCode: "WELCOME10" } }), 201);
    const sent = await json(s.owner.post(`/api/m/campaigns/${id}/send`));
    expect(sent.recipients).toBe(3);
    expect((await errorOf(s.owner.post(`/api/m/campaigns/${id}/send`), 409)).code).toBe("already_sent");
    const ali = await eventually(async () => (await inbox(s.owner, "ali@example.com", "campaign")).find((e) => e.subject === subject), 20_000);
    expect(ali.text).toContain("Hi Ali, Musang King cendol is back!");
    expect(ali.text).toContain("Use code WELCOME10");
    expect(ali.status).toBe("sent");
    const headers = JSON.parse(ali.headers!);
    expect(headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    const camp = await eventually(async () => (await json<any[]>(s.owner.get("/api/m/campaigns"))).find((c) => c.id === id && c.status === "sent"), 20_000);
    expect(camp.sent).toBe(3);

    // unsubscribe from the email link → excluded from the next broadcast
    const link = ali.text.match(/Unsubscribe: (\S+)/)![1].replace(/^https?:\/\/[^/]+/, BASE);
    const r = await (await guestClient()).get(link);
    expect(r.status()).toBe(200);
    expect(await r.text()).toContain("unsubscribed");
    // one-click unsubscribe (what Gmail's button does) works on the header URL too
    const mei = await eventually(async () => (await inbox(s.owner, "mei@example.com", "campaign")).find((e) => e.subject === subject));
    const oneClick = JSON.parse(mei.headers!)["List-Unsubscribe"].slice(1, -1).replace(/^https?:\/\/[^/]+/, BASE);
    expect((await (await guestClient()).post(oneClick, { form: { "List-Unsubscribe": "One-Click" } })).status()).toBe(200);
    const forged = await (await guestClient()).get("/api/public/unsubscribe?t=forged.token");
    expect(forged.status()).toBe(400);
    const again = await json(s.owner.get(`/api/m/campaigns?preview=${encodeURIComponent(JSON.stringify({ type: "all" }))}`));
    expect(again.count).toBe(1);
    expect(again.sample).toEqual(["sam@example.com"]);
  });

  test("queue notifications: join email, and calling a ticket sends a VAPID-signed Web Push plus a 'table ready' email", async () => {
    const s = await seed();
    const email = `${uid("q")}@example.com`;
    const a = await join(s.klcc.ref, 2, "Pat", { email });
    const g = await guestClient();
    const endpoint = `${BASE}/api/dev/push-sink?sub=${uid()}`;
    await json(g.post(`/api/public/tickets/${a.ticket.id}/push?k=${encodeURIComponent(a.token)}`, { data: { endpoint } }));
    await errorOf(g.post(`/api/public/tickets/${a.ticket.id}/push?k=bad.token`, { data: { endpoint } }), 401);
    const t = await tableIds(s.owner, s.klcc.id);
    await json(s.owner.post(`/api/m/branches/${s.klcc.id}/tickets/${a.ticket.id}/call`, { data: { holdTableIds: [t.T3.id] } }));
    await runPipeline(s.owner);
    const push = await eventually(async () => (await json<any[]>(s.owner.get("/api/dev/push-sink"))).find((p) => endpoint.endsWith(p.path.replace("/api/dev/push-sink", ""))));
    expect(push.vapid).toBe(true);
    expect(push.ttl).toBe("600");
    const kinds = await eventually(async () => {
      const k = (await inbox(s.owner, email)).map((e) => e.kind);
      return k.includes("ticket_called") ? k : null;
    });
    expect(kinds.sort()).toEqual(["ticket_called", "ticket_joined"]);
  });
});
