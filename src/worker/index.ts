import { DurableObject } from "cloudflare:workers";
export class BranchDO extends DurableObject {
  n() { this.ctx.storage.sql.exec("create table if not exists t(x)"); this.ctx.storage.sql.exec("insert into t values(1)"); return this.ctx.storage.sql.exec("select count(*) c from t").one().c; }
}
export default { async fetch(req: Request, env: any) { const s = env.BRANCH.get(env.BRANCH.idFromName("a")); return new Response(String(await s.n())); } };
