// Every word the videos put on screen, per language. Each video renders in one language from
// start to finish: the app recordings, the captions and the graphics all match.
import { createContext, useContext } from "react";

export type Lang = "en" | "zh";
export const LANGS: Lang[] = ["en", "zh"];

const LangContext = createContext<Lang>("en");
export const LangProvider = LangContext.Provider;
export const useLang = () => useContext(LangContext);
export const useCopy = () => COPY[useLang()];

type FeatureCopy = { title: string; sub: string; points: string[]; notes: string[] };

const en = {
  url: "beautifood-app.swmengappdev.workers.dev",
  hero: "Ben",
  friend: "Ann",
  crowd: { sign: "AUNTIE LIM'S · 7:42 PM", shouts: ["Ah Meng!", "4 pax?", "No. 37!", "Table for 2?", "Still waiting…"], waiting: "waiting" },
  paper: { walkedAway: "walked away", caption: "Paper slips. Lost tables." },
  drop: ["Queue", "Order", "Pay", "No app"],
  agent: [
    ["→", "find_restaurants", '{ query: "laksa" }'],
    ["←", "2 branches", "queue 3 · ~12 min"],
    ["→", "get_menu", '{ exclude: ["peanuts"] }'],
    ["←", "Char Kway Teow", "signature · RM16.90"],
    ["→", "join_queue", "{ party_size: 2 }"],
    ["←", "B001", "status: waiting"],
  ],
  wall: { join: "people join at once", clean: "0 duplicates · 0 gaps" },
  montage: ["56 end-to-end tests", "Every screen in this video was recorded by them"],
  ticket: { next: "Next please", ready: "Your table is ready" },
  who: { guest: "GUEST", host: "HOST STAND", tv: "DOOR TV", kitchen: "KITCHEN", till: "TILL", owner: "OWNER", tech: "UNDER THE HOOD" },
  times: { join: "7:43 PM", menu: "7:47 PM", preorder: "7:52 PM", call: "7:58 PM", table: "8:05 PM", kitchen: "8:10 PM", till: "9:10 PM" },
  chapter: { closing: ["10:30 PM", "Closing up"], proof: ["Under the hood", "Built for the 7:42 PM rush"] },
  reprise: "walked away",
  tags: {
    join: ["Scan the QR", "No download"],
    ticket: ["Live ticket", "Wait anywhere"],
    menu: ["Allergens on every dish", "Hide what you can't eat"],
    assistant: ["Allergic to peanuts?", "AI checks the menu", "Confirm with staff"],
    preorder: ["Preorder while waiting", "Cooks when you sit"],
    call: ["AI suggests a table", "Host taps Call", "Ben's phone: table ready", "Seat. Floor updates."],
    board: ["The door board calls too"],
    cart: ["Ben + Ann, one cart", "Every phone, live"],
    kitchen: ["Order hits the kitchen", "Bump when ready"],
    till: ["Promo and points", "Change, counted"],
    boss: ["Every branch, live", "Tonight's report"],
    translate: ["Translate the menu", "One click"],
    setup: ["Next: a new branch", "Paste the menu", "AI drafts it", "Apply"],
    agents: ["AI agents can queue too"],
    wall: ["Load test", "300 phones, one second"],
  },
  promo: {
    hook: ["Still shouting", "names at the door?"],
    assistant: ["Allergic to peanuts?", "Ask the menu"],
    host: ["Host taps Call", "Phone buzzes"],
    setup: ["Paste the menu", "AI sets up the shop"],
    tagline: "Queue, order and pay. No app.",
  },
  teaser: { hook: ["No more", "shouting", "names."], join: "Scan. Get a number.", called: "Table ready", cart: "One cart, every phone", host: "AI seats every party" },
  feature: {
    label: "Feature",
    signOff: "Recorded from the running app, with demo data.",
    queue: { title: "Walk-in queue", sub: "Scan, get a number, walk away.", points: ["Live place in line and ETA", "Preorder while waiting", "Push and email when called", "Receipt in the guest's language"], notes: ["Party size, a name, and you have a number.", "A live ticket: your place and your wait.", "Preorder while you wait. It cooks when you sit.", "Called the moment a table is free."] },
    table: { title: "Shared table cart", sub: "Everyone orders from their own phone.", points: ["Scan the table QR", "One cart, live on every phone", "Edit only your own dishes", "Call a waiter or the bill"], notes: ["Ben and Ann, two phones, one shared cart."] },
    assistant: { title: "Menu assistant", sub: "Ask what's good, and what's safe.", points: ["Signatures, diet and budget picks", "Allergen answers with a safety note", "Stories behind the dishes", "Answers in the guest's language"], notes: ["Grounded in the menu data. Never guesses an allergen.", "Allergens on every dish, and a filter for them."] },
    host: { title: "Host stand", sub: "The right party at the right table.", points: ["Suggestions with reasons", "Merges and splits tables", "No-shows free the table", "Fair: nobody waits forever"], notes: ["The host calls Ben. His phone buzzes.", "Called numbers go up on the TV by the door."] },
    kitchenPos: { title: "Kitchen and till", sub: "Tickets to the right station. A till that balances.", points: ["Kitchen, bar and dessert stations", "Splits, promos, loyalty points", "Card, cash and change", "Cash drawer shifts"], notes: ["Table T4's order: bump from cooking to served.", "Promo, points, then cash with the change counted."] },
    owner: { title: "Owner", sub: "Paste the menu. Run every branch.", points: ["AI drafts menu, allergens and tables", "Every branch on one dashboard", "Reports with menu engineering", "Team roles that limit access"], notes: ["A new branch: paste the menu and the floor. Apply.", "Every branch, live.", "Tonight's report: sales, waits, best sellers."] },
    languages: { title: "Menus in every language", sub: "Translate once. Guests read it their way.", points: ["Menus translated by AI", "The owner's edits always win", "Allergens on every dish", "Guests filter what they can't eat"], notes: ["The owner translates the whole menu in one go.", "Guests browse with allergens on every dish."] },
    agents: { title: "AI agents", sub: "Assistants can queue and book too.", points: ["MCP server at /mcp", "Menus in any supported language", "llms.txt and OpenAPI", "Merchant tools behind tokens"], notes: ["Real requests and responses from the test."] },
  } satisfies Record<string, FeatureCopy | string>,
};

