// Guest emails in the guest's language (the locale they used when they queued or booked).
// One branded layout: a yellow ticket header, the big number, one button.
import { formatters, isLocale, translator, type MessageKey, type Vars } from "../i18n/core";
import type { ReceiptSnapshot } from "./domain/messaging";

export interface Mail {
  subject: string;
  html: string;
  text: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const lang = (l: string | null | undefined) => (isLocale(l) ? l : "en");

function layout(locale: string, restaurant: string, body: string, serial?: string): string {
  const t = translator(locale);
  return `<!doctype html><html lang="${locale}"><body style="margin:0;background:#f7f1e3;font-family:-apple-system,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;color:#1a1814">
<div style="max-width:480px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #eadfc6">
<div style="background:#ffd12e;padding:18px 24px;border-bottom:2px dashed rgba(26,24,20,.3)">
<div style="font-weight:800;font-size:18px">${esc(restaurant)}</div>
${serial ? `<div style="font-weight:800;font-size:44px;letter-spacing:.02em;line-height:1.1;margin-top:6px">${esc(serial)}</div>` : ""}
</div>
<div style="padding:22px 24px;font-size:15px;line-height:1.55">${body}</div>
<div style="padding:0 24px 20px;color:#8a8170;font-size:12px">${esc(t("email.footer", { restaurant }))}</div>
</div></body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:20px 0 4px"><a href="${esc(href)}" style="display:inline-block;background:#1a1814;color:#ffd12e;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px">${esc(label)}</a></p>`;

const p = (s: string) => `<p style="margin:0 0 10px">${s}</p>`;

/** Translate and HTML-escape the variables (catalog text itself is trusted). */
const th = (locale: string) => {
  const t = translator(locale);
  return (key: MessageKey, vars: Vars = {}) => t(key, Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, typeof v === "string" ? esc(v) : v])));
};

export function otpMail(locale: string | null | undefined, restaurant: string, code: string): Mail {
  const l = lang(locale);
  const t = translator(l);
  return {
    subject: t("email.otpSubject", { code, restaurant }),
    html: layout(l, restaurant, p(th(l)("email.otpBody", { restaurant })) + `<p style="font-size:30px;font-weight:800;letter-spacing:6px;margin:6px 0 14px">${code}</p>` + p(`<span style="color:#6b6355">${esc(t("email.otpExpiry"))}</span>`)),
    text: `${t("email.otpBody", { restaurant })} ${code}. ${t("email.otpExpiry")}`,
  };
}

export function ticketJoinedMail(locale: string | null | undefined, v: { restaurant: string; branch: string; name: string; number: string; partySize: number; url: string | null }): Mail {
  const l = lang(locale);
  const t = translator(l);
  const h = th(l);
  return {
    subject: t("email.joinedSubject", { branch: v.branch, number: v.number }),
    html: layout(
      l,
      v.restaurant,
      p(h("email.joinedHello", { name: v.name, restaurant: v.restaurant, branch: v.branch })) +
        p(`<b>${esc(t("email.joinedParty", { count: v.partySize }))}</b>`) +
        p(esc(t("email.joinedNext"))) +
        (v.url ? button(v.url, t("email.viewTicket")) : ""),
      v.number,
    ),
    text: [t("email.joinedHello", v), `${v.number} · ${t("email.joinedParty", { count: v.partySize })}`, t("email.joinedNext"), v.url ?? ""].filter(Boolean).join("\n"),
  };
}

export function ticketCalledMail(locale: string | null | undefined, v: { restaurant: string; branch: string; number: string; tables: string[]; holdMinutes: number; url: string | null }): Mail {
  const l = lang(locale);
  const t = translator(l);
  const h = th(l);
  const tables = v.tables.length ? t("email.calledTables", { tables: v.tables.join(" + ") }) : "";
  return {
    subject: t("email.calledSubject", { number: v.number }),
    html: layout(
      l,
      v.restaurant,
      p(`<b style="font-size:18px">${h("email.calledBody", { branch: v.branch })}</b>`) +
        (tables ? p(`<b>${esc(tables)}</b>`) : "") +
        p(esc(t("email.calledHold", { minutes: v.holdMinutes }))) +
        (v.url ? button(v.url, t("email.viewTicket")) : ""),
      v.number,
    ),
    text: [`${v.number}: ${t("email.calledBody", { branch: v.branch })}`, tables, t("email.calledHold", { minutes: v.holdMinutes }), v.url ?? ""].filter(Boolean).join("\n"),
  };
}

