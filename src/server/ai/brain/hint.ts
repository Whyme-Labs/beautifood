// A model's avoid hint (../../../shared/brain/avoidHint) added to what the rules read from the same
// message. Only added: an allergen, diet, meat or "no alcohol" the rules read stays, whatever the hint
// says, so a hint can make an answer more careful but never less safe.
import { hintItems, type AvoidHint } from "../../../shared/brain/avoidHint";
import type { Understanding } from "./understand";

const union = <T>(a: readonly T[], b: readonly T[]): T[] => [...new Set([...a, ...b])];

/** The parts of a reading a hint adds to. */
type Avoids = Pick<Understanding, "avoid" | "stated" | "allergens" | "diet" | "statedDiet" | "noMeat" | "noAlcohol">;

/** `u` with the hint's avoidances added as stated by the guest. */
export function withHint<T extends Avoids>(u: T, hint: AvoidHint | null | undefined): T {
  if (!hint) return u;
  return {
    ...u,
    avoid: union(u.avoid, hint.allergens),
    stated: union(u.stated, hint.allergens),
    allergens: union(u.allergens, hint.allergens),
    diet: union(u.diet, hint.diets),
    statedDiet: union(u.statedDiet, hint.diets),
    noMeat: union(u.noMeat, hint.meats),
    noAlcohol: u.noAlcohol || hint.alcohol,
  };
}

/** What the hint adds that the rules didn't read, as flat items ("allergen:fish", "meat:beef", …). */
export function hintAdds(u: Avoids, hint: AvoidHint | null | undefined): string[] {
  const rules = new Set(hintItems({ allergens: u.stated, diets: u.statedDiet, meats: u.noMeat, alcohol: u.noAlcohol }));
  return hintItems(hint).filter((x) => !rules.has(x));
}
