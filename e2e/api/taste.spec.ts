import { expect, test, request as pwRequest } from "@playwright/test";
import { BASE, errorOf, guestClient, json, seed } from "../helpers";

// The taste brief end to end: the Worker calls the taste service (services/taste), which runs a
// stand-in for Qloo's harness over MCP (scripts/e2e-server.sh starts both).
async function mcp(body: unknown, token?: string) {
  const c = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { accept: "application/json, text/event-stream", ...(token ? { authorization: `Bearer ${token}` } : {}) } });
  const r = await c.post("/mcp", { data: body });
  return r.json();
}

test.describe("taste insights (Qloo)", () => {
  test("an owner gets a brief for the branch's area, with sources and things to try", async () => {
    const s = await seed();
    const b = await json(s.owner.get(`/api/m/branches/${s.klcc.id}/taste?location=${encodeURIComponent("Kuala Lumpur")}`));
    expect(b.location).toBe("Kuala Lumpur");
    expect(b.findings.map((f: any) => f.key)).toEqual(["nearby", "cuisine", "music", "tv"]);
    expect(b.findings[0].items[0].name).toBe("Nasi Kandar Pelita");
    for (const f of b.findings) expect(f.source.asked).toBeTruthy();
    const kinds = b.actions.map((a: any) => a.kind);
    expect(kinds).toEqual(expect.arrayContaining(["special", "playlist", "theme_night"]));
    expect(b.actions.find((a: any) => a.kind === "special").vars.tag).toBe("Indian Muslim");
    expect(b.limits.length).toBeGreaterThan(0);

    // guests and staff without reports can't read it
    expect((await errorOf((await guestClient()).get(`/api/m/branches/${s.klcc.id}/taste`), 401)).code).toBe("unauthorized");
  });

  test("an owner's own AI gets the brief and can ask Qloo through MCP; guests' agents can't", async () => {
    const s = await seed();
    const { token } = await json(s.owner.post("/api/m/tokens", { data: { name: "Claude" } }), 201);
    const pub = await mcp({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(pub.result.tools.map((t: any) => t.name)).not.toContain("merchant_taste_brief");
    const priv = await mcp({ jsonrpc: "2.0", id: 2, method: "tools/list" }, token);
    expect(priv.result.tools.map((t: any) => t.name)).toEqual(expect.arrayContaining(["merchant_taste_brief", "merchant_taste_query"]));

    const brief = await mcp({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "merchant_taste_brief", arguments: { branch: s.klcc.ref, location: "Kuala Lumpur" } } }, token);
    expect(brief.result.isError).toBeFalsy();
    const data = JSON.parse(brief.result.content[0].text);
    expect(data.actions.find((a: any) => a.kind === "playlist").text).toContain("Yuna");

    const q = await mcp({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "merchant_taste_query", arguments: { branch: s.klcc.ref, workflow: "qloo_find_tags", args: { query: "nasi lemak" } } } }, token);
    expect(JSON.parse(q.result.content[0].text).status).toBe("ok");
    const bad = await mcp({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "merchant_taste_query", arguments: { branch: s.klcc.ref, workflow: "qloo_build", args: {} } } }, token);
    expect(bad.result.isError).toBe(true);
  });
});