export function bookingMail(locale: string | null | undefined, v: { restaurant: string; branch: string; name: string; partySize: number; slotStart: number; timezone: string; url: string | null }): Mail {
  const l = lang(locale);
  const t = translator(l);
  const when = formatters(l).fullDateTime(v.slotStart, v.timezone);
  return {
    subject: t("email.bookingSubject", { restaurant: v.restaurant, branch: v.branch }),
    html: layout(
      l,
      v.restaurant,
      p(th(l)("email.bookingBody", { name: v.name, count: v.partySize, when })) + p(esc(t("email.bookingPreorder"))) + (v.url ? button(v.url, t("email.viewBooking")) : ""),
    ),
    text: [t("email.bookingBody", { name: v.name, count: v.partySize, when }), t("email.bookingPreorder"), v.url ?? ""].filter(Boolean).join("\n"),
  };
}

export function receiptMail(locale: string | null | undefined, r: ReceiptSnapshot): Mail {
  const l = lang(locale);
  const t = translator(l);
  const f = formatters(l);
  const m = (n: number) => esc(f.money(n, r.currency));
  const when = f.dateTime(r.closedAt, r.timezone);
  const row = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:4px 0;${strong ? "font-weight:800;font-size:17px" : "color:#6b6355"}">${label}</td><td style="padding:4px 0;text-align:right;${strong ? "font-weight:800;font-size:17px" : ""}">${value}</td></tr>`;
  const method = (k: string) => {
    const key = `payMethod.${k}` as MessageKey;
    const s = t(key);
    return s === key ? k : s;
  };
  const head = [t("email.receiptTitle", { number: r.orderNumber }), when, r.tables.length ? t("email.receiptTable", { tables: r.tables.join("+") }) : ""].filter(Boolean).join(" · ");
  const body = `<div style="color:#6b6355;font-size:13px;margin-bottom:12px">${esc(r.branch)}${r.address ? " · " + esc(r.address) : ""}<br>${esc(head)}</div>
<table style="width:100%;border-collapse:collapse;font-size:14px">
${r.items
  .map(
    (i) =>
      `<tr><td style="padding:6px 0">${i.qty}× ${esc(i.name)}${i.modifiers.length ? `<div style="color:#8a8170;font-size:12px">${i.modifiers.map((x) => esc(x.option)).join(", ")}</div>` : ""}</td><td style="text-align:right;vertical-align:top;padding:6px 0">${m(i.lineTotal)}</td></tr>`,
  )
  .join("")}
</table>
<hr style="border:none;border-top:2px dashed #eadfc6;margin:12px 0">
<table style="width:100%;border-collapse:collapse;font-size:14px">
${row(esc(t("common.subtotal")), m(r.subtotal))}
${r.discount ? row(esc(r.discountLabel ?? t("common.discount")), "-" + m(r.discount)) : ""}
${r.serviceCharge ? row(esc(t("common.serviceChargePct", { pct: r.serviceChargePct })), m(r.serviceCharge)) : ""}
${r.tax ? row(esc(t("common.taxPct", { pct: r.taxPct })), m(r.tax)) : ""}
${r.rounding ? row(esc(t("common.rounding")), m(r.rounding)) : ""}
${row(esc(t("common.total")), m(r.total), true)}
${r.payments.map((x) => row(esc(t("receipt.paidWith", { method: method(x.method) })) + (x.splitLabel ? " (" + esc(x.splitLabel) + ")" : ""), m(x.amount))).join("")}
</table>
${r.points ? `<div style="margin-top:16px;background:#fff6cc;border-radius:10px;padding:12px;font-size:14px">${esc(t("email.receiptPoints", { earned: r.points.earned, balance: r.points.balance, tier: r.points.tier }))}</div>` : ""}
${button(r.url, t("email.receiptOnline"))}
<p style="color:#8a8170;font-size:13px;margin-top:14px">${esc(t("email.thanks"))}</p>`;
  return {
    subject: t("email.receiptSubject", { restaurant: r.restaurant, total: f.money(r.total, r.currency) }),
    html: layout(l, r.restaurant, body),
    text: [
      `${r.restaurant} · ${r.branch}`,
      head,
      ...r.items.map((i) => `${i.qty}x ${i.name}  ${f.money(i.lineTotal, r.currency)}`),
      `${t("common.subtotal")} ${f.money(r.subtotal, r.currency)}`,
      r.discount ? `${t("common.discount")} -${f.money(r.discount, r.currency)}` : "",
      r.serviceCharge ? `${t("common.serviceCharge")} ${f.money(r.serviceCharge, r.currency)}` : "",
      r.tax ? `${t("common.tax")} ${f.money(r.tax, r.currency)}` : "",
      `${t("common.total")} ${f.money(r.total, r.currency)}`,
      r.points ? t("email.receiptPoints", { earned: r.points.earned, balance: r.points.balance, tier: r.points.tier }) : "",
      r.url,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
