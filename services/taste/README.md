# Taste service

Qloo's harness (`qloo mcp` from [`@qloo/qloo-harness`](https://www.npmjs.com/package/@qloo/qloo-harness))
behind a small private HTTPS endpoint, for the Beautifood Worker. The Worker can't start a local
process, and the [Qloo hackathon kit](https://github.com/qloo/qloo-hackathon-kit) supports the
harness on a server or container, not in serverless functions, so this runs in a container.

It keeps one MCP connection to the harness open and allows only Qloo's read-only workflows
(`qloo_find_tags`, `qloo_describe`, `qloo_recommend`, `qloo_rank`, `qloo_where_popular`,
`qloo_compare_audiences`, `qloo_entity_tags`, `qloo_audience_demographics`, `qloo_trends`). It
caches results for a day, since aggregate taste moves slowly and the event key has a quota, and
caps calls per day. It logs the workflow, status and time of each call, never its arguments or the key.

```
POST /v1/run   { "tool": "qloo_recommend", "args": { "target_type": "artist", "signal_location": "Kuala Lumpur" } }
               Authorization: Bearer $TASTE_SECRET
GET  /healthz  { "ok": true, "credential": "ready" | "missing", "callsToday": 12 }
```

The response is the harness's own result envelope (`status`, `summary`, `results`, `provenance`, …).

## Run it

```sh
npm ci
TASTE_SECRET=$(openssl rand -hex 32) QLOO_API_KEY=... node server.mjs   # :8080
npm test                                                                # against a stand-in harness
```

Or build the container: `docker build -t beautifood-taste .`, then run it with `TASTE_SECRET` and
`QLOO_API_KEY` as secrets. Any host that runs a container works. Then give the app Worker `TASTE_URL`
(this service's HTTPS address) and the same `TASTE_SECRET`.

## On Cloudflare Containers, on demand

`cloudflare/` runs it on Cloudflare Containers: a small Worker checks the secret first, so a
stranger's request never wakes the container, then hands the request to one "basic" instance
(¼ vCPU, 1 GiB). The instance starts on the first request and sleeps after 10 idle minutes, so it
costs only while it's answering. The app keeps each Qloo answer in its own cache for a day, so a
sleeping container stays asleep for anything asked recently. Guests never wait on a cold start: the
assistant gives Qloo 2.5 seconds, then answers without it.

The **Taste service** workflow (`.github/workflows/taste.yml`, run by hand) does the lot: it tests
the service, deploys the container Worker, makes a fresh shared secret for both Workers, points the
app at it, and wakes it once to check Qloo answers. It needs the Workers Paid plan and the
`QLOO_API_KEY` repository secret.

What it costs: the Workers Paid plan ($5 a month) includes 25 GiB-hours of memory, 375 vCPU-minutes
and 200 GB-hours of disk. Beyond that, memory is about $0.009 per GiB-hour, the main cost of an awake
instance. CPU is billed only while busy, and at our call rates it stays inside the included minutes.
A month with the container awake 60 hours is about $0.35 over the plan; awake all the time it would
be about $7.

| Variable | Default | |
|---|---|---|
| `TASTE_SECRET` | (required, 32+ characters) | The Worker's bearer secret |
| `QLOO_API_KEY` | | The event-issued Qloo credential. Without it, every workflow returns `QLOO_AUTH` |
| `PORT` | 8080 | |
| `CACHE_TTL_S` | 86400 | How long a result is kept |
| `DAILY_CALL_LIMIT` | 2000 | Qloo calls per UTC day before 429 |
| `CALL_TIMEOUT_MS` | 25000 | |
