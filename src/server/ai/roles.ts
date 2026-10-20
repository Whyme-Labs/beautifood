// "Describe the role, get the permissions." The owner writes what the person should be able to do
// ("a supervisor who can refund and void but can't see reports"); this proposes a name and a
// permission set, says why, and names the closest built-in role. Claude when configured, else a
// keyword reading in English and Chinese. Whatever comes back is clipped to permissions the
// person asking holds, and a human confirms it before anything is saved.
import Anthropic from "@anthropic-ai/sdk";
import { OWNER_ONLY, PERMISSIONS, ROLE_PERMISSIONS, type Permission } from "../../shared/rbac";
import type { Role } from "../../shared/types";
import { claudeEnabled, type ClaudeEnv } from "./claude";

export interface RoleSuggestion {
  name: string;
  permissions: Permission[];
  tenantWide: boolean;
  explanation: string;
  /** The built-in role nearest to it, and how it differs. */
  closest: { role: Role; adds: Permission[]; removes: Permission[] };
  /** Asked for but not given: the asker doesn't hold them (or only owners may). */
  withheld: Permission[];
  engine: "claude" | "rules";
}

// keyword → permissions; each pattern is tried on every clause of the description
const RULES: [RegExp, Permission[]][] = [
  [/refund|退款|退钱/i, ["payment.refund"]],
  [/\bvoid|cancel (an? )?(order|item|dish)|作废|取消(订单|菜)/i, ["order.void"]],
  [/discount|comp\b|折扣|打折|优惠价/i, ["order.discount"]],
  [/cash|till|\bpos\b|payment|pay(s|ing)? |checkout|bill|收银|收款|付款|结账|买单/i, ["order.create", "payment.take"]],
  [/shift|float|cash (up|count)|交班|点钞|开班/i, ["shift.manage"]],
  [/queue|host|seat|walk-?in|door|排队|带位|叫号|入座/i, ["queue.operate"]],
  [/table|floor|qr|桌|座位图|二维码/i, ["table.manage"]],
  [/book|reserv|订位|预订|预约/i, ["booking.manage"]],
  [/order|take orders?|serve|waiter|server|点单|下单|服务员|上菜/i, ["order.create"]],
  [/kitchen|cook|chef|bump|kds|厨房|厨师|出餐/i, ["kds.operate"]],
  [/sold.?out|stock|availability|售罄|库存|沽清/i, ["menu.availability"]],
  [/inventory|ingredient|wastage|deliveries|stock ?(take|count|level)|进货|收货|报损|食材/i, ["inventory.stock"]],
  [/recipe|(manage|set up|run).{0,12}(inventory|ingredients)|stock ?(take|count)|配方|盘点|库存管理/i, ["inventory.manage"]],
  [/(edit|change|update|manage|write).{0,20}menu|menu.{0,12}(edit|price|manage)|price|改菜单|编辑菜单|菜单管理|定价|改价/i, ["menu.manage"]],
  [/report|sales|revenue|numbers|报表|销售|营业额|数据/i, ["report.view"]],
  [/(every|all|each|across).{0,12}(branch|outlet|store)|所有分店|全部分店|各分店|跨分店/i, ["report.view_all"]],
  [/staff|team|hire|invite|roster|员工|团队|招聘|邀请/i, ["staff.manage"]],
  [/setting|configur|设置|配置/i, ["settings.manage"]],
  [/branch(es)? (setup|settings|manage)|open (a )?branch|开分店|分店管理/i, ["branch.manage"]],
  [/campaign|marketing|promo|newsletter|email blast|营销|推广|活动|优惠券/i, ["campaign.manage"]],
  [/member|loyalty|points|会员|积分/i, ["member.manage"]],
  [/integrat|webhook|api key|connector|集成|对接|接口/i, ["integrations.manage"]],
  [/\bai\b|copilot|assistant|insight|智能|助手/i, ["ai.merchant"]],
];
const NEGATION = /\b(no|not|never|without|except|but not|can'?t|cannot|mustn'?t|shouldn'?t|don'?t)\b|不能|不可以|不要|不准|没有|禁止|除了/i;
const WIDE = /(every|all|each|across).{0,12}(branch|outlet|store)|所有分店|全部分店|各分店|跨分店/i;

