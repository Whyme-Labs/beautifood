// Staff console: bookings. English first; the Chinese must have exactly the same keys.
import type { Widen } from "../widen";

export const en = {
  title: "Bookings",
  day: "Day",
  prevDay: "Previous day",
  nextDay: "Next day",
  empty: "No bookings on this day.",
  stats: { bookings: "Bookings", guests: "Guests", confirmed: "Still to arrive", checkedIn: "Checked in" },
  cols: { time: "Time", guest: "Guest", pax: "Pax", tables: "Tables", status: "Status", actions: "Actions" },
  preordered: "Preordered",
  checkIn: "Check in",
  noShow: "No-show",
  toasts: { seated: "{name} seated", noShow: "Marked no-show", cancelled: "Cancelled" },
} as const;

export const zh: Widen<typeof en> = {
  title: "订位",
  day: "日期",
  prevDay: "前一天",
  nextDay: "后一天",
  empty: "这天没有订位。",
  stats: { bookings: "订位", guests: "人数", confirmed: "未到", checkedIn: "已到" },
  cols: { time: "时间", guest: "客人", pax: "人数", tables: "桌号", status: "状态", actions: "操作" },
  preordered: "已预点",
  checkIn: "报到入座",
  noShow: "没来",
  toasts: { seated: "{name} 已入座", noShow: "已标记没来", cancelled: "已取消" },
};
