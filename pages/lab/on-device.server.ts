import { defineHead } from "void";

// An internal lab page (see pages/lab/on-device.tsx): kept out of search engines and unlinked.
export const head = defineHead(() => ({
  title: "On-device AI lab",
  meta: [{ name: "robots", content: "noindex, nofollow" }],
}));
export const ssr = false;
