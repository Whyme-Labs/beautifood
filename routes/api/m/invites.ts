import { z } from "zod";
import { getUser } from "void/auth";
import { api, body } from "../../../src/server/http";
import { acceptInvite } from "../../../src/server/domain/tenants";
import { fail } from "../../../src/server/errors";

export const POST = api(async (c) => {
  const user = getUser();
  if (!user) fail(401, "unauthorized", "Sign in required");
  const { code } = await body(c, z.object({ code: z.string().min(8) }));
  return acceptInvite(c.env.DB, { id: user.id, email: user.email, name: user.name }, code);
});
