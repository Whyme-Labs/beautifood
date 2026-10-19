// Model Context Protocol server (Streamable HTTP, stateless JSON-RPC) so people's
// own AI agents can use Beautifood: find restaurants, read menus & allergens,
// check queues, join a queue, book a table. Merchants' agents get extra tools
// with a personal access token (Authorization: Bearer bf_pat_…).
import { isLocale, LOCALES } from "../i18n/core";
import { localizeCategory, localizeItem } from "../shared/menuI18n";
import { z } from "zod";
import { appEnv } from "./appenv";
import { customerChat } from "./ai";
import { availability, createBooking, toBooking } from "./domain/bookings";
import { getBranch, type BranchCtx } from "./domain/context";
import { joinQueue, publicStatus, queueBoard, cancelTicket, ticketView } from "./domain/floor";
import { menuAt, setAvailability } from "./domain/menu";
import { searchBranches } from "./domain/tenants";
import { branchReport, tenantOverview } from "./domain/reports";
import { AppError } from "./errors";
import { requirePerm, requireStaff, type Ctx, type Staff } from "./http";
import { localParts, zonedTime } from "./ids";
import { sign, verify } from "./sign";
import { ALLERGEN_LABELS } from "../shared/allergens";
import { formatMoney } from "../shared/format";
import { isTenantWide } from "../shared/rbac";

const PROTOCOLS = ["2025-11-25", "2025-06-18", "2025-03-26"];

interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };
  merchant?: boolean;
  run: (c: Ctx, args: Record<string, unknown>, staff: Staff | null) => Promise<unknown>;
}

const str = (d: string) => ({ type: "string", description: d });
const int = (d: string) => ({ type: "integer", description: d });
const obj = (props: Record<string, unknown>, required: string[]) => ({ type: "object", properties: props, required, additionalProperties: false });
const branchArg = str("Branch id or 'restaurant-slug~branch-slug' (from find_restaurants)");

async function branch(c: Ctx, ref: unknown): Promise<BranchCtx> {
  if (typeof ref !== "string" || !ref) throw new AppError(400, "invalid_input", "branch is required");
  return getBranch(c.env.DB, ref);
}

function origin(c: Ctx) {
  return new URL(c.req.url).origin;
}

async function merchantBranch(c: Ctx, staff: Staff | null, ref: unknown, perm: Parameters<typeof requirePerm>[1]) {
  if (!staff) throw new AppError(401, "unauthorized", "Merchant tools need a personal access token");
  const ctx = await branch(c, ref);
  if (ctx.tenant.id !== staff.tenantId) throw new AppError(403, "forbidden", "Not your restaurant");
  requirePerm(staff, perm, ctx.branch.id);
  return ctx;
}

