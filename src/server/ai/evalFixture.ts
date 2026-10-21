// The sample hawker restaurant the guest cases (src/shared/assistantEval.ts) are written for, as
// the assistant sees it. Used to score models, never for a real restaurant.
import { sampleDishes } from "../../shared/assistantEval";
import type { AssistantContext } from "./local";

export function sampleContext(): AssistantContext {
  return {
    restaurant: { name: "Ah Seng", cuisine: "Malaysian hawker", story: "We started in 1998 as a Penang hawker stall.", description: "" },
    branchName: "KLCC",
    currency: "MYR",
    menuLanguage: "en",
    items: sampleDishes().map((d, n) => ({ ...d, categoryId: d.category ?? "", imageUrl: null, story: "", tags: [], modifiers: [], active: true, sort: n, soldOut: false, popularity: 0 })),
  } as unknown as AssistantContext;
}
