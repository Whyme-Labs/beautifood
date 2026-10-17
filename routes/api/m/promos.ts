import { z } from "zod";
import { api, body } from "../../../src/server/http";
import { staffTenant } from "../../../src/server/routing";

export const GET = api(async (c) => {
  const s = await staffTenant(c, null);
  return (await c.env.DB.prepare("SELECT * FROM promo_codes WHERE tenant_id = ? ORDER BY code").bind(s.tenantId).all()).results;
});

export const POST = api(async (c) => {
  const s = await staffTenant(c, "campaign.manage");
  const p = await body(
    c,
    z.object({
      code: z.string().trim().min(3).max(20).regex(/^[A-Za-z0-9_-]+$/),
      kind: z.enum(["percent", "amount"]),
      value: z.number().min(0),
      minSpend: z.number().int().min(0).default(0),
      maxUses: z.number().int().min(1).nullable().optional(),
      validFrom: z.number().int().nullable().optional(),
      validTo: z.number().int().nullable().optional(),
      description: z.string().max(80).default(""),
    }),
  );
  await c.env.DB.prepare(
    "INSERT INTO promo_codes (tenant_id, code, kind, value, min_spend, max_uses, valid_from, valid_to, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(tenant_id, code) DO UPDATE SET kind = excluded.kind, value = excluded.value, min_spend = excluded.min_spend, max_uses = excluded.max_uses, valid_from = excluded.valid_from, valid_to = excluded.valid_to, description = excluded.description, active = 1",
  )
    .bind(s.tenantId, p.code.toUpperCase(), p.kind, p.value, p.minSpend, p.maxUses ?? null, p.validFrom ?? null, p.validTo ?? null, p.description)
    .run();
  return c.json({ code: p.code.toUpperCase() }, 201);
});
