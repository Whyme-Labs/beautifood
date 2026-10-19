// Slack: the moments a manager wants to hear about, in a channel. Needs SLACK_WEBHOOK_URL.
import { money, type BeautifoodEvent, type Connector, type Env } from "../beautifood";

export function slackText(e: BeautifoodEvent): string | null {
  const where = e.branch ? `${e.restaurant.name} · ${e.branch.name}` : e.restaurant.name;
  const d = e.data;
  switch (e.type) {
    case "menu.sold_out":
      return `:no_entry: *${d.item?.name ?? "A dish"}* is sold out at ${where}.`;
    case "menu.back_in_stock":
      return `:white_check_mark: *${d.item?.name ?? "A dish"}* is back at ${where}.`;
    case "payment.refunded":
      return `:leftwards_arrow_with_hook: Refund on bill *#${d.order?.number ?? "?"}* at ${where}: ${money(Number(d.amount ?? 0))}.`;
    case "shift.closed": {
      const v = Number(d.variance ?? 0);
      return `:moneybag: Shift closed at ${where}: counted ${money(Number(d.counted ?? 0))}, expected ${money(Number(d.expected ?? 0))}${v ? ` (*${v > 0 ? "+" : ""}${money(v)}*)` : " (exact)"}.`;
    }
    case "webhook.ping":
      return `:wave: Beautifood is connected to this channel for ${where}.`;
    default:
      return null;
  }
}

export const slack: Connector = {
  name: "slack",
  events: ["menu.sold_out", "menu.back_in_stock", "payment.refunded", "shift.closed", "webhook.ping"],
  enabled: (env: Env) => !!env.SLACK_WEBHOOK_URL,
  async handle(e, env) {
    const text = slackText(e);
    if (!text) return;
    const r = await fetch(env.SLACK_WEBHOOK_URL!, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
    if (!r.ok) throw new Error(`Slack: ${r.status} ${await r.text()}`);
  },
};
