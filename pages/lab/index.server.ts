import { defineHead } from "void";

// The lab (see pages/lab/index.tsx): kept out of search engines and unlinked.
export const head = defineHead(() => ({
  title: "Lab",
  meta: [{ name: "robots", content: "noindex, nofollow" }],
}));
export const ssr = false;
