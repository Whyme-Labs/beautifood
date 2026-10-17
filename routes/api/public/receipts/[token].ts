import { api } from "../../../../src/server/http";
import { notFound } from "../../../../src/server/errors";

export const GET = api(async (c) => {
  const r = await c.env.DB.prepare("SELECT snapshot FROM receipts WHERE token = ?").bind(c.req.param("token")!).first<{ snapshot: string }>();
  if (!r) notFound("Receipt");
  return JSON.parse(r!.snapshot);
});
