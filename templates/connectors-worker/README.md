# Beautifood connectors kit

Example connectors between Beautifood and the tools restaurants already use, as **one Cloudflare Worker on your own account**. Each connector is a small file; each runs only when you set its secrets. Use them as they are, or hand this folder to your coding agent (Claude Code, Codex…) together with the *integration brief* from **Integrations** in the Beautifood console, and ask for the connector you need.

| Connector | When | Does | Secrets |
| --- | --- | --- | --- |
| `slack` | dish sold out / back, refund, shift closed | posts to a Slack channel | `SLACK_WEBHOOK_URL` |
| `whatsapp` | a guest is called | sends your approved "table ready" template from your WhatsApp Business number | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, optional `WHATSAPP_TEMPLATE` |
| `xero` | a bill is paid | creates an authorised sales invoice with every line, service charge, tax and rounding | `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_REFRESH_TOKEN`, `XERO_TENANT_ID`, optional `XERO_ACCOUNT_CODE` |
| `delivery` (inbound) | your delivery middleware POSTs an order | puts it on the kitchen screen as a takeaway bill, matched to your menu by name | `BEAUTIFOOD_TOKEN`, `DELIVERY_SECRET` |

## Deploy

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Whyme-Labs/beautifood/tree/main/templates/connectors-worker)

1. In Beautifood: **Integrations → Webhooks → Webhook**, URL `https://<your-worker>.workers.dev/hooks`, pick the events of the connectors you'll use. Copy its signing secret.
2. `npx wrangler secret put BEAUTIFOOD_WEBHOOK_SECRET` (paste the `whsec_…`), then the secrets of the connectors you want.
3. Recommended: a KV namespace bound as `STATE` (see `wrangler.jsonc`), so each delivery is handled once even if it's retried, and Xero's rotating refresh token is kept.
4. **Send test** on the webhook: `GET /` on your worker shows which connectors are on.

## How it behaves

- Every delivery's signature is checked (`verify` in `src/beautifood.ts`); anything unsigned or older than 5 minutes is refused.
- Each connector runs once per delivery (with `STATE`). If one fails, the worker answers 500, Beautifood retries later, and the connectors that already worked are skipped.
- Inbound delivery orders are deduplicated by platform and order id, and refused (422, with the names) if a dish isn't on your menu, never guessed.

## Delivery orders: the request

```http
POST /delivery/orders
x-delivery-secret: <DELIVERY_SECRET>
content-type: application/json

{ "platform": "grabfood", "externalId": "GF-8812", "branch": "br_…", "customer": "Wei Ling",
  "items": [{ "name": "Char Kway Teow", "qty": 2, "notes": "less spicy" }, { "name": "Teh Tarik", "qty": 1 }] }
```

Answer: `201 { "orderId": "or_…", "number": "1043", "total": 4590 }`.

## Writing your own

Copy a file in `src/connectors/`, give it a `name`, the `events` it handles, `enabled(env)` and `handle(event, env)`, and add it to `CONNECTORS` in `src/index.ts`. The event shapes are in `src/beautifood.ts`; all of them, with examples, are in the integration brief.