/** Rules reading of a description: a permission set, and the clauses that removed something. */
export function readDescription(text: string): { perms: Permission[]; tenantWide: boolean } {
  const clauses = text.split(/[,.;:!?\n，。；、！？]|\band\b(?= (?:no|not|can'?t|cannot|never))|\bbut\b|\bexcept\b|但是|但|不过|除了/i).map((c) => c.trim()).filter(Boolean);
  const yes = new Set<Permission>();
  const no = new Set<Permission>();
  let wide = false;
  // the whole text decides "every branch" unless that clause is negated
  for (const c of clauses) {
    const negated = NEGATION.test(c);
    for (const [re, ps] of RULES) if (re.test(c)) for (const p of ps) (negated ? no : yes).add(p);
    if (WIDE.test(c) && !negated) wide = true;
  }
  // "but not X" after "except": anything both asked for and refused stays refused
  for (const p of no) yes.delete(p);
  return { perms: PERMISSIONS.filter((p) => yes.has(p)), tenantWide: wide };
}

export function closestBuiltIn(perms: Permission[]): RoleSuggestion["closest"] {
  const mine = new Set(perms);
  let best: Role = "waiter";
  let score = -1;
  for (const [role, set] of Object.entries(ROLE_PERMISSIONS) as [Role, Set<Permission>][]) {
    if (role === "owner") continue;
    const inter = [...set].filter((p) => mine.has(p)).length;
    const s = inter / (set.size + mine.size - inter || 1);
    if (s > score) (score = s), (best = role);
  }
  const base = ROLE_PERMISSIONS[best];
  return { role: best, adds: PERMISSIONS.filter((p) => mine.has(p) && !base.has(p)), removes: PERMISSIONS.filter((p) => base.has(p) && !mine.has(p)) };
}

const NAME_HINTS: [RegExp, { en: string; zh: string }][] = [
  [/supervisor|主管|领班/i, { en: "Supervisor", zh: "主管" }],
  [/captain|队长/i, { en: "Captain", zh: "领班" }],
  [/barista|bar\b|咖啡师|吧台/i, { en: "Bar", zh: "吧台" }],
  [/runner|跑菜/i, { en: "Runner", zh: "跑菜员" }],
  [/accountant|finance|bookkeep|会计|财务/i, { en: "Accounts", zh: "财务" }],
  [/host|带位/i, { en: "Host", zh: "带位员" }],
  [/area manager|regional|区域经理/i, { en: "Area manager", zh: "区域经理" }],
];

function nameFor(text: string, locale: string): string {
  for (const [re, n] of NAME_HINTS) if (re.test(text)) return locale === "zh" ? n.zh : n.en;
  return locale === "zh" ? "自定义角色" : "Custom role";
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "permissions", "tenant_wide", "explanation"],
  properties: {
    name: { type: "string", description: "A short role name, 1–3 words, in the user's language" },
    permissions: { type: "array", items: { type: "string", enum: PERMISSIONS.filter((p) => !OWNER_ONLY.includes(p)) } },
    tenant_wide: { type: "boolean", description: "True only if the person must see every branch regardless of assignment" },
    explanation: { type: "string", description: "One or two sentences, in the user's language, on what this role can and can't do" },
  },
} as const;

const PERMISSION_GUIDE: Record<Permission, string> = {
  "tenant.manage": "rename/close the restaurant (owners only)",
  "branch.manage": "add branches, change branch details",
  "staff.manage": "invite staff and change their roles",
  "menu.manage": "edit dishes, prices, timed menus and happy hours",
  "menu.availability": "mark dishes sold out / back",
  "table.manage": "edit the floor plan and table QR codes",
  "queue.operate": "run the walk-in queue: call, seat, skip",
  "order.create": "take orders and add items to bills",
  "order.void": "void items or orders",
  "order.discount": "give discounts and apply promo codes",
  "payment.take": "take payments",
  "payment.refund": "refund payments",
  "shift.manage": "open/close cash shifts",
  "kds.operate": "use the kitchen display (bump dishes)",
  "booking.manage": "take and change bookings",
  "report.view": "see sales reports for their branches",
  "report.view_all": "see reports across all branches",
  "member.manage": "manage loyalty members and points",
  "campaign.manage": "run email campaigns and promo codes",
  "settings.manage": "change branch settings and the receipt design",
  "ai.merchant": "use the merchant AI assistant and insights",
  "integrations.manage": "set up webhooks and integrations",
  "inventory.manage": "set up ingredients and recipes, correct and count stock, set low-stock marks",
  "inventory.stock": "see stock, record deliveries and wastage",
};

async function withClaude(env: ClaudeEnv, text: string, locale: string): Promise<{ name: string; permissions: Permission[]; tenantWide: boolean; explanation: string } | null> {
  const c = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 30_000 });
  const res = await c.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 1500,
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> } },
    system: `You design staff roles for a restaurant POS. Map the owner's description to the smallest set of permissions that does the job; leave out anything they didn't ask for, and honour every "not"/"except". Permissions:\n${PERMISSIONS.filter((p) => !OWNER_ONLY.includes(p)).map((p) => `- ${p}: ${PERMISSION_GUIDE[p]}`).join("\n")}\nAnswer in ${locale === "zh" ? "Simplified Chinese" : "English"}.`,
    messages: [{ role: "user", content: text }],
  } as Anthropic.MessageCreateParamsNonStreaming);
  if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") return null;
  const block = res.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!block) return null;
  try {
    const j = JSON.parse(block.text) as { name: string; permissions: string[]; tenant_wide: boolean; explanation: string };
    return { name: j.name, permissions: PERMISSIONS.filter((p) => j.permissions.includes(p)), tenantWide: !!j.tenant_wide, explanation: j.explanation };
  } catch {
    return null;
  }
}

/** Suggest a role from a description, never beyond what `holds` (the asker's permissions) allows. */
export async function suggestRole(env: ClaudeEnv, text: string, holds: Permission[], holdsTenantWide: boolean, locale = "en"): Promise<RoleSuggestion> {
  let engine: RoleSuggestion["engine"] = "rules";
  let out: { name: string; permissions: Permission[]; tenantWide: boolean; explanation: string } | null = null;
  if (claudeEnabled(env)) {
    out = await withClaude(env, text, locale).catch(() => null);
    if (out) engine = "claude";
  }
  if (!out) {
    const r = readDescription(text);
    out = { name: nameFor(text, locale), permissions: r.perms, tenantWide: r.tenantWide, explanation: "" };
  }
  const mine = new Set(holds);
  const allowed = out.permissions.filter((p) => mine.has(p) && !OWNER_ONLY.includes(p));
  const withheld = out.permissions.filter((p) => !allowed.includes(p));
  return {
    name: out.name.slice(0, 40),
    permissions: allowed,
    tenantWide: out.tenantWide && holdsTenantWide,
    explanation: out.explanation,
    closest: closestBuiltIn(allowed),
    withheld,
    engine,
  };
}
