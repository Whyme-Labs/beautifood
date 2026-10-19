// WhatsApp: "your table is ready" from the restaurant's own WhatsApp Business number when the
// host calls a guest who left a phone number. Needs WHATSAPP_TOKEN and WHATSAPP_PHONE_ID, and an
// approved message template (WHATSAPP_TEMPLATE, default "table_ready") with three parameters:
// the guest's name, their number, the restaurant.
import type { BeautifoodEvent, Connector, Env } from "../beautifood";

/** E.164 without the plus, as the Cloud API wants it; Malaysian local numbers get 60. */
export function waNumber(phone: string): string | null {
  let d = phone.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("0")) d = `60${d.slice(1)}`;
  return /^\d{8,15}$/.test(d) ? d : null;
}

export function whatsappMessage(e: BeautifoodEvent, env: Env) {
  const t = e.data.ticket;
  const to = t?.phone ? waNumber(t.phone) : null;
  if (!t || !to) return null;
  return {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: env.WHATSAPP_TEMPLATE || "table_ready",
      language: { code: t.locale === "zh" ? "zh_CN" : "en" },
      components: [{ type: "body", parameters: [t.name || "there", t.number, e.restaurant.name].map((text) => ({ type: "text", text })) }],
    },
  };
}

export const whatsapp: Connector = {
  name: "whatsapp",
  events: ["queue.called"],
  enabled: (env) => !!(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID),
  async handle(e, env) {
    const msg = whatsappMessage(e, env);
    if (!msg) return; // no phone number on the ticket: the guest has the web ticket and push
    const r = await fetch(`https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.WHATSAPP_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify(msg),
    });
    if (!r.ok) throw new Error(`WhatsApp: ${r.status} ${await r.text()}`);
  },
};
