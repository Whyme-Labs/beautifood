// The integration brief: one Markdown document a restaurant hands to its own coding agent
// (Claude Code, Codex…) so the agent can write the glue between Beautifood and anything else
// (accounting, delivery platforms, messaging) without a call to us. It names this restaurant's
// ids and branches, how to authenticate, every event with a real-shaped payload, how to verify a
// signature, and the rules a good connector follows.
import { RETRY_MINUTES, WEBHOOK_EVENTS, WEBHOOK_HEADERS, WEBHOOK_PING } from "../../shared/webhooks";

export interface BriefInput {
  origin: string;
  tenant: { id: string; name: string; slug: string; currency: string; timezone: string };
  branches: { id: string; name: string; slug: string }[];
  endpoints: { id: string; url: string; events: string[] }[];
}

const SAMPLE_ORDER = {
  id: "or_01…",
  number: "1042",
  type: "dine_in",
  status: "paid",
  items: [
    { id: "oi_01…", item_id: "itm_01…", name: "Char Kway Teow", qty: 2, unit_price: 1690, list_price: null, deal: null, modifiers: [], status: "served" },
    { id: "oi_02…", item_id: "itm_02…", name: "Teh Tarik", qty: 2, unit_price: 385, list_price: 550, deal: "Happy hour", modifiers: [{ group: "Temperature", option: "Iced", price: 50 }], status: "served" },
  ],
  subtotal: 4250,
  discount: 0,
  service_charge: 425,
  tax: 281,
  rounding: -1,
  total: 4955,
  paid: 4955,
  payments: [{ method: "card", amount: 4955, label: null }],
};

export function integrationBrief(b: BriefInput): string {
  const base = b.origin.replace(/\/$/, "");
  const branch = b.branches[0] ?? { id: "br_…", name: "Main", slug: "main" };
  const sample = {
    id: "evt_48213",
    type: "order.paid",
    created_at: "2026-10-19T12:41:07.000Z",
    restaurant: { id: b.tenant.id, name: b.tenant.name, slug: b.tenant.slug },
    branch: { id: branch.id, name: branch.name, slug: branch.slug },
    data: { orderId: SAMPLE_ORDER.id, total: SAMPLE_ORDER.total, order: SAMPLE_ORDER },
  };
  const groups = new Map<string, string[]>();
  for (const e of WEBHOOK_EVENTS) groups.set(e.group, [...(groups.get(e.group) ?? []), `\`${e.type}\` (carries \`data.${e.about}\`)`]);
  return `# Beautifood integration brief: ${b.tenant.name}

You are writing a connector between **${b.tenant.name}** on Beautifood (walk-in queue, table ordering, POS, kitchen display, bookings) and another system. This brief is everything you need. Money is always an integer in minor units (sen/cents) of ${b.tenant.currency}; times are ISO 8601 UTC unless noted; the restaurant runs on ${b.tenant.timezone}.

## The restaurant

- Restaurant id \`${b.tenant.id}\`, slug \`${b.tenant.slug}\`
${b.branches.map((x) => `- Branch **${x.name}**: id \`${x.id}\`, public ref \`${b.tenant.slug}~${x.slug}\``).join("\n")}

## Three ways in

