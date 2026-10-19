import { z } from "zod";

export const Participant = z.object({ id: z.string().min(4).max(64), name: z.string().trim().min(1).max(40) });

/** A webhook endpoint as the Integrations page (or an agent with a token) sends it. */
export const WebhookEndpointInput = z
  .object({
    url: z.string().trim().min(8).max(500),
    description: z.string().trim().max(120).optional(),
    events: z.array(z.string().max(40)).min(1).max(40),
    branches: z.array(z.string().max(40)).max(50).default(["*"]),
    active: z.boolean().optional(),
  })
  .strict();


/** A custom role as the role editor sends it. */
export const RoleInput = z
  .object({
    id: z.string().regex(/^rl_[a-z0-9]{6,40}$/).optional(),
    name: z.string().trim().min(2).max(40),
    description: z.string().trim().max(300).optional(),
    permissions: z.array(z.string().max(40)).min(1).max(40),
    tenantWide: z.boolean().optional(),
  })
  .strict();
