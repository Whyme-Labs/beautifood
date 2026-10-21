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
`QLOO_API_KEY` as secrets. Any host that runs a container works: Cloudflare Containers, a small VM,
or Cloud Run.

Then give the Worker `TASTE_URL` (this service's HTTPS address) and the same `TASTE_SECRET`.

| Variable | Default | |
|---|---|---|
| `TASTE_SECRET` | (required, 32+ characters) | The Worker's bearer secret |
| `QLOO_API_KEY` | | The event-issued Qloo credential. Without it, every workflow returns `QLOO_AUTH` |
| `PORT` | 8080 | |
| `CACHE_TTL_S` | 86400 | How long a result is kept |
| `DAILY_CALL_LIMIT` | 2000 | Qloo calls per UTC day before 429 |
| `CALL_TIMEOUT_MS` | 25000 | |
