// The menu as the guest assistant reads it, for a device that answers by itself (the kiosk: the menu
// brain and the hybrid avoid reader run in its browser, so it keeps answering when the network drops).
// Only what a guest can already see: the public menu, what's on now, the branch's charges and halal
// standing. Sales become a 0–1 popularity rank; order pairings and the chat log stay on the server.
import { api } from "../../../../../../src/server/http";
import { getBranch } from "../../../../../../src/server/domain/context";
import { assistantContext } from "../../../../../../src/server/ai";
import { fail } from "../../../../../../src/server/errors";

export const GET = api(async (c) => {
  const ctx = await getBranch(c.env.DB, c.req.param("branch")!);
  if (!ctx.config.modules.aiAssistant) fail(409, "assistant_off", "The menu assistant is turned off here");
  const full = await assistantContext(c.env.DB, ctx);
  const top = Math.max(1, ...full.items.map((i) => i.popularity ?? 0));
  const context = {
    restaurant: full.restaurant,
    branchName: full.branchName,
    currency: full.currency,
    menuLanguage: full.menuLanguage,
    now: full.now,
    menus: full.menus,
    rules: full.rules,
    clock: full.clock,
    halal: full.halal,
    charges: full.charges,
    items: full.items.map((i) => ({ ...i, popularity: Math.round(((i.popularity ?? 0) / top) * 100) / 100 })),
  };
  c.header("cache-control", "no-store");
  return { context, at: Date.now() };
});
