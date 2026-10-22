// Staff console: the taste brief (what the people around a branch love, from Qloo, and what to try).
// English first; the Chinese must have exactly the same keys.
import type { Widen } from "../widen";

export const en = {
  title: "Taste",
  lead: "What people around {location} love, from Qloo's taste graph, set against your menu and best sellers.",
  area: "Area",
  refresh: "Refresh",
  off: "Taste insights aren't set up on this deployment yet.",
  loading: "Asking Qloo about {location}…",
  empty: "Qloo had nothing for {location}. Try a wider area, like the city.",
  try: "Things to try",
  findings: {
    nearby: "Places people around here love",
    cuisine: "{cuisine} places closest to their tastes",
    music: "What they listen to",
    tv: "What they watch",
    audience: "Your guests, as Qloo sees them",
    known_for: "What those places are known for",
  },
  actions: {
    special: "Trial a weekend special around “{tag}”.",
    hours: "Try a “{tag}” service on your busiest day.",
    promo: "Lead your promotions with {dish}.",
    playlist: "Build your dining-room playlist around {artists}.",
    theme_night: "Try a {show} night: a themed set menu and a screening.",
    watch: "Keep an eye on {places}.",
  },
  why: "Why",
  source: "Source: Qloo, {asked}",
  cached: "from cache",
  limits: "What this can't tell you",
  agent: "Your own AI can run this too: connect it to Beautifood's MCP server with a personal access token and ask for merchant_taste_brief.",
};

export const zh: Widen<typeof en> = {
  title: "口味洞察",
  lead: "根据 Qloo 的口味图谱，看看{location}一带的人喜欢什么，再对照你的菜单和热销菜。",
  area: "地区",
  refresh: "刷新",
  off: "这个部署还没有启用口味洞察。",
  loading: "正在向 Qloo 查询{location}…",
  empty: "Qloo 没有{location}的资料，试试更大的范围，比如整个城市。",
  try: "可以试试",
  findings: {
    nearby: "附近的人最爱的店",
    cuisine: "最合他们口味的{cuisine}餐厅",
    music: "他们爱听的音乐",
    tv: "他们爱看的节目",
    audience: "Qloo 眼中的你的客人",
    known_for: "这些店的特色",
  },
  actions: {
    special: "周末试推一道“{tag}”特色菜。",
    hours: "在最忙的那天试试“{tag}”时段。",
    promo: "推广时以{dish}为主打。",
    playlist: "用{artists}的歌做店里的歌单。",
    theme_night: "办一场{show}主题夜：主题套餐加放映。",
    watch: "留意{places}。",
  },
  why: "原因",
  source: "来源：Qloo，{asked}",
  cached: "来自缓存",
  limits: "这份洞察不能说明的事",
  agent: "你自己的 AI 也能做这件事：用个人访问令牌连接 Beautifood 的 MCP 服务器，然后让它调用 merchant_taste_brief。",
};
