import { z } from "zod";

export const Participant = z.object({ id: z.string().min(4).max(64), name: z.string().trim().min(1).max(40) });
