import { z } from "zod";
import { api, body } from "../../../../../../src/server/http";
import { actorOf, staffBranch } from "../../../../../../src/server/routing";
import { listTables, saveTables, toTable } from "../../../../../../src/server/domain/floor";

const Table = z.object({
  id: z.string().optional(),
  label: z.string().trim().min(1).max(12),
  zone: z.string().max(30).optional(),
  seatsMin: z.number().int().min(1).max(60),
  seatsMax: z.number().int().min(1).max(60),
  x: z.number().optional(),
  y: z.number().optional(),
  mergeGroup: z.string().max(30).nullable().optional(),
  splitConfig: z.array(z.object({ suffix: z.string().min(1).max(2), seats: z.number().int().min(1) })).nullable().optional(),
  sort: z.number().int().optional(),
});

export const GET = api(async (c) => {
  const { ctx } = await staffBranch(c, null);
  return (await listTables(c.env.DB, ctx.branch.id)).map(toTable);
});

export const PUT = api(async (c) => {
  const { staff, ctx } = await staffBranch(c, "table.manage");
  const { tables, replace } = await body(c, z.object({ tables: z.array(Table).max(300), replace: z.boolean().default(false) }));
  const ids = await saveTables(c.env.DB, ctx, actorOf(staff), tables, replace);
  return { ids, tables: (await listTables(c.env.DB, ctx.branch.id)).map(toTable) };
});
