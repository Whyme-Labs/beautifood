// A cook's reading of a menu, from Workers AI, when the restaurant onboards: for each dish, the
// allergens its usual recipe has that its line doesn't say (pho broth's fish sauce, a tare's soy).
// Only ever suggestions in the owner's review, like the dish knowledge in shared/dishKnowledge:
// checked against the fourteen allergens, dropped when the dish's own words rule them out, and
// never added to a dish until the owner taps Add. One call per sixty dishes, on a small model.
import { ALLERGENS, type Allergen } from "../../shared/allergens";
import { ruledOut, type Likely } from "../../shared/dishKnowledge";
import { DEFAULT_WORKERS_MODEL } from "./guestModel";

export interface WorkersAi {
  run(model: string, input: unknown): Promise<unknown>;
}

const BATCH = 60;
const WAIT_MS = 20_000;

const SYSTEM = `You are a chef and food-allergen specialist in Malaysia. For each numbered dish, list the allergens its usual recipe very likely contains that its description does not already say. Only these allergen names: ${ALLERGENS.join(", ")}. Only what the standard recipe almost always has (pho broth: fish sauce; tonkotsu tare: soy; sambal: shrimp paste), never guesses. A reason of at most eight words. Reply with JSON only: {"dishes":[{"n":1,"likely":[{"allergen":"fish","because":"fish sauce in the broth"}]}]}. Dishes with nothing to add get "likely":[].`;

/** What each dish likely has beyond its text, in the order given; null when the model can't be reached. */
export async function aiLikelyAllergens(ai: WorkersAi, items: { name: string; description?: string; allergens?: string[] }[], model = DEFAULT_WORKERS_MODEL): Promise<Likely[][] | null> {
  const out: Likely[][] = items.map(() => []);
  try {
    for (let start = 0; start < items.length; start += BATCH) {
      const batch = items.slice(start, start + BATCH);
      const list = batch.map((d, k) => `${k + 1}. ${d.name}${d.description ? ` - ${d.description}` : ""}`).join("\n");
      const r = await Promise.race([
        ai.run(model, { messages: [{ role: "system", content: SYSTEM }, { role: "user", content: list }], max_tokens: 2000, temperature: 0 }),
        new Promise<never>((_, no) => setTimeout(() => no(new Error("timeout")), WAIT_MS)),
      ]);
      for (const d of parse(r)) {
        const k = d.n - 1;
        const item = batch[k];
        if (!item) continue;
        const text = `${item.name} ${item.description ?? ""}`;
        for (const l of d.likely) {
          if (item.allergens?.includes(l.allergen) || ruledOut(text, l.allergen) || out[start + k].some((x) => x.allergen === l.allergen)) continue;
          out[start + k].push({ allergen: l.allergen, because: { en: l.because, zh: l.because } });
        }
      }
    }
    return out;
  } catch (e) {
    console.warn("workers ai allergen suggestions failed", e);
    return null;
  }
}

/** The model's dishes, keeping only well-formed entries with known allergens. */
function parse(r: unknown): { n: number; likely: { allergen: Allergen; because: string }[] }[] {
  const res = r as { response?: unknown; choices?: { message?: { content?: string } }[] };
  const raw = typeof res?.response === "string" ? res.response : typeof res?.response === "object" ? JSON.stringify(res.response) : res?.choices?.[0]?.message?.content ?? "";
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  let data: { dishes?: unknown };
  try {
    data = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(data?.dishes)) return [];
  return data.dishes
    .filter((d): d is { n: number; likely: unknown } => !!d && typeof (d as { n?: unknown }).n === "number")
    .map((d) => ({
      n: d.n,
      likely: (Array.isArray(d.likely) ? d.likely : [])
        .filter((l): l is { allergen: Allergen; because?: string } => !!l && (ALLERGENS as readonly string[]).includes((l as { allergen?: string }).allergen ?? ""))
        .map((l) => ({ allergen: l.allergen, because: String(l.because ?? "").slice(0, 80) || "usual recipe" })),
    }));
}
