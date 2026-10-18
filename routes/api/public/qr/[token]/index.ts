// Static table QR (printed once). If the table is seated, scanning joins its cart;
// otherwise, by branch policy, offer self-seating or direct the guest to the host.
import { api } from "../../../../../src/server/http";
import { appEnv } from "../../../../../src/server/appenv";
import { getBranch } from "../../../../../src/server/domain/context";
import { notFound } from "../../../../../src/server/errors";
import { sign } from "../../../../../src/server/sign";

export const GET = api(async (c) => {
  const t = await c.env.DB.prepare("SELECT id, branch_id, label, status, seating_id, seats_min, seats_max FROM floor_tables WHERE static_token = ? AND active = 1")
    .bind(c.req.param("token")!)
    .first<{ id: string; branch_id: string; label: string; status: string; seating_id: string | null; seats_min: number; seats_max: number }>();
  if (!t) notFound("Table");
  const ctx = await getBranch(c.env.DB, t.branch_id);
  const base = { branch: { id: ctx.branch.id, name: ctx.branch.name, restaurant: ctx.tenant.name }, table: { label: t.label, seatsMax: t.seats_max } };
  if (!ctx.config.modules.tableQr || ctx.config.qrMode === "dynamic") return { ...base, action: "ask_staff", reason: "dynamic", message: "Please ask our staff for your table's ordering code." };
  if (t.status === "seated" && t.seating_id) {
    const s = await c.env.DB.prepare("SELECT session_id FROM seatings WHERE id = ? AND status = 'open'").bind(t.seating_id).first<{ session_id: string }>();
    if (s) {
      const token = await sign(appEnv().TOKEN_SECRET, { k: "session", id: s.session_id, b: ctx.branch.id });
      return { ...base, action: "join", sessionId: s.session_id, token, url: `/s/${s.session_id}?k=${encodeURIComponent(token)}` };
    }
  }
  if (t.status === "free" && ctx.config.staticQrSelfSeat) return { ...base, action: "self_seat" };
  return { ...base, action: "ask_staff", reason: t.status === "free" ? "free" : "not_ready", message: t.status === "free" ? "Please check in with our host to be seated." : "This table isn't ready for ordering yet. Please ask our staff." };
});
