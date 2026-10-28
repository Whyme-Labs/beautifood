import { expect, test } from "@playwright/test";
import { errorOf, guestClient, json, seed } from "../helpers";

// A branch's halal standing, end to end: the owner declares it in settings, guests see it on the
// branch page and the menu, the assistant answers from it, and setting it back takes it all away.
test.describe("halal standing", () => {
  test("certified by JAKIM: the badge, the assistant's answers, then back to not declared", async () => {
    const s = await seed();
    const settings = `/api/m/branches/${s.klcc.id}/settings`;
    const ask = async (content: string) => (await json((await guestClient()).post(`/api/public/branches/${s.klcc.ref}/assistant`, { data: { messages: [{ role: "user", content }] } }))).answer as string;
    const page = async (path: string) => (await (await guestClient()).get(`/r/${s.klcc.ref}${path}`)).text();

    // nothing declared by default: no badge, and the staff are asked about the certificate
    expect((await json((await guestClient()).get(`/api/public/branches/${s.klcc.ref}`))).halal).toMatchObject({ status: "none", standing: "none" });
    expect(await page("/menu")).not.toContain('data-testid="halal-badge"');
    expect(await ask("I'm Muslim, is this place halal?")).toMatch(/Our staff can tell you about the kitchen's halal certification/);

    // certified needs the body that certified it
    expect((await errorOf(s.owner.patch(settings, { data: { halal: { status: "certified" } } }), 400)).code).toBe("halal_certifier_required");
    const cfg = await json(s.owner.patch(settings, { data: { halal: { status: "certified", certifier: "JAKIM", certNo: "JAKIM/(S)/22.00/492-2/1/3 1234", validUntil: "2099-12-31" } } }));
    expect(cfg.config.halal).toMatchObject({ status: "certified", certifier: "JAKIM", validUntil: "2099-12-31" });

    const pub = await json((await guestClient()).get(`/api/public/branches/${s.klcc.ref}`));
    expect(pub.halal).toMatchObject({ status: "certified", certifier: "JAKIM", standing: "certified" });
    for (const path of ["", "/menu"]) {
      const html = await page(path);
      expect(html).toContain('data-testid="halal-badge"');
      expect(html).toContain("Halal-certified · JAKIM");
    }
    expect(await ask("I'm Muslim, is this place halal?")).toMatch(/Yes: this branch is halal-certified by JAKIM \(certificate JAKIM\/\(S\)\/22\.00\/492-2\/1\/3 1234\), valid until 31 Dec 2099/);
    expect(await ask("is the nasi lemak halal?")).toMatch(/is halal: this branch is halal-certified by JAKIM/);

    // an expired certificate is no certificate
    await json(s.owner.patch(settings, { data: { halal: { validUntil: "2020-01-31" } } }));
    expect((await json((await guestClient()).get(`/api/public/branches/${s.klcc.ref}`))).halal.standing).toBe("expired");
    expect(await page("/menu")).not.toContain('data-testid="halal-badge"');
    expect(await ask("I'm Muslim, is this place halal?")).toMatch(/certificate has expired/);

    // back to not declared: as it was
    await json(s.owner.patch(settings, { data: { halal: { status: "none", certifier: "", certNo: "", validUntil: "" } } }));
    expect((await json((await guestClient()).get(`/api/public/branches/${s.klcc.ref}`))).halal).toMatchObject({ status: "none", standing: "none" });
    expect(await page("/menu")).not.toContain('data-testid="halal-badge"');
    expect(await ask("I'm Muslim, is this place halal?")).toMatch(/Our staff can tell you about the kitchen's halal certification/);
  });
});