const TOOLS: Tool[] = [
  {
    name: "find_restaurants",
    title: "Find restaurants",
    description: "List restaurants and branches on Beautifood with their live queue length and estimated waits. Optionally filter by a search query (name, cuisine, area).",
    inputSchema: obj({ query: str("Optional search text") }, []),
    annotations: { readOnlyHint: true },
    run: async (c, a) => {
      const rows = await searchBranches(c.env.DB, String(a.query ?? ""), 25);
      return Promise.all(
        rows.map(async (r) => {
          const st = await publicStatus(c.env.DB, await getBranch(c.env.DB, r.id));
          return { branch: `${r.tenant_slug}~${r.slug}`, restaurant: r.tenant_name, branchName: r.name, cuisine: r.cuisine, address: r.address, queue: st.categories.map((x) => ({ partySizes: `${x.min}-${x.max}`, waiting: x.waiting, estimatedWaitMinutes: x.estimateMinutes })) };
        }),
      );
    },
  },
  {
    name: "get_menu",
    title: "Get menu",
    description: "What the branch is serving right now (breakfast, lunch and other timed menus are applied) with today's prices (a happy hour shows the deal and the usual price), signatures, spice level, dietary tags and allergens. Optionally exclude allergens or require dietary tags. Allergen data comes from the restaurant; advise guests with severe allergies to confirm with staff.",
    inputSchema: obj(
      {
        branch: branchArg,
        exclude_allergens: { type: "array", items: { type: "string", enum: Object.keys(ALLERGEN_LABELS) } },
        dietary: { type: "array", items: { type: "string", enum: ["vegetarian", "vegan", "halal_friendly"] } },
        lang: { type: "string", enum: LOCALES.map((l) => l.code), description: "Language for dish names and descriptions (translations from the restaurant; original name kept in original_name)" },
      },
      ["branch"],
    ),
    annotations: { readOnlyHint: true },
    run: async (c, a) => {
      const ctx = await branch(c, a.branch);
      const menu = await menuAt(c.env.DB, ctx);
      const ex = (a.exclude_allergens as string[] | undefined) ?? [];
      const di = (a.dietary as string[] | undefined) ?? [];
      const base = menu.language ?? "en";
      const lang = isLocale(a.lang) ? a.lang : base;
      const cats = new Map(menu.categories.map((x) => [x.id, localizeCategory(x, lang, base)]));
      return {
        restaurant: ctx.tenant.name,
        currency: ctx.config.currency,
        items: menu.items
          .filter((i) => !i.soldOut && i.servedNow !== false && !ex.some((x) => i.allergens.includes(x)) && di.every((d) => i.dietary.includes(d)))
          .map((i) => {
            const l = localizeItem(i, lang, base);
            return { id: i.id, name: l.name, original_name: l.original ?? undefined, category: cats.get(i.categoryId), price: formatMoney(i.price, ctx.config.currency), ...(i.deal && i.listPrice ? { usual_price: formatMoney(i.listPrice, ctx.config.currency), deal: i.deal.name } : {}), description: l.description, signature: i.isSignature, spiceLevel: i.spiceLevel, dietary: i.dietary, allergens: i.allergens, story: l.story || undefined };
          }),
        language: lang,
        allergenNote: "Allergen information is provided by the restaurant. Guests with severe allergies should confirm with staff.",
      };
    },
  },
  {
    name: "ask_menu_assistant",
    title: "Ask the restaurant's menu assistant",
    description: "Ask the restaurant's own assistant what to eat: signatures, dishes for a diet or budget, allergens in a dish, or the story behind a dish.",
    inputSchema: obj({ branch: branchArg, question: str("The guest's question"), lang: { type: "string", enum: LOCALES.map((l) => l.code), description: "Language for the answer" } }, ["branch", "question"]),
    annotations: { readOnlyHint: true },
    run: async (c, a) => customerChat(c.env.DB, appEnv(), await branch(c, a.branch), [{ role: "user", content: String(a.question ?? "").slice(0, 2000) }], isLocale(a.lang) ? a.lang : "en"),
  },
  {
    name: "queue_status",
    title: "Queue status",
    description: "Live queue at a branch: waiting parties per party-size class, estimated wait for someone joining now, and numbers being called.",
    inputSchema: obj({ branch: branchArg }, ["branch"]),
    annotations: { readOnlyHint: true },
    run: async (c, a) => publicStatus(c.env.DB, await branch(c, a.branch)),
  },
  {
    name: "join_queue",
    title: "Join the queue",
    description: "Put a party in a branch's walk-in queue. Returns the queue number, estimated wait, and a private tracking link + token to check or cancel the ticket. Confirm party size and name with the user before calling.",
    inputSchema: obj({ branch: branchArg, party_size: int("Number of guests"), name: str("Name to call"), email: str("Optional email for notifications and receipts"), phone: str("Optional phone") }, ["branch", "party_size", "name"]),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    run: async (c, a) => {
      const ctx = await branch(c, a.branch);
      const input = z.object({ party_size: z.number().int().min(1).max(60), name: z.string().min(1).max(60), email: z.string().email().optional(), phone: z.string().max(30).optional() }).parse(a);
      const { ticket } = await joinQueue(c.env.DB, ctx, { partySize: input.party_size, name: input.name, email: input.email, phone: input.phone, source: "agent" }, null);
      const token = await sign(appEnv().TOKEN_SECRET, { k: "ticket", id: ticket.id, b: ctx.branch.id });
      const view = await ticketView(c.env.DB, ctx, ticket.id);
      return { number: view.number, partiesAhead: view.ahead, estimatedWaitMinutes: view.etaMinutes, ticketId: ticket.id, token, trackingUrl: `${origin(c)}/ticket/${ticket.id}?k=${encodeURIComponent(token)}` };
    },
  },
  {
    name: "check_ticket",
    title: "Check a queue ticket",
    description: "Current status of a queue ticket (waiting/called/seated), parties ahead and estimated wait.",
    inputSchema: obj({ ticket_id: str("Ticket id from join_queue"), token: str("Token from join_queue") }, ["ticket_id", "token"]),
    annotations: { readOnlyHint: true },
    run: async (c, a) => {
      const p = await verify(appEnv().TOKEN_SECRET, String(a.token), "ticket");
      if (!p || p.id !== a.ticket_id) throw new AppError(401, "invalid_token", "Invalid ticket token");
      const v = await ticketView(c.env.DB, await getBranch(c.env.DB, p.b), p.id);
      return { number: v.number, status: v.status, partiesAhead: v.ahead, estimatedWaitMinutes: v.etaMinutes, tables: v.calledTables.length ? v.calledTables : v.seating?.tables ?? [] };
    },
  },
  {
    name: "cancel_ticket",
    title: "Cancel a queue ticket",
    description: "Leave the queue. Only call when the user explicitly asks to cancel.",
    inputSchema: obj({ ticket_id: str("Ticket id"), token: str("Token from join_queue") }, ["ticket_id", "token"]),
    annotations: { readOnlyHint: false, destructiveHint: true },
    run: async (c, a) => {
      const p = await verify(appEnv().TOKEN_SECRET, String(a.token), "ticket");
      if (!p || p.id !== a.ticket_id) throw new AppError(401, "invalid_token", "Invalid ticket token");
      await cancelTicket(c.env.DB, await getBranch(c.env.DB, p.b), "agent", p.id);
      return { cancelled: true };
    },
  },
  {
    name: "booking_availability",
    title: "Find booking slots",
    description: "Available reservation times at a branch for a date (YYYY-MM-DD, branch-local) and party size.",
    inputSchema: obj({ branch: branchArg, date: str("YYYY-MM-DD"), party_size: int("Number of guests") }, ["branch", "date", "party_size"]),
    annotations: { readOnlyHint: true },
    run: async (c, a) => {
      const r = await availability(c.env.DB, await branch(c, a.branch), String(a.date), Number(a.party_size));
      return { date: r.day, partySize: r.partySize, durationMinutes: r.durationMinutes, available: r.slots.filter((s) => s.available).map((s) => s.label) };
    },
  },
  {
    name: "create_booking",
    title: "Book a table",
    description: "Reserve a table. time is branch-local HH:MM from booking_availability. Confirm details with the user before calling.",
    inputSchema: obj({ branch: branchArg, date: str("YYYY-MM-DD"), time: str("HH:MM, branch-local"), party_size: int("Number of guests"), name: str("Guest name"), email: str("Optional email for confirmation"), notes: str("Optional notes") }, ["branch", "date", "time", "party_size", "name"]),
    annotations: { readOnlyHint: false, destructiveHint: false },
    run: async (c, a) => {
      const ctx = await branch(c, a.branch);
      const [h, m] = String(a.time).split(":").map(Number);
      const slotStart = zonedTime(String(a.date), h, m || 0, ctx.config.timezone);
      const b = toBooking(await createBooking(c.env.DB, ctx, { name: String(a.name), email: a.email ? String(a.email) : null, partySize: Number(a.party_size), slotStart, notes: a.notes ? String(a.notes) : "" }, "agent"));
      const token = await sign(appEnv().TOKEN_SECRET, { k: "booking", id: b.id, b: ctx.branch.id });
      return { bookingId: b.id, status: b.status, partySize: b.partySize, date: a.date, time: a.time, manageUrl: `${origin(c)}/booking/${b.id}?k=${encodeURIComponent(token)}` };
    },
  },
  // ── merchant tools ────────────────────────────────────────────────────────
  {
    name: "merchant_overview",
    title: "All-branch live overview",
    description: "Merchant: live queue, occupancy, open bills and today's sales for every branch you can access.",
    inputSchema: obj({}, []),
    annotations: { readOnlyHint: true },
    merchant: true,
    run: async (c, _a, s) => {
      if (!s) throw new AppError(401, "unauthorized", "Merchant tools need a personal access token");
      return tenantOverview(c.env.DB, s.tenantId, isTenantWide(s) || s.branches.includes("*") ? "*" : s.branches);
    },
  },
  {
    name: "merchant_queue",
    title: "Branch queue & seating suggestions",
    description: "Merchant: waiting parties with ETAs and the seating engine's suggestions (with reasons) for a branch.",
    inputSchema: obj({ branch: branchArg }, ["branch"]),
    annotations: { readOnlyHint: true },
    merchant: true,
    run: async (c, a, s) => {
      const ctx = await merchantBranch(c, s, a.branch, "queue.operate");
      const b = await queueBoard(c.env.DB, ctx);
      return {
        strategy: b.strategy,
        waiting: b.tickets.map((t) => ({ number: t.number, partySize: t.partySize, status: t.status, etaMinutes: t.etaMinutes, waitedMinutes: Math.round((Date.now() - t.createdAt) / 60_000) })),
        suggestions: b.suggestions.map((x) => ({ ticket: x.ticketNumber, tables: x.tableLabels, action: x.action, reasons: x.reasons })),
        freeTables: b.tables.filter((t) => t.status === "free").map((t) => t.label),
      };
    },
  },
  {
    name: "merchant_sales_report",
    title: "Sales & queue report",
    description: "Merchant: a branch's end-of-day report (sales, payment mix, best sellers, queue waits, table turns) for a date (default today).",
    inputSchema: obj({ branch: branchArg, date: str("Optional YYYY-MM-DD") }, ["branch"]),
    annotations: { readOnlyHint: true },
    merchant: true,
    run: async (c, a, s) => {
      const ctx = await merchantBranch(c, s, a.branch, "report.view");
      return branchReport(c.env.DB, ctx, a.date ? String(a.date) : localParts(Date.now(), ctx.config.timezone).day);
    },
  },
  {
    name: "merchant_set_sold_out",
    title: "Mark dish sold out",
    description: "Merchant: mark a dish sold out (or back in stock) at a branch.",
    inputSchema: obj({ branch: branchArg, item_id: str("Menu item id"), sold_out: { type: "boolean" } }, ["branch", "item_id", "sold_out"]),
    annotations: { readOnlyHint: false, idempotentHint: true },
    merchant: true,
    run: async (c, a, s) => {
      const ctx = await merchantBranch(c, s, a.branch, "menu.availability");
      await setAvailability(c.env.DB, ctx.tenant.id, ctx.branch.id, `agent:${s!.userId}`, String(a.item_id), !!a.sold_out);
      return { ok: true };
    },
  },
];