const zh: typeof en = {
  url: "beautifood-app.swmengappdev.workers.dev",
  hero: "小明",
  friend: "美美",
  crowd: { sign: "林阿姨小厨 · 晚上 7:42", shouts: ["阿明！", "几位？", "37 号！", "两位吗？", "还要等多久…"], waiting: "人在等" },
  paper: { walkedAway: "人走了", caption: "纸条叫号，客人流失。" },
  drop: ["排队", "点餐", "付款", "免下载 App"],
  agent: [
    ["→", "find_restaurants", '{ query: "叻沙" }'],
    ["←", "2 家分店", "排队 3 组 · 约 12 分钟"],
    ["→", "get_menu", '{ lang: "zh", exclude: ["花生"] }'],
    ["←", "炒粿条", "招牌 · RM16.90"],
    ["→", "join_queue", "{ party_size: 2 }"],
    ["←", "B001", "状态：排队中"],
  ],
  wall: { join: "人同时排队", clean: "零重复 · 零跳号" },
  montage: ["56 个端到端测试", "本片所有画面都由它们自动录制"],
  ticket: { next: "下一位", ready: "您的桌位已准备好" },
  who: { guest: "顾客", host: "带位台", tv: "门口电视", kitchen: "厨房", till: "收银台", owner: "店主", tech: "技术底气" },
  times: { join: "晚上 7:43", menu: "晚上 7:47", preorder: "晚上 7:52", call: "晚上 7:58", table: "晚上 8:05", kitchen: "晚上 8:10", till: "晚上 9:10" },
  chapter: { closing: ["晚上 10:30", "打烊了"], proof: ["技术底气", "为晚上 7:42 的人潮而生"] },
  reprise: "人离开",
  tags: {
    join: ["扫码排队", "免下载"],
    ticket: ["实时号码", "不用干等"],
    menu: ["每道菜都标过敏原", "隐藏不能吃的"],
    assistant: ["对花生过敏？", "AI 查菜单", "请再向店员确认"],
    preorder: ["排队时先点菜", "入座就上菜"],
    call: ["AI 建议桌位", "带位员按叫号", "小明的手机：桌位好了", "入座，座位图更新"],
    board: ["门口电视同步叫号"],
    cart: ["小明和美美，一个购物车", "每部手机实时同步"],
    kitchen: ["订单直达厨房", "做好就点完成"],
    till: ["优惠和积分", "自动算找零"],
    boss: ["所有分店，实时掌握", "今晚的报表"],
    translate: ["一键翻译菜单", "店主随时可改"],
    setup: ["下一步：开新分店", "贴上菜单", "AI 帮你起草", "一键应用"],
    agents: ["AI 智能体也能排队"],
    wall: ["压力测试", "300 部手机，同一秒"],
  },
  promo: {
    hook: ["还在门口", "大声喊号？"],
    assistant: ["对花生过敏？", "问问菜单助手"],
    host: ["带位员按叫号", "手机马上响"],
    setup: ["贴上菜单", "AI 帮你开好店"],
    tagline: "排队、点餐、付款，无需下载 App",
  },
  teaser: { hook: ["不用再", "大声", "喊号。"], join: "扫码取号", called: "桌位准备好了", cart: "一桌一单，人人可点", host: "AI 智能带位" },
  feature: {
    label: "功能",
    signOff: "录自正在运行的应用，使用演示数据。",
    queue: { title: "排队取号", sub: "扫码、取号，不用干等。", points: ["实时显示排位和等候时间", "排队时就能先点菜", "叫号时推送和邮件提醒", "收据用顾客的语言"], notes: ["选人数、留名字，马上有号码。", "实时号码：排位和等候时间。", "排队时先点菜，入座就上菜。", "一有空桌就叫号。"] },
    table: { title: "一桌一单", sub: "每个人用自己的手机点菜。", points: ["扫桌上的二维码", "一个购物车，每部手机实时同步", "只能改自己点的菜", "呼叫服务员或买单"], notes: ["小明和美美，两部手机，一个购物车。"] },
    assistant: { title: "菜单助手", sub: "问问什么好吃、什么能吃。", points: ["招牌菜、饮食和预算推荐", "过敏原问题附安全提示", "每道菜背后的故事", "用顾客的语言回答"], notes: ["根据菜单资料回答，绝不乱猜过敏原。", "每道菜都标过敏原，还能一键过滤。"] },
    host: { title: "带位台", sub: "合适的客人，坐合适的桌。", points: ["带位建议附理由", "可拼桌、可分桌", "未到客人自动释放桌位", "公平：没人被一直跳过"], notes: ["带位员叫小明的号，他的手机马上响。", "叫到的号码同步显示在门口电视上。"] },
    kitchenPos: { title: "厨房与收银", sub: "订单送到对的出餐口，账目对得上。", points: ["厨房、吧台、甜品分开出单", "分单、优惠、会员积分", "刷卡、现金和找零", "钱箱交班"], notes: ["T4 桌的订单：从制作中到已上菜。", "优惠、积分，再收现金，自动算找零。"] },
    owner: { title: "店主", sub: "贴上菜单，管好每家分店。", points: ["AI 起草菜单、过敏原和桌位", "所有分店一个仪表板", "报表附菜单分析", "团队角色限制权限"], notes: ["开新分店：贴上菜单和桌位，应用。", "所有分店，实时掌握。", "今晚的报表：营业额、等候、畅销菜。"] },
    languages: { title: "多语言菜单", sub: "翻译一次，顾客用自己的语言看。", points: ["AI 翻译整份菜单", "店主的修改永远优先", "每道菜都标过敏原", "顾客可过滤不能吃的"], notes: ["店主一键翻译整份菜单。", "顾客浏览菜单，每道菜都标过敏原。"] },
    agents: { title: "AI 智能体", sub: "AI 助手也能帮你排队和订位。", points: ["MCP 服务器位于 /mcp", "菜单支持多种语言", "llms.txt 和 OpenAPI", "商家工具需要令牌"], notes: ["测试中的真实请求和响应。"] },
  },
};

export const COPY: Record<Lang, typeof en> = { en, zh };
export type FeatureKey = "queue" | "table" | "assistant" | "host" | "kitchenPos" | "owner" | "languages" | "agents";