1. **Webhooks** (Beautifood calls you): a signed \`POST\` for every event you subscribe to. Set them up under *Integrations* in the staff console, or with the API below.
2. **REST API** (you call Beautifood): \`${base}/api/m/…\` for staff actions, \`${base}/api/public/…\` for guest-facing data. Machine-readable: ${base}/openapi.json and ${base}/llms.txt.
3. **MCP server** (for AI agents): \`${base}/mcp\`, with guest tools (menu, queue, bookings) and merchant tools (sold-out, queue, reports).

Authenticate staff calls and merchant MCP tools with a personal access token from *Integrations → API keys*:

\`\`\`
Authorization: Bearer bf_pat_…
\`\`\`

A token acts as the person who created it, with their role's permissions, in this restaurant only. Keep it in a secret store, never in code.

## Webhooks

Each delivery is \`POST <your url>\` with a JSON body and these headers:

| Header | Value |
| --- | --- |
| \`content-type\` | \`application/json\` |
| \`${WEBHOOK_HEADERS.event}\` | the event type, e.g. \`order.paid\` |
| \`${WEBHOOK_HEADERS.delivery}\` | a unique delivery id (\`whd_…\`): **dedupe on this** |
| \`${WEBHOOK_HEADERS.signature}\` | \`t=<unix seconds>,v1=<hex HMAC-SHA256>\` |

Answer with any **2xx within 10 seconds**. Anything else (or no answer) is retried after ${RETRY_MINUTES.map((m) => (m < 60 ? `${m} min` : `${m / 60} h`)).join(", ")}, then marked failed; the merchant can resend from the delivery log. Deliveries for one endpoint arrive roughly in order but may repeat or overlap, so make handlers idempotent and do slow work after answering.

### Events

${[...groups].map(([g, list]) => `- **${g}**: ${list.join(", ")}`).join("\n")}
- \`${WEBHOOK_PING}\`: a test the merchant sends from the Integrations page.

### Body

\`\`\`json
${JSON.stringify(sample, null, 2)}
\`\`\`

\`data\` holds the event's own fields plus the record it is about (\`data.order\`, \`data.ticket\`, \`data.booking\`, \`data.item\` or \`data.shift\`) as it stood when the delivery was queued. Call the API if you need it fresher.

### Verifying the signature

The secret (\`whsec_…\`) is on the endpoint in *Integrations*. Sign \`"<t>.<raw body>"\` with HMAC-SHA256 and compare to \`v1\`, using the **raw** request body (before JSON parsing). Reject anything older than 5 minutes.

\`\`\`ts
// Works in Cloudflare Workers, Deno, Bun and Node 18+.
export async function verifyBeautifood(raw: string, header: string | null, secret: string, toleranceS = 300): Promise<boolean> {
  const parts = Object.fromEntries((header ?? "").split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || !parts.v1 || Math.abs(Date.now() / 1000 - t) > toleranceS) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(\`\${t}.\${raw}\`)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  let diff = hex.length ^ parts.v1.length;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ (parts.v1.charCodeAt(i) || 0);
  return diff === 0;
}
\`\`\`

## Managing webhooks from code

With a token whose owner may manage integrations:

- \`GET ${base}/api/m/webhooks\`: list endpoints
- \`POST ${base}/api/m/webhooks\` with \`{ "url": "https://…", "events": ["order.paid"], "branches": ["*"], "description": "Xero sales" }\`: add one (the response includes its \`secret\`)
- \`PATCH ${base}/api/m/webhooks/{id}\`, \`DELETE ${base}/api/m/webhooks/{id}\`
- \`POST ${base}/api/m/webhooks/{id}/test\`: send \`${WEBHOOK_PING}\` now
- \`GET ${base}/api/m/webhooks/{id}/deliveries\`: the delivery log, with each payload and response

${b.endpoints.length ? `Already set up here:\n\n${b.endpoints.map((e) => `- \`${e.id}\` → ${e.url} (${e.events.join(", ")})`).join("\n")}\n` : "No webhooks are set up yet.\n"}
## How a good connector looks

- One small service (a Cloudflare Worker is ideal) with one job, e.g. "post each paid bill to Xero as an invoice" or "send the queue-called message on WhatsApp".
- Verify every delivery, dedupe on \`${WEBHOOK_HEADERS.delivery}\`, answer 2xx fast, then do the work.
- Map ids, don't copy names: keep Beautifood's \`order.id\` / \`item_id\` beside the other system's id.
- Going the other way (e.g. a delivery platform order into the kitchen), use the staff API: \`POST /api/m/branches/{branch}/orders\` with \`{ "takeaway": true, "items": [{ "itemId": "itm_…", "qty": 1 }] }\`; mark dishes sold out with \`POST /api/m/branches/{branch}/availability\`.
- Log what you did with the delivery id, so the merchant can match it to the delivery log.
- Ask the merchant before anything that sends money or messages to guests.
`;
}
