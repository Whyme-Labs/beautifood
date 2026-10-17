import { z } from "zod";
import { api, body } from "../../../../../src/server/http";
import { appEnv } from "../../../../../src/server/appenv";
import { getBranch } from "../../../../../src/server/domain/context";
import { seatWalkIn } from "../../../../../src/server/domain/floor";
import { fail, notFound } from "../../../../../src/server/errors";
import { sign } from "../../../../../src/server/sign";

export const POST = api(async (c) => {
  const { partySize } = await body(c, z.object({ partySize: z.number().int().min(1).max(30) }));
  const t = await c.env.DB.prepare("SELECT id, branch_id FROM floor_tables WHERE static_token = ? AND active = 1").bind(c.req.param("token")!).first<{ id: string; branch_id: string }>();
  if (!t) notFound("Table");
  const ctx = await getBranch(c.env.DB, t.branch_id);
  if (!ctx.config.staticQrSelfSeat || ctx.config.qrMode === "dynamic") fail(403, "self_seat_off", "Please check in with our host");
  const res = await seatWalkIn(c.env.DB, ctx, "guest:qr", partySize, { tableIds: [t.id] });
  const token = await sign(appEnv().TOKEN_SECRET, { k: "session", id: res.sessionId, b: ctx.branch.id });
  return c.json({ ...res, token, url: `/s/${res.sessionId}?k=${encodeURIComponent(token)}` }, 201);
});
