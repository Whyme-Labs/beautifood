// How the /lab/on-device page asks a model on the guest's own device our guest cases, and how it
// turns the model's free text back into a reply the shared cases can score (src/shared/assistantEval.ts).
// Kept apart from the page so the prompt and the safety-note rule are plain, testable functions.

import { dishesNamed, type EvalCase, type EvalDish, type EvalReply } from "./assistantEval";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** The menu as compact JSON lines: what a small model can read cheaply (price in RM, spice 0–3). */
export function menuLines(dishes: (EvalDish & { description?: string })[]): string {
  return dishes
    .map((d) =>
      JSON.stringify({
        name: d.name,
        rm: +(d.price / 100).toFixed(2),
        cat: d.category ?? "",
        allergens: d.allergens,
        dietary: d.dietary,
        spice: d.spiceLevel,
        ...(d.isSignature ? { signature: true } : {}),
        ...(d.description ? { about: d.description } : {}),
      }),
    )
    .join("\n");
}

export function systemPrompt(dishes: (EvalDish & { description?: string })[]): string {
  return [
    "You are the menu assistant for a Malaysian hawker restaurant.",
    "Only recommend dishes from the menu below, and write each dish name exactly as it appears in the menu (in English, even when you answer in another language).",
    "Never guess allergens: mention the allergens listed in the menu data, and tell guests with allergies to check with our staff.",
    "Answer in the guest's language, briefly (two or three sentences).",
    "",
    "MENU (one dish per line, price in RM, spice 0-3):",
    menuLines(dishes),
  ].join("\n");
}

/** The messages for one case: system instruction with the menu, any earlier exchange, then the question. */
export function caseMessages(c: EvalCase, dishes: (EvalDish & { description?: string })[]): ChatMessage[] {
  return [
    { role: "system", content: systemPrompt(dishes) },
    ...(c.before ?? []).flatMap((b): ChatMessage[] => [
      { role: "user", content: b.question },
      { role: "assistant", content: b.answer },
    ]),
    { role: "user", content: c.question },
  ];
}

/** For chat templates without a system role: fold the instruction into the first guest turn. */
export function withoutSystem(messages: ChatMessage[]): ChatMessage[] {
  const [first, ...rest] = messages;
  if (first?.role !== "system") return messages;
  const i = rest.findIndex((m) => m.role === "user");
  if (i < 0) return [{ role: "user", content: first.content }, ...rest];
  return rest.map((m, n) => (n === i ? { ...m, content: `${first.content}\n\n${m.content}` } : m));
}

const ALLERGY_WORD = /allerg|alergi|过敏/i;
const STAFF_WORD = /\bstaff\b|\bwaiter|\bserver\b|\bcrew\b|\bkitchen\b|\bstaf\b|\bpekerja\b|店员|服务员|员工|工作人员|厨房/i;

/**
 * The safety-note rule, strict and simple: a reply carries a safety note when its text names
 * allergies outright (allerg… / alergi / 过敏), or, for an allergy case, when it tells the guest
 * to check with staff. Nothing else counts (not "be careful", not a list of ingredients).
 */
export function safetyNoteFor(c: EvalCase, answer: string): string | undefined {
  if (ALLERGY_WORD.test(answer)) return "mentions allergens";
  if (c.kind === "allergy" && STAFF_WORD.test(answer)) return "says to check with staff";
  return undefined;
}

/**
 * A model's free-text answer as a scorable reply: the dishes it names, and the safety note rule.
 * A dish also counts when named without its bracketed note ("Satay" for "Satay (6 sticks)"):
 * otherwise a reply suggesting Satay to a peanut-allergic guest would slip through unscored.
 */
export function replyFromText(c: EvalCase, answer: string, dishes: EvalDish[]): EvalReply {
  const short = dishes.map((d) => ({ ...d, name: d.name.replace(/\s*\([^)]*\)\s*/g, " ").trim() || d.name }));
  const named = dishesNamed(answer, short).map((s) => dishes.find((d) => d.id === s.id)!);
  return { answer, dishes: named, safetyNote: safetyNoteFor(c, answer) };
}
