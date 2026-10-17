// Self-serve signup: a signed-in user creates their restaurant and becomes its owner.
import { z } from "zod";
import { getUser } from "void/auth";
import { api, body } from "../../../src/server/http";
import { createTenant } from "../../../src/server/domain/tenants";
import { fail } from "../../../src/server/errors";

const Create = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().max(40).optional(),
  cuisine: z.string().max(60).optional(),
  description: z.string().max(500).optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().max(60).optional(),
  branchName: z.string().max(60).optional(),
  address: z.string().max(200).optional(),
});

export const POST = api(async (c) => {
  const user = getUser();
  if (!user) fail(401, "unauthorized", "Sign in required");
  const input = await body(c, Create);
  if (input.timezone) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: input.timezone });
    } catch {
      fail(400, "invalid_timezone", "Unknown timezone");
    }
  }
  return c.json(await createTenant(c.env.DB, { id: user.id, email: user.email, name: user.name }, input), 201);
});
