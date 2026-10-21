import { expect, test } from "@playwright/test";
import { guestClient } from "../helpers";

test("the assistant eval route doesn't exist without the one-off key", async () => {
  const g = await guestClient();
  expect((await g.post("/api/internal/assistant-eval", { data: { model: "@cf/x/y", question: "hi", lang: "en" } })).status()).toBe(404);
  expect((await g.post("/api/internal/assistant-eval", { headers: { "x-eval-key": "guess" }, data: { model: "@cf/x/y", question: "hi", lang: "en" } })).status()).toBe(404);
});
