// Public queue status, cached at the edge for 2s (read surges never reach the database).
import { api } from "../../../../../src/server/http";
import { edgeCached } from "../../../../../src/server/routing";
import { getBranch } from "../../../../../src/server/domain/context";
import { publicStatus } from "../../../../../src/server/domain/floor";

export const GET = api((c) => edgeCached(c, 2, async () => publicStatus(c.env.DB, await getBranch(c.env.DB, c.req.param("branch")!))));
