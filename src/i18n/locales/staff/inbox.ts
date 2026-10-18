// Staff console: inbox (the outbox of guest emails). English first; the Chinese must have exactly the same keys.
import type { Widen } from "../widen";

export const en = {
  title: "Outbox",
  about: "Every email sent to your guests: receipts, sign-in codes, queue updates and campaigns.",
  filter: "Recipient",
  filterPlaceholder: "Filter by recipient",
  select: "Select an email to read it",
  none: "No emails sent yet.",
  noMatch: "No emails to that recipient.",
  preview: "Email preview",
  to: "To {email}",
  kinds: {
    receipt: "Receipt",
    ticket_joined: "Queue ticket",
    ticket_called: "Table ready",
    booking_created: "Booking",
    otp: "Sign-in code",
    campaign: "Campaign",
  },
} as const;

export const zh: Widen<typeof en> = {
  title: "发件箱",
  about: "所有发给客人的电邮：收据、登录验证码、排队通知和推广活动。",
  filter: "收件人",
  filterPlaceholder: "按收件人筛选",
  select: "选择一封电邮来查看",
  none: "还没有发出任何电邮。",
  noMatch: "没有发给这位收件人的电邮。",
  preview: "电邮预览",
  to: "收件人 {email}",
  kinds: {
    receipt: "收据",
    ticket_joined: "排队号码",
    ticket_called: "可入座通知",
    booking_created: "订位",
    otp: "登录验证码",
    campaign: "推广活动",
  },
};
