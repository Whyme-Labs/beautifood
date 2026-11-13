import { defineHead } from "void";

// The hybrid reader's page (see pages/hybrid/index.tsx): public, for judges and guests to try.
export const head = defineHead(() => ({
  title: "Can I eat this? · Beautifood",
  meta: [{ name: "description", content: "A restaurant menu assistant that reads what you can't eat on your own device, with Gemini Nano through Firebase AI Logic, and falls back to the cloud when it can't." }],
}));
export const ssr = false;
