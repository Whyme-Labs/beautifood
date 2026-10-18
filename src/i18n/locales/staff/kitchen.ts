// Staff console: kitchen. English first; the Chinese must have exactly the same keys.
import type { Widen } from "../widen";

export const en = {
  title: "Kitchen",
  stationsLabel: "Station",
  stations: { all: "All stations", kitchen: "Kitchen", bar: "Bar", dessert: "Dessert" },
  empty: "No tickets. The pass is clear.",
  table: "Table {tables}",
  takeaway: "Takeaway #{number}",
  order: "#{number}",
  meta: "Bill #{number} · round {round}",
  age: "{count}m",
  ageLabel: { one: "Waiting {count} minute", other: "Waiting {count} minutes" },
  late: "Late",
  bump: "{name}: {status}",
  allReady: "All ready",
  served: "Served",
  left: { one: "{count} left", other: "{count} left" },
} as const;

export const zh: Widen<typeof en> = {
  title: "厨房",
  stationsLabel: "工作站",
  stations: { all: "全部", kitchen: "厨房", bar: "水吧", dessert: "甜点" },
  empty: "没有单子，都出完了。",
  table: "{tables} 桌",
  takeaway: "外带 #{number}",
  order: "#{number}",
  meta: "单号 #{number} · 第 {round} 轮",
  age: "{count} 分",
  ageLabel: { one: "已等 {count} 分钟", other: "已等 {count} 分钟" },
  late: "超时",
  bump: "{name}：{status}",
  allReady: "全部做好",
  served: "已上菜",
  left: { one: "还剩 {count} 样", other: "还剩 {count} 样" },
};
