// The lab is one page now (/lab): the old lab addresses lead there.
import { defineMiddleware } from "void";

export default defineMiddleware(async (c, next) => {
  const path = new URL(c.req.url).pathname.replace(/\/$/, "");
  if (path === "/lab/brain" || path === "/lab/on-device") return c.redirect("/lab", 301);
  return next();
});
