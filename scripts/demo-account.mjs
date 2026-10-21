// Make (or refresh) the public demo: an owner account and a demo restaurant with two weeks of
// trading, for people trying Beautifood (hackathon judges, merchants). Creates a new restaurant each
// run; the account is reused.
//
//   BASE=https://app.beautifood.io DEMO_EMAIL=... DEMO_PASSWORD=... node scripts/demo-account.mjs
const base = process.env.BASE ?? "http://127.0.0.1:5173";
const email = process.env.DEMO_EMAIL;
const password = process.env.DEMO_PASSWORD;
const name = process.env.DEMO_NAME ?? "Beautifood Demo Kitchen";
if (!email || !password || password.length < 12) throw new Error("Set DEMO_EMAIL and DEMO_PASSWORD (12+ characters)");

let cookie = "";
async function call(path, body) {
  const r = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body ?? {}),
  });
  const set = r.headers.getSetCookie?.() ?? [];
  if (set.length) cookie = set.map((c) => c.split(";")[0]).join("; ");
  return { status: r.status, body: await r.json().catch(() => null) };
}

let auth = await call("/api/auth/sign-in/email", { email, password });
if (auth.status !== 200) auth = await call("/api/auth/sign-up/email", { email, password, name: "Demo Owner" });
if (auth.status !== 200) throw new Error(`Sign-in failed (${auth.status}): ${JSON.stringify(auth.body)}`);
const seed = await call(`/api/dev/seed?history=1&name=${encodeURIComponent(name)}`);
if (seed.status !== 201) throw new Error(`Seed failed (${seed.status}): ${JSON.stringify(seed.body)}`);
console.log(JSON.stringify({ slug: seed.body.slug, branches: seed.body.branches.map((b) => ({ name: b.name, ref: b.ref })) }, null, 2));
