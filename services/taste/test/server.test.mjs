import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createTasteService, stable } from "../server.mjs";

const fake = fileURLToPath(new URL("./fake-qloo.mjs", import.meta.url));
const SECRET = "s".repeat(40);

async function start(extra = {}) {
  const svc = createTasteService({ TASTE_SECRET: SECRET, QLOO_COMMAND: process.execPath, QLOO_ARGS: fake, ...extra });
  await new Promise((ok) => svc.server.listen(0, ok));
  const url = `http://127.0.0.1:${svc.server.address().port}`;
  const post = (body, auth = `Bearer ${SECRET}`) => fetch(`${url}/v1/run`, { method: "POST", headers: { authorization: auth, "content-type": "application/json" }, body: JSON.stringify(body) });
  return { svc, url, post };
}

test("needs a long secret", () => {
  assert.throws(() => createTasteService({ TASTE_SECRET: "short" }), /TASTE_SECRET/);
});

test("refuses callers without the secret, and tools we don't use", async () => {
  const { svc, post } = await start();
  try {
    assert.equal((await post({ tool: "qloo_recommend", args: {} }, "Bearer nope")).status, 401);
    assert.equal((await post({ tool: "qloo_recommend", args: {} }, "")).status, 401);
    const r = await post({ tool: "qloo_build", args: {} });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error, "unknown_tool");
  } finally {
    await svc.close();
  }
});

test("runs a Qloo workflow and caches the answer (whatever the key order)", async () => {
  const { svc, post } = await start();
  try {
    const a = await (await post({ tool: "qloo_recommend", args: { target_type: "place", signal_location: "Kuala Lumpur" } })).json();
    assert.equal(a.status, "ok");
    assert.equal(a.results[0].calls, 1);
    assert.equal(a.results[0].name, "Nasi Kandar Pelita");
    const b = await (await post({ tool: "qloo_recommend", args: { signal_location: "Kuala Lumpur", target_type: "place" } })).json();
    assert.equal(b.cached, true);
    assert.equal(b.results[0].calls, 1);
  } finally {
    await svc.close();
  }
});

test("passes errors through without caching them", async () => {
  const { svc, post } = await start();
  try {
    const a = await (await post({ tool: "qloo_find_tags", args: { query: "boom" } })).json();
    assert.equal(a.status, "error");
    assert.equal(a.error.code, "QLOO_AUTH");
    const b = await (await post({ tool: "qloo_find_tags", args: { query: "boom" } })).json();
    assert.equal(b.cached, undefined);
  } finally {
    await svc.close();
  }
});

test("stops at the daily limit", async () => {
  const { svc, post } = await start({ DAILY_CALL_LIMIT: "1" });
  try {
    assert.equal((await post({ tool: "qloo_find_tags", args: { query: "a" } })).status, 200);
    assert.equal((await post({ tool: "qloo_find_tags", args: { query: "b" } })).status, 429);
  } finally {
    await svc.close();
  }
});

test("reports health without the secret", async () => {
  const { svc, url } = await start();
  try {
    assert.deepEqual(await (await fetch(`${url}/healthz`)).json(), { ok: true, credential: "ready", callsToday: 0 });
  } finally {
    await svc.close();
  }
});

test("stable JSON sorts keys at every level", () => {
  assert.equal(stable({ b: 1, a: { d: [2, { f: 1, e: 0 }], c: 1 } }), '{"a":{"c":1,"d":[2,{"e":0,"f":1}]},"b":1}');
});
