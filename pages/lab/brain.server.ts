import { defineHead } from "void";

// A lab page (see pages/lab/brain.tsx): kept out of search engines and unlinked.
export const head = defineHead(() => ({
  title: "Menu brain lab",
  meta: [{ name: "robots", content: "noindex, nofollow" }],
}));
export const ssr = false;