interface RpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

const rpcError = (id: RpcRequest["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

export async function handleMcp(c: Ctx): Promise<Response> {
  let msg: RpcRequest | RpcRequest[];
  try {
    msg = await c.req.json();
  } catch {
    return c.json(rpcError(null, -32700, "Parse error"), 400);
  }
  let staff: Staff | null = null;
  if (c.req.header("authorization")?.startsWith("Bearer bf_pat_")) {
    try {
      staff = await requireStaff(c);
    } catch (e) {
      return c.json(rpcError(null, -32001, (e as Error).message), 401);
    }
  }
  const batch = Array.isArray(msg);
  const results = [];
  for (const m of batch ? (msg as RpcRequest[]) : [msg as RpcRequest]) {
    const r = await handleOne(c, m, staff);
    if (r) results.push(r);
  }
  if (!results.length) return new Response(null, { status: 202 });
  return c.json(batch ? results : results[0]);
}

async function handleOne(c: Ctx, m: RpcRequest, staff: Staff | null) {
  if (m.id === undefined) return null; // notification (e.g. notifications/initialized)
  const tools = TOOLS.filter((t) => !t.merchant || staff);
  switch (m.method) {
    case "initialize": {
      const requested = String(m.params?.protocolVersion ?? "");
      return {
        jsonrpc: "2.0",
        id: m.id,
        result: {
          protocolVersion: PROTOCOLS.includes(requested) ? requested : PROTOCOLS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "beautifood", title: "Beautifood restaurants", version: "1.0.0" },
          instructions:
            "Beautifood lets you browse restaurant menus (with allergens), check live queues, join a walk-in queue and book tables. Always confirm party size, name and time with the user before join_queue or create_booking. Relay allergen notes faithfully.",
        },
      };
    }
    case "ping":
      return { jsonrpc: "2.0", id: m.id, result: {} };
    case "tools/list":
      return { jsonrpc: "2.0", id: m.id, result: { tools: tools.map(({ run: _r, merchant: _m, ...t }) => t) } };
    case "tools/call": {
      const name = String(m.params?.name ?? "");
      const tool = tools.find((t) => t.name === name);
      if (!tool) return rpcError(m.id, -32602, `Unknown tool: ${name}`);
      try {
        const out = await tool.run(c, (m.params?.arguments as Record<string, unknown>) ?? {}, staff);
        return { jsonrpc: "2.0", id: m.id, result: { content: [{ type: "text", text: JSON.stringify(out, null, 2) }], structuredContent: Array.isArray(out) ? { items: out } : out, isError: false } };
      } catch (e) {
        const message = e instanceof AppError ? e.message : e instanceof z.ZodError ? `Invalid arguments: ${e.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}` : "Tool failed";
        if (!(e instanceof AppError) && !(e instanceof z.ZodError)) console.error("mcp tool", name, e);
        return { jsonrpc: "2.0", id: m.id, result: { content: [{ type: "text", text: message }], isError: true } };
      }
    }
    default:
      return rpcError(m.id, -32601, `Method not found: ${m.method}`);
  }
}

export const MCP_TOOLS = TOOLS;
